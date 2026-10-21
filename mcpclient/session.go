package mcpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcp"
)

const (
	headerAccept      = "Accept"
	headerContentType = "Content-Type"
	headerSession     = "Mcp-Session-Id"
	headerVersion     = "Mcp-Protocol-Version"

	typeJSON      = "application/json"
	typeStream    = "text/event-stream"
	acceptedTypes = typeJSON + ", " + typeStream

	clientName     = "Gostman"
	unknownVersion = "dev"

	farewellTimeout = 2 * time.Second
)

type greeting struct {
	mcp.InitializeParams
	Capabilities mcp.Empty          `json:"capabilities"`
	ClientInfo   mcp.Implementation `json:"clientInfo"`
}

type session struct {
	client    *http.Client
	address   string
	headers   []engine.HeaderEntry
	expansion *engine.Expansion
	limit     int64
	id        string
	version   string
	sequence  int
}

func open(target Target, policy engine.Policy) (*session, error) {
	expansion, err := engine.NewExpansion(target.Variables)
	if err != nil {
		return nil, configError("%v", err)
	}
	prepared, err := engine.Prepare(engine.Request{
		Method:    http.MethodPost,
		URL:       target.URL,
		Headers:   target.Headers,
		Auth:      target.Auth,
		Inherited: target.Inherited,
		Variables: target.Variables,
	})
	if err != nil {
		return nil, configError("%v", err)
	}
	return &session{
		client:    newClient(target.Options, policy),
		address:   prepared.URL,
		headers:   prepared.Headers,
		expansion: expansion,
		limit:     policy.ResponseLimit(),
	}, nil
}

func newClient(options engine.Options, policy engine.Policy) *http.Client {
	client := &http.Client{Transport: policy.Transport(options.InsecureTLS)}
	if options.NoFollowRedirects {
		client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	}
	return client
}

func clientVersion() string {
	if build, ok := debug.ReadBuildInfo(); ok && build.Main.Version != "" {
		return build.Main.Version
	}
	return unknownVersion
}

func setDefault(header http.Header, name, value string) {
	if value != "" && header.Get(name) == "" {
		header.Set(name, value)
	}
}

func (s *session) header() http.Header {
	header := http.Header{}
	for _, entry := range s.headers {
		header.Add(entry.Key, entry.Value)
	}
	setDefault(header, headerAccept, acceptedTypes)
	setDefault(header, headerContentType, typeJSON)
	setDefault(header, headerSession, s.id)
	setDefault(header, headerVersion, s.version)
	return header
}

func (s *session) exchange(ctx context.Context, method string, body io.Reader) (*http.Response, error) {
	outgoing, err := http.NewRequestWithContext(ctx, method, s.address, body)
	if err != nil {
		return nil, configError("%v", err)
	}
	outgoing.Header = s.header()
	return s.client.Do(outgoing)
}

func (s *session) post(ctx context.Context, payload any) (*http.Response, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, configError("the message cannot be encoded: %v", err)
	}
	return s.exchange(ctx, http.MethodPost, bytes.NewReader(encoded))
}

func compose(id json.RawMessage, method string, params any) (mcp.Message, error) {
	message := mcp.Message{Version: mcp.JSONRPCVersion, ID: id, Method: method}
	if params == nil {
		return message, nil
	}
	encoded, err := json.Marshal(params)
	if err != nil {
		return message, configError("the %s parameters cannot be encoded: %v", method, err)
	}
	message.Params = encoded
	return message, nil
}

func isAccepted(incoming *http.Response) bool {
	return incoming.StatusCode >= http.StatusOK && incoming.StatusCode < http.StatusMultipleChoices
}

func (s *session) bounded(incoming *http.Response) *io.LimitedReader {
	return &io.LimitedReader{R: incoming.Body, N: s.limit + 1}
}

func (s *session) tooLarge() error {
	return protocolError("the server's answer is larger than the limit of %d bytes", s.limit)
}

func describeAnswer(incoming *http.Response) answer {
	return answer{status: incoming.Status, code: incoming.StatusCode, header: incoming.Header}
}

func (s *session) rejected(incoming *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(incoming.Body, s.limit))
	return &rejection{answer: describeAnswer(incoming), body: strings.ToValidUTF8(string(body), "�")}
}

func (s *session) deliver(ctx context.Context, payload any) error {
	incoming, err := s.post(ctx, payload)
	if err != nil {
		return err
	}
	defer incoming.Body.Close()
	if !isAccepted(incoming) {
		return s.rejected(incoming)
	}
	return nil
}

func (s *session) notify(ctx context.Context, method string) error {
	message, err := compose(nil, method, nil)
	if err != nil {
		return err
	}
	return s.deliver(ctx, message)
}

func (s *session) request(ctx context.Context, method string, params any) (answer, error) {
	s.sequence++
	id := json.RawMessage(strconv.Itoa(s.sequence))
	message, err := compose(id, method, params)
	if err != nil {
		return answer{}, err
	}
	incoming, err := s.post(ctx, message)
	if err != nil {
		return answer{}, err
	}
	defer incoming.Body.Close()
	if !isAccepted(incoming) {
		return answer{}, s.rejected(incoming)
	}

	reply, err := s.reply(ctx, incoming, id)
	if err != nil {
		return answer{}, err
	}
	received := describeAnswer(incoming)
	received.result = reply.Result
	if reply.Error != nil {
		return answer{}, &refusal{answer: received, method: method, reason: *reply.Error}
	}
	if len(reply.Result) == 0 {
		return answer{}, protocolError("the server answered %s with neither a result nor an error", method)
	}
	return received, nil
}

func (s *session) initialize(ctx context.Context) (mcp.InitializeResult, error) {
	var welcome mcp.InitializeResult
	received, err := s.request(ctx, mcp.MethodInitialize, greeting{
		InitializeParams: mcp.InitializeParams{ProtocolVersion: mcp.ProtocolVersions[0]},
		ClientInfo:       mcp.Implementation{Name: clientName, Version: clientVersion()},
	})
	if err != nil {
		return welcome, err
	}
	if err := json.Unmarshal(received.result, &welcome); err != nil {
		return welcome, protocolError("the initialize result cannot be read: %v", err)
	}
	s.id = received.header.Get(headerSession)
	s.version = welcome.ProtocolVersion
	return welcome, s.notify(ctx, mcp.MethodInitialized)
}

func (s *session) close() {
	if s.id == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), farewellTimeout)
	defer cancel()
	if incoming, err := s.exchange(ctx, http.MethodDelete, nil); err == nil {
		incoming.Body.Close()
	}
}
