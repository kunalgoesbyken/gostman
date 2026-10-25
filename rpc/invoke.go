package rpc

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	codepb "google.golang.org/genproto/googleapis/rpc/code"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

const (
	contentTypeJSON = "application/json"

	headerStatus  = "grpc-status"
	headerMessage = "grpc-message"
)

func Invoke(ctx context.Context, call Call, policy engine.Policy) engine.Response {
	started := time.Now()
	response := invoke(ctx, call, policy)
	response.DurationMs = time.Since(started).Milliseconds()
	return response
}

func invoke(ctx context.Context, call Call, policy engine.Policy) engine.Response {
	expansion, err := newExpansion(call.Target)
	if err != nil {
		return classify(ctx, err).response()
	}
	response := invokeWith(ctx, call, expansion, policy)
	response.Unresolved = expansion.Missing()
	return response
}

func invokeWith(ctx context.Context, call Call, expansion *engine.Expansion, policy engine.Policy) engine.Response {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(call.Target.Options))
	defer cancel()

	session, err := openWith(call.Target, expansion, policy)
	if err != nil {
		return classify(ctx, err).response()
	}
	defer session.close()

	result, err := session.call(ctx, call, policy.ResponseLimit())
	if err != nil {
		return classify(ctx, err).response()
	}
	if result.interrupted(ctx) {
		return classify(ctx, ctx.Err()).response()
	}
	return result.response(session.conn.target.address)
}

func (s *session) call(ctx context.Context, call Call, limit int64) (*exchange, error) {
	ctx, err := s.connect(ctx)
	if err != nil {
		return nil, err
	}
	method, files, err := s.method(ctx, call.Method)
	if err != nil {
		return nil, err
	}
	format := newFormat(files)
	requests, err := format.requests(method, s.expansion.Text(call.Message))
	if err != nil {
		return nil, err
	}
	if err := s.expansion.Err(); err != nil {
		return nil, configError("%v", err)
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	stream, err := s.conn.NewStream(ctx, bidirectional, "/"+string(method.Parent().FullName())+"/"+string(method.Name()))
	if err != nil {
		return nil, err
	}
	go func() {
		for _, request := range requests {
			if stream.SendMsg(request) != nil {
				return
			}
		}
		stream.CloseSend()
	}()

	result := &exchange{method: method, status: status.New(codes.OK, "")}
	for {
		reply := dynamicpb.NewMessage(method.Output())
		if err := stream.RecvMsg(reply); err != nil {
			if !errors.Is(err, io.EOF) {
				result.status = status.Convert(err)
			}
			break
		}
		encoded, err := format.encode(reply)
		if err != nil {
			return nil, fmt.Errorf("a response message cannot be shown as JSON: %w", err)
		}
		if result.size+int64(len(encoded)) > limit {
			result.truncated = true
			break
		}
		result.messages = append(result.messages, encoded)
		result.size += int64(len(encoded))
	}
	cancel()

	result.header, _ = stream.Header()
	result.trailer = stream.Trailer()
	return result, nil
}

type format struct {
	marshal   protojson.MarshalOptions
	unmarshal protojson.UnmarshalOptions
}

func newFormat(files *protoregistry.Files) format {
	types := dynamicpb.NewTypes(files)
	return format{
		marshal:   protojson.MarshalOptions{Resolver: types, EmitDefaultValues: true},
		unmarshal: protojson.UnmarshalOptions{Resolver: types},
	}
}

func (f format) requests(method protoreflect.MethodDescriptor, raw string) ([]proto.Message, error) {
	documents, err := splitMessages(method, raw)
	if err != nil {
		return nil, err
	}
	requests := make([]proto.Message, 0, len(documents))
	for _, document := range documents {
		request := dynamicpb.NewMessage(method.Input())
		if err := f.unmarshal.Unmarshal(document, request); err != nil {
			return nil, configError("the message is not a valid %s: %v", method.Input().FullName(), err)
		}
		requests = append(requests, request)
	}
	return requests, nil
}

func splitMessages(method protoreflect.MethodDescriptor, raw string) ([]json.RawMessage, error) {
	text := strings.TrimSpace(raw)
	if text == "" {
		text = emptyMessage
	}
	if !method.IsStreamingClient() || !strings.HasPrefix(text, "[") {
		return []json.RawMessage{json.RawMessage(text)}, nil
	}
	var documents []json.RawMessage
	if err := json.Unmarshal([]byte(text), &documents); err != nil {
		return nil, configError("the messages are not a valid JSON array: %v", err)
	}
	return documents, nil
}

func (f format) encode(message proto.Message) ([]byte, error) {
	encoded, err := f.marshal.Marshal(message)
	if err != nil {
		return nil, err
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, encoded); err != nil {
		return nil, err
	}
	return compact.Bytes(), nil
}

type exchange struct {
	method    protoreflect.MethodDescriptor
	messages  [][]byte
	size      int64
	truncated bool
	header    metadata.MD
	trailer   metadata.MD
	status    *status.Status
}

func (e *exchange) interrupted(ctx context.Context) bool {
	if ctx.Err() == nil || e.status.Code() == codes.OK {
		return false
	}
	if errors.Is(ctx.Err(), context.Canceled) {
		return true
	}
	return !e.method.IsStreamingServer() || len(e.messages) == 0
}

func (e *exchange) response(address string) engine.Response {
	body := e.body()
	code := e.status.Code()
	return engine.Response{
		Status:       fmt.Sprintf("%d %s", code, codeName(code)),
		StatusCode:   int(code),
		Headers:      e.headers(),
		Body:         string(body),
		BodyEncoding: engine.EncodingUTF8,
		ContentType:  contentTypeJSON,
		Size:         int64(len(body)),
		URL:          address,
		Truncated:    e.truncated,
		Protocol:     Protocol,
	}
}

func (e *exchange) body() []byte {
	if len(e.messages) == 0 && e.status.Code() != codes.OK {
		failed, _ := json.Marshal(map[string]string{"code": codeName(e.status.Code()), "message": e.status.Message()})
		return failed
	}
	if !e.method.IsStreamingServer() {
		return bytes.Join(e.messages, nil)
	}
	return append(append([]byte("["), bytes.Join(e.messages, []byte(","))...), ']')
}

func (e *exchange) headers() []engine.HeaderEntry {
	entries := append(flatten(e.header), flatten(e.trailer)...)
	entries = append(entries, engine.HeaderEntry{Key: headerStatus, Value: strconv.Itoa(int(e.status.Code()))})
	if message := e.status.Message(); message != "" {
		entries = append(entries, engine.HeaderEntry{Key: headerMessage, Value: message})
	}
	return entries
}

func flatten(pairs metadata.MD) []engine.HeaderEntry {
	keys := make([]string, 0, len(pairs))
	for key := range pairs {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var entries []engine.HeaderEntry
	for _, key := range keys {
		for _, value := range pairs[key] {
			if strings.HasSuffix(key, binaryKeySuffix) {
				value = base64.StdEncoding.EncodeToString([]byte(value))
			}
			entries = append(entries, engine.HeaderEntry{Key: key, Value: value})
		}
	}
	return entries
}

func codeName(code codes.Code) string {
	if name, ok := codepb.Code_name[int32(code)]; ok {
		return name
	}
	return code.String()
}
