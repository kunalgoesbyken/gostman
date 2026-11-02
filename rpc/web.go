package rpc

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/dynamicpb"
)

const (
	TransportGRPC        = ""
	TransportGRPCWeb     = "grpc-web"
	TransportGRPCWebText = "grpc-web-text"
	TransportConnect     = "connect"

	contentGRPCWeb     = "application/grpc-web+proto"
	contentGRPCWebText = "application/grpc-web-text+proto"
	contentConnectJSON = "application/json"
	contentConnectEnv  = "application/connect+json"

	frameHeaderSize = 5
	flagCompressed  = 0x01
	flagTrailers    = 0x80
	flagEndStream   = 0x02

	headerConnectVersion = "Connect-Protocol-Version"
	headerConnectTimeout = "Connect-Timeout-Ms"
)

var connectCodes = map[string]codes.Code{
	"canceled":            codes.Canceled,
	"unknown":             codes.Unknown,
	"invalid_argument":    codes.InvalidArgument,
	"deadline_exceeded":   codes.DeadlineExceeded,
	"not_found":           codes.NotFound,
	"already_exists":      codes.AlreadyExists,
	"permission_denied":   codes.PermissionDenied,
	"resource_exhausted":  codes.ResourceExhausted,
	"failed_precondition": codes.FailedPrecondition,
	"aborted":             codes.Aborted,
	"out_of_range":        codes.OutOfRange,
	"unimplemented":       codes.Unimplemented,
	"internal":            codes.Internal,
	"unavailable":         codes.Unavailable,
	"data_loss":           codes.DataLoss,
	"unauthenticated":     codes.Unauthenticated,
}

var httpCodes = map[int]codes.Code{
	http.StatusBadRequest:         codes.Internal,
	http.StatusUnauthorized:       codes.Unauthenticated,
	http.StatusForbidden:          codes.PermissionDenied,
	http.StatusNotFound:           codes.Unimplemented,
	http.StatusTooManyRequests:    codes.Unavailable,
	http.StatusBadGateway:         codes.Unavailable,
	http.StatusServiceUnavailable: codes.Unavailable,
	http.StatusGatewayTimeout:     codes.Unavailable,
}

type webCall struct {
	transport  string
	url        string
	descriptor protoreflect.MethodDescriptor
	format     format
	messages   []proto.Message
	documents  [][]byte
	enveloped  bool
	limit      int64
}

func (s *session) callOverHTTP(ctx context.Context, call Call, limit int64) (*exchange, error) {
	prepared, err := s.prepareWeb(ctx, call, limit)
	if err != nil {
		return nil, err
	}
	request, err := prepared.request(ctx, s.metadata)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Transport:     s.policy.Transport(call.Target.Options.InsecureTLS),
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	return prepared.read(response)
}

func (s *session) prepareWeb(ctx context.Context, call Call, limit int64) (*webCall, error) {
	transport := call.Target.Options.RPCTransport
	if transport != TransportGRPCWeb && transport != TransportGRPCWebText && transport != TransportConnect {
		return nil, configError("unknown transport %q; use grpc-web, grpc-web-text or connect", transport)
	}
	service, method, found := strings.Cut(strings.TrimPrefix(strings.TrimSpace(call.Method), "/"), "/")
	if !found || service == "" || method == "" {
		return nil, configError("choose a method to call, such as package.Service/Method")
	}
	prepared := &webCall{transport: transport, url: s.methodURL(service, method), limit: limit}
	message := s.expansion.Text(call.Message)
	if err := s.expansion.Err(); err != nil {
		return nil, configError("%v", err)
	}
	if len(s.protos) == 0 {
		return prepared, prepared.withoutSchema(message)
	}
	descriptor, files, err := s.method(ctx, call.Method)
	if err != nil {
		return nil, err
	}
	return prepared, prepared.withSchema(descriptor, files, message)
}

func (s *session) methodURL(service, method string) string {
	scheme := "http"
	if s.address.secure {
		scheme = "https"
	}
	prefix := ""
	if parsed, err := url.Parse(withScheme(s.address.address)); err == nil {
		prefix = strings.TrimRight(parsed.Path, "/")
	}
	return scheme + "://" + s.address.authority + prefix + "/" + service + "/" + method
}

func (w *webCall) withoutSchema(message string) error {
	if w.transport != TransportConnect {
		return configError("%s sends protobuf, so it needs the .proto files; add them in the gRPC tab", w.transport)
	}
	text := strings.TrimSpace(message)
	if text == "" {
		text = emptyMessage
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, []byte(text)); err != nil {
		return configError("the message is not valid JSON: %v", err)
	}
	w.documents = [][]byte{compact.Bytes()}
	return nil
}

