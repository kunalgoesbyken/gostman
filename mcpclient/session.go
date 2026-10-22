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

	farewellTimeout = 2 * time.Second
)

type greeting struct {
	mcp.InitializeParams
	Capabilities mcp.Empty          `json:"capabilities"`
	ClientInfo   mcp.Implementation `json:"clientInfo"`
}

type link interface {
	roundTrip(ctx context.Context, id json.RawMessage, message mcp.Message, limit int64) (answer, envelope, error)
	deliver(ctx context.Context, payload any) error
	established(sessionID, version string)
	close()
}

type session struct {
	link      link
	address   string
	expansion *engine.Expansion
	limit     int64
	sequence  int
}

func open(ctx context.Context, target Target, policy engine.Policy) (*session, error) {
	expansion, err := engine.NewExpansion(target.Variables)
	if err != nil {
		return nil, configError("%v", err)
	}
	if command, ok := commandLine(target.URL); ok {
		return openCommand(ctx, command, target, expansion, policy)
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
		link:      &httpLink{client: newClient(target.Options, policy), address: prepared.URL, headers: prepared.Headers},
		address:   prepared.URL,
		expansion: expansion,
		limit:     policy.ResponseLimit(),
	}, nil
}

func clientVersion() string {
	if build, ok := debug.ReadBuildInfo(); ok && build.Main.Version != "" {
		return build.Main.Version
	}
	return unknownVersion
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

func (s *session) deliver(ctx context.Context, payload any) error {
	return s.link.deliver(ctx, payload)
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
	received, reply, err := s.link.roundTrip(ctx, id, message, s.limit)
	if err != nil {
		return answer{}, err
	}
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
	s.link.established(received.header.Get(headerSession), welcome.ProtocolVersion)
	return welcome, s.notify(ctx, mcp.MethodInitialized)
}

func (s *session) close() {
	s.link.close()
}
