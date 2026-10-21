package runner

import (
	"context"
	"errors"

	"github.com/kunalgoesbyken/gostman/engine"
)

var (
	errNotHTTP   = errors.New("only HTTP requests can be sent repeatedly; gRPC, MCP and WebSocket requests are not supported")
	errStreaming = errors.New("a streaming request cannot be sent repeatedly; turn streaming off for it")
)

func (s *Session) Outgoing(ctx context.Context, request Request) (engine.Request, error) {
	if request.Method == grpcMethod || request.Method == mcpMethod {
		return engine.Request{}, errNotHTTP
	}
	socket, err := s.state.isSocket(request)
	if err != nil {
		return engine.Request{}, err
	}
	if socket {
		return engine.Request{}, errNotHTTP
	}
	request, err = s.state.withFreshToken(ctx, request)
	if err != nil {
		return engine.Request{}, err
	}
	prepared, err := s.state.httpRequest(request)
	if err != nil {
		return engine.Request{}, err
	}
	if prepared.Options.Stream {
		return engine.Request{}, errStreaming
	}
	return prepared, nil
}