func (w *webCall) withSchema(descriptor protoreflect.MethodDescriptor, files *protoregistry.Files, message string) error {
	w.descriptor = descriptor
	w.format = newFormat(files)
	requests, err := w.format.requests(descriptor, message)
	if err != nil {
		return err
	}
	w.messages = requests
	w.enveloped = w.transport == TransportConnect && (descriptor.IsStreamingServer() || descriptor.IsStreamingClient())
	if w.transport != TransportConnect {
		return nil
	}
	for _, request := range requests {
		encoded, err := w.format.encode(request)
		if err != nil {
			return err
		}
		w.documents = append(w.documents, encoded)
	}
	return nil
}

func frame(flag byte, payload []byte) []byte {
	header := make([]byte, frameHeaderSize)
	header[0] = flag
	binary.BigEndian.PutUint32(header[1:], uint32(len(payload)))
	return append(header, payload...)
}

func (w *webCall) body() ([]byte, error) {
	var out bytes.Buffer
	if w.transport == TransportConnect {
		if !w.enveloped {
			return w.documents[0], nil
		}
		for _, document := range w.documents {
			out.Write(frame(0, document))
		}
		return out.Bytes(), nil
	}
	for _, message := range w.messages {
		encoded, err := proto.Marshal(message)
		if err != nil {
			return nil, err
		}
		out.Write(frame(0, encoded))
	}
	if w.transport == TransportGRPCWebText {
		return []byte(base64.StdEncoding.EncodeToString(out.Bytes())), nil
	}
	return out.Bytes(), nil
}

func (w *webCall) contentType() string {
	switch {
	case w.transport == TransportGRPCWeb:
		return contentGRPCWeb
	case w.transport == TransportGRPCWebText:
		return contentGRPCWebText
	case w.enveloped:
		return contentConnectEnv
	}
	return contentConnectJSON
}

func (w *webCall) request(ctx context.Context, outgoing metadata.MD) (*http.Request, error) {
	body, err := w.body()
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, w.url, bytes.NewReader(body))
	if err != nil {
		return nil, configError("%q cannot be used as an address: %v", w.url, err)
	}
	for key, values := range outgoing {
		for _, value := range values {
			request.Header.Add(key, value)
		}
	}
	request.Header.Set("Content-Type", w.contentType())
	if w.transport == TransportConnect {
		request.Header.Set(headerConnectVersion, "1")
		if deadline, ok := ctx.Deadline(); ok {
			request.Header.Set(headerConnectTimeout, strconv.FormatInt(max(1, time.Until(deadline).Milliseconds()), 10))
		}
		return request, nil
	}
	request.Header.Set("Accept", w.contentType())
	request.Header.Set("X-Grpc-Web", "1")
	return request, nil
}

func (w *webCall) read(response *http.Response) (*exchange, error) {
	raw, err := io.ReadAll(io.LimitReader(response.Body, w.limit+1))
	if err != nil {
		return nil, err
	}
	truncated := int64(len(raw)) > w.limit
	if truncated {
		raw = raw[:w.limit]
	}
	result := &exchange{status: status.New(codes.OK, ""), header: toMD(response.Header), trailer: metadata.MD{}, truncated: truncated}
	if w.descriptor != nil {
		result.serverStream = w.descriptor.IsStreamingServer()
	}
	if w.transport == TransportConnect {
		return result, w.readConnect(response, raw, result)
	}
	return result, w.readGRPCWeb(response, raw, result)
}

func toMD(header http.Header) metadata.MD {
	out := metadata.MD{}
	for key, values := range header {
		out[strings.ToLower(key)] = append([]string(nil), values...)
	}
	return out
}

func (w *webCall) readGRPCWeb(response *http.Response, raw []byte, result *exchange) error {
	if w.transport == TransportGRPCWebText || strings.Contains(response.Header.Get("Content-Type"), "grpc-web-text") {
		decoded, err := decodeBase64Chunks(string(raw))
		if err != nil {
			return fmt.Errorf("the response is not valid base64: %w", err)
		}
		raw = decoded
	}
	result.status = webStatus(response.Header, response.StatusCode)
	for len(raw) >= frameHeaderSize {
		flag := raw[0]
		size := int(binary.BigEndian.Uint32(raw[1:frameHeaderSize]))
		if frameHeaderSize+size > len(raw) {
			return fmt.Errorf("the response ends inside a message")
		}
		payload := raw[frameHeaderSize : frameHeaderSize+size]
		raw = raw[frameHeaderSize+size:]
		switch {
		case flag&flagCompressed != 0:
			return fmt.Errorf("the response is compressed, which is not supported")
		case flag&flagTrailers != 0:
			trailers := parseTrailers(payload)
			result.trailer = trailers
			result.status = webStatus(http.Header(trailerHeader(trailers)), http.StatusOK)
		default:
			if err := w.addMessage(result, payload); err != nil {
				return err
			}
		}
	}
	return nil
}

