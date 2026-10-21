package mcpclient

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
)

func Invoke(ctx context.Context, call Call, policy engine.Policy) engine.Response {
	started := time.Now()
	response := invoke(ctx, call, policy)
	response.DurationMs = time.Since(started).Milliseconds()
	return response
}

func invoke(ctx context.Context, call Call, policy engine.Policy) engine.Response {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(call.Target.Options))
	defer cancel()

	session, err := open(call.Target, policy)
	if err != nil {
		return classify(ctx, err).response()
	}
	defer session.close()

	received, err := session.callTool(ctx, call)
	if err != nil {
		return session.failed(ctx, err)
	}
	return received.outcome(session.address)
}

func (s *session) callTool(ctx context.Context, call Call) (answer, error) {
	params, err := s.toolCall(call)
	if err != nil {
		return answer{}, err
	}
	if _, err := s.initialize(ctx); err != nil {
		return answer{}, err
	}
	return s.request(ctx, mcp.MethodCallTool, params)
}

func (s *session) toolCall(call Call) (mcp.CallParams, error) {
	name := strings.TrimSpace(s.expansion.Text(call.Tool))
	arguments := strings.TrimSpace(s.expansion.Text(call.Arguments))
	if err := s.expansion.Err(); err != nil {
		return mcp.CallParams{}, configError("%v", err)
	}
	if name == "" {
		return mcp.CallParams{}, configError("choose a tool to call")
	}
	if arguments == "" {
		arguments = noArguments
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal([]byte(arguments), &object); err != nil {
		return mcp.CallParams{}, configError("the arguments are not a JSON object: %v", err)
	}
	if object == nil {
		return mcp.CallParams{}, configError("the arguments are not a JSON object")
	}
	return mcp.CallParams{Name: name, Arguments: json.RawMessage(arguments)}, nil
}

func (s *session) failed(ctx context.Context, err error) engine.Response {
	var rejected *rejection
	if errors.As(err, &rejected) {
		return rejected.response(s.address)
	}
	var refused *refusal
	if errors.As(err, &refused) {
		return refused.response(s.address)
	}
	return classify(ctx, err).response()
}
