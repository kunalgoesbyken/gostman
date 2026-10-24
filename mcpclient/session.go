package mcpclient

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime/debug"
	"strconv"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	clientName     = "Gostman"
	unknownVersion = "dev"

	farewellTimeout  = 2 * time.Second
	maxNotifications = 500
	maxStateRetries  = 3
)

type greeting struct {
	mcp.InitializeParams
	Capabilities mcp.Empty          `json:"capabilities"`
	ClientInfo   mcp.Implementation `json:"clientInfo"`
}

type outgoing struct {
	id      json.RawMessage
	message mcp.Message
	header  http.Header
}

type link interface {
	roundTrip(ctx context.Context, request outgoing, limit int64) (answer, envelope, error)
	deliver(ctx context.Context, payload any) error
	established(sessionID, version string)
	close()
}

type rpc struct {
	method string
	params any
	name   string
	extra  http.Header
}

type session struct {
	link      link
	reopen    func(context.Context) (link, error)
	address   string
	expansion *engine.Expansion
	limit     int64
	sequence  int
	modern    bool
	version   string
	server    welcome
	started   time.Time
	notices   []engine.Notification
}

func open(ctx context.Context, target Target, policy engine.Policy) (*session, error) {
	expansion, err := engine.NewExpansion(target.Variables)
	if err != nil {
		return nil, configError("%v", err)
	}
	if command, ok := commandLine(target.URL); ok {
		return openCommand(ctx, command, target, expansion, policy)
	}
	prepared, err := prepareHTTP(target)
	if err != nil {
		return nil, err
	}
	return &session{
		link:      &httpLink{client: newClient(target.Options, policy), address: prepared.URL, headers: prepared.Headers},
		address:   prepared.URL,
		expansion: expansion,
		limit:     policy.ResponseLimit(),
		started:   time.Now(),
	}, nil
}

func prepareHTTP(target Target) (engine.Prepared, error) {
	prepared, err := engine.Prepare(engine.Request{
		Method:    http.MethodPost,
		URL:       target.URL,
		Headers:   target.Headers,
		Auth:      target.Auth,
		Inherited: target.Inherited,
		Variables: target.Variables,
	})
	if err != nil {
		return engine.Prepared{}, configError("%v", err)
	}
	return prepared, nil
}

func clientVersion() string {
	if build, ok := debug.ReadBuildInfo(); ok && build.Main.Version != "" {
		return build.Main.Version
	}
	return unknownVersion
}

func clientInfo() mcp.Implementation {
	return mcp.Implementation{Name: clientName, Version: clientVersion()}
}

func encodeObject(params any) (json.RawMessage, error) {
	if params == nil {
		return json.RawMessage("{}"), nil
	}
	return json.Marshal(params)
}

func withField(object json.RawMessage, name string, value any) (json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(object, &fields); err != nil {
		return nil, err
	}
	if fields == nil {
		fields = map[string]json.RawMessage{}
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	fields[name] = encoded
	return json.Marshal(fields)
}

func (s *session) meta(method string) map[string]any {
	meta := map[string]any{}
	if s.modern {
		meta[metaVersion] = s.version
		meta[metaClientInfo] = clientInfo()
		meta[metaCapabilities] = mcp.Empty{}
		meta[metaLogLevel] = logLevelDebug
	}
	if operations[method] {
		meta[metaProgress] = strconv.Itoa(s.sequence + 1)
	}
	return meta
}

func (s *session) params(method string, params any) (json.RawMessage, error) {
	encoded, err := encodeObject(params)
	if err != nil {
		return nil, configError("the %s parameters cannot be encoded: %v", method, err)
	}
	meta := s.meta(method)
	if len(meta) == 0 {
		return encoded, nil
	}
	encoded, err = withField(encoded, fieldMeta, meta)
	if err != nil {
		return nil, configError("the %s parameters cannot be encoded: %v", method, err)
	}
	return encoded, nil
}

func (s *session) header(request rpc) http.Header {
	if !s.modern {
		return nil
	}
	header := http.Header{}
	header.Set(headerMethod, request.method)
	if request.name != "" {
		header.Set(headerName, headerValue(request.name))
	}
	for name, values := range request.extra {
		header[name] = values
	}
	return header
}

func (s *session) record(notices []notice) {
	for _, received := range notices {
		if len(s.notices) == maxNotifications {
			return
		}
		s.notices = append(s.notices, engine.Notification{
			Method: received.method,
			Params: string(received.params),
			AtMs:   received.at.Sub(s.started).Milliseconds(),
		})
	}
}

func (s *session) exchange(ctx context.Context, request rpc, params json.RawMessage) (answer, error) {
	s.sequence++
	id := json.RawMessage(strconv.Itoa(s.sequence))
	message := mcp.Message{Version: mcp.JSONRPCVersion, ID: id, Method: request.method, Params: params}
	received, reply, err := s.link.roundTrip(ctx, outgoing{id: id, message: message, header: s.header(request)}, s.limit)
	s.record(received.notices)
	if err != nil {
		return answer{}, err
	}
	received.result = reply.Result
	if reply.Error != nil {
		return answer{}, &refusal{answer: received, method: request.method, reason: *reply.Error}
	}
	if len(reply.Result) == 0 {
		return answer{}, protocolError("the server answered %s with neither a result nor an error", request.method)
	}
	return received, nil
}

func (s *session) call(ctx context.Context, request rpc) (answer, error) {
	params, err := s.params(request.method, request.params)
	if err != nil {
		return answer{}, err
	}
	for attempt := 0; ; attempt++ {
		received, err := s.exchange(ctx, request, params)
		if err != nil {
			return answer{}, err
		}
		var header resultHeader
		json.Unmarshal(received.result, &header)
		switch header.ResultType {
		case "", resultComplete:
			return received, nil
		case resultInputRequired:
		default:
			return answer{}, protocolError("the server answered %s with the unknown resultType %q", request.method, header.ResultType)
		}
		if len(header.InputRequests) > 0 || header.RequestState == "" || attempt == maxStateRetries {
			received.pending = true
			return received, nil
		}
		if params, err = withField(params, fieldRequestState, header.RequestState); err != nil {
			return answer{}, protocolError("the request state cannot be sent back: %v", err)
		}
	}
}

func (s *session) request(ctx context.Context, method string, params any) (answer, error) {
	return s.call(ctx, rpc{method: method, params: params})
}

func (s *session) notify(ctx context.Context, method string) error {
	return s.link.deliver(ctx, mcp.Message{Version: mcp.JSONRPCVersion, Method: method})
}

func (s *session) close() {
	s.link.close()
}