func (w *webCall) addMessage(result *exchange, payload []byte) error {
	reply := dynamicpb.NewMessage(w.descriptor.Output())
	if err := proto.Unmarshal(payload, reply); err != nil {
		return fmt.Errorf("a response message is not a valid %s: %w", w.descriptor.Output().FullName(), err)
	}
	encoded, err := w.format.encode(reply)
	if err != nil {
		return fmt.Errorf("a response message cannot be shown as JSON: %w", err)
	}
	result.messages = append(result.messages, encoded)
	result.size += int64(len(encoded))
	return nil
}

func parseTrailers(payload []byte) metadata.MD {
	trailers := metadata.MD{}
	for _, line := range strings.Split(string(payload), "\r\n") {
		key, value, found := strings.Cut(line, ":")
		if found {
			key = strings.ToLower(strings.TrimSpace(key))
			trailers[key] = append(trailers[key], strings.TrimSpace(value))
		}
	}
	return trailers
}

func trailerHeader(trailers metadata.MD) map[string][]string {
	header := map[string][]string{}
	for key, values := range trailers {
		header[http.CanonicalHeaderKey(key)] = values
	}
	return header
}

func webStatus(header http.Header, httpStatus int) *status.Status {
	value := header.Get(headerStatus)
	if value == "" {
		if httpStatus == http.StatusOK {
			return status.New(codes.Unknown, "the response has no grpc-status")
		}
		return status.New(httpCode(httpStatus), http.StatusText(httpStatus))
	}
	number, err := strconv.Atoi(value)
	if err != nil {
		return status.New(codes.Unknown, "grpc-status is not a number: "+value)
	}
	message := header.Get(headerMessage)
	if unescaped, err := url.PathUnescape(message); err == nil {
		message = unescaped
	}
	return status.New(codes.Code(number), message)
}

func httpCode(httpStatus int) codes.Code {
	if code, ok := httpCodes[httpStatus]; ok {
		return code
	}
	return codes.Unknown
}

func (w *webCall) readConnect(response *http.Response, raw []byte, result *exchange) error {
	if strings.HasPrefix(response.Header.Get("Content-Type"), contentConnectEnv) {
		return readEnvelopes(raw, result)
	}
	if response.StatusCode == http.StatusOK {
		var compact bytes.Buffer
		if err := json.Compact(&compact, raw); err != nil {
			return fmt.Errorf("the response is not JSON: %w", err)
		}
		result.messages = [][]byte{compact.Bytes()}
		result.size = int64(compact.Len())
		return nil
	}
	result.status = connectStatus(raw, response.StatusCode)
	return nil
}

func readEnvelopes(raw []byte, result *exchange) error {
	for len(raw) >= frameHeaderSize {
		flag := raw[0]
		size := int(binary.BigEndian.Uint32(raw[1:frameHeaderSize]))
		if frameHeaderSize+size > len(raw) {
			return fmt.Errorf("the response ends inside a message")
		}
		payload := raw[frameHeaderSize : frameHeaderSize+size]
		raw = raw[frameHeaderSize+size:]
		switch {
		case flag&flagCompressed != 0:
			return fmt.Errorf("the response is compressed, which is not supported")
		case flag&flagEndStream != 0:
			result.status = connectEndStatus(payload, result)
		default:
			var compact bytes.Buffer
			if err := json.Compact(&compact, payload); err != nil {
				return fmt.Errorf("a response message is not JSON: %w", err)
			}
			result.messages = append(result.messages, compact.Bytes())
			result.size += int64(compact.Len())
			result.serverStream = true
		}
	}
	return nil
}

func connectEndStatus(payload []byte, result *exchange) *status.Status {
	var end struct {
		Error    json.RawMessage     `json:"error"`
		Metadata map[string][]string `json:"metadata"`
	}
	if json.Unmarshal(payload, &end) != nil {
		return status.New(codes.Unknown, "the end of the stream could not be read")
	}
	for key, values := range end.Metadata {
		result.trailer[strings.ToLower(key)] = values
	}
	if len(end.Error) == 0 || string(end.Error) == "null" {
		return status.New(codes.OK, "")
	}
	return connectStatus(end.Error, http.StatusOK)
}

func connectStatus(raw []byte, httpStatus int) *status.Status {
	var failure struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	if json.Unmarshal(raw, &failure) != nil || failure.Code == "" {
		return status.New(httpCode(httpStatus), http.StatusText(httpStatus))
	}
	code, known := connectCodes[failure.Code]
	if !known {
		code = codes.Unknown
	}
	return status.New(code, failure.Message)
}

func decodeBase64Chunks(text string) ([]byte, error) {
	text = strings.Join(strings.Fields(text), "")
	var out []byte
	for text != "" {
		end := strings.IndexByte(text, '=')
		if end < 0 {
			end = len(text)
		} else {
			for end < len(text) && text[end] == '=' {
				end++
			}
		}
		chunk, err := base64.StdEncoding.DecodeString(text[:end])
		if err != nil {
			chunk, err = base64.RawStdEncoding.DecodeString(text[:end])
		}
		if err != nil {
			return nil, err
		}
		out = append(out, chunk...)
		text = text[end:]
	}
	return out, nil
}
