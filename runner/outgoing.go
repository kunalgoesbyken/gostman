package runner

import (
	"context"
	"errors"
	"slices"

	"github.com/kunalgoesbyken/gostman/engine"
)

var (
	errNotHTTP   = errors.New("only HTTP requests can be sent repeatedly; gRPC, MCP and WebSocket requests are not supported")
	errStreaming = errors.New("a streaming request cannot be sent repeatedly; turn streaming off for it")
)

func (s *Session) Outgoing(ctx context.Context, request Request) (engine.Request, error) {
	prepared, _, err := s.OutgoingWithheld(ctx, request)
	return prepared, err
}

func (s *Session) OutgoingWithheld(ctx context.Context, request Request) (engine.Request, []string, error) {
	if request.Method == grpcMethod || request.Method == mcpMethod {
		return engine.Request{}, nil, errNotHTTP
	}
	socket, err := s.state.isSocket(request)
	if err != nil {
		return engine.Request{}, nil, err
	}
	if socket {
		return engine.Request{}, nil, errNotHTTP
	}
	request, dropped := s.state.vetted(request)
	request, err = s.state.withFreshToken(ctx, request)
	if err != nil {
		return engine.Request{}, append(dropped, heldBy(err)...), err
	}
	prepared, err := s.state.httpRequest(request)
	if err != nil {
		return engine.Request{}, nil, err
	}
	if prepared.Options.Stream {
		return engine.Request{}, nil, errStreaming
	}
	certain, possible := s.state.withheldFrom(request)
	return prepared, slices.Concat(dropped, certain, heldAmong(prepared, possible)), nil
}

func heldBy(err error) []string {
	var held *withheldError
	if errors.As(err, &held) {
		return held.names
	}
	return nil
}

func heldAmong(prepared engine.Request, possible []string) []string {
	checked, err := engine.Prepare(prepared)
	if err != nil {
		return nil
	}
	_, held := parted(checked.Unresolved, possible)
	return held
}
