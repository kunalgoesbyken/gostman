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

var listKeys = map[string]string{
	MethodListTools:     "tools",
	MethodListResources: "resources",
	MethodListTemplates: "resourceTemplates",
	MethodListPrompts:   "prompts",
}

type uriParams struct {
	URI string `json:"uri"`
}

func Invoke(ctx context.Context, call Call, policy engine.Policy) engine.Response {
	started := time.Now()
	response := invoke(ctx, call, policy)
	response.DurationMs = time.Since(started).Milliseconds()
	return response
}

func invoke(ctx context.Context, call Call, policy engine.Policy) engine.Response {
	ctx, cancel := context.WithTimeout(ctx, policy.Timeout(call.Target.Options))
	defer cancel()

	session, err := open(ctx, call.Target, policy)
	if err != nil {
		return classify(ctx, err).response()
	}
	defer session.close()

	request, err := session.operation(call)
	if err != nil {
		return classify(ctx, err).response()
	}
	if err := session.connect(ctx); err != nil {
		return session.failed(ctx, err)
	}
	received, err := session.perform(ctx, request)
	if err != nil {
		return session.failed(ctx, err)
	}
	return session.outcome(received, request.method)
}

func methodOf(call Call) string {
	if method := strings.TrimSpace(call.Method); method != "" {
		return method
	}
	return MethodCallTool
}

func (s *session) operation(call Call) (rpc, error) {
	method := methodOf(call)
	name := strings.TrimSpace(s.expansion.Text(call.Name))
	arguments := strings.TrimSpace(s.expansion.Text(call.Arguments))
	if err := s.expansion.Err(); err != nil {
		return rpc{}, configError("%v", err)
	}
	if _, isList := listKeys[method]; isList {
		return rpc{method: method}, nil
	}
	switch method {
	case MethodCallTool:
		return namedCall(method, name, arguments, "choose a tool to call")
	case MethodGetPrompt:
		return namedCall(method, name, arguments, "choose a prompt to get")
	case MethodReadResource:
		if name == "" {
			return rpc{}, configError("enter the URI of the resource to read")
		}
		return rpc{method: method, params: uriParams{URI: name}, name: name}, nil
	default:
		return rpc{}, configError("Gostman does not know the MCP operation %q", method)
	}
}

func namedCall(method, name, arguments, missing string) (rpc, error) {
	if name == "" {
		return rpc{}, configError("%s", missing)
	}
	if arguments == "" {
		arguments = noArguments
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal([]byte(arguments), &object); err != nil {
		return rpc{}, configError("the arguments are not a JSON object: %v", err)
	}
	if object == nil {
		return rpc{}, configError("the arguments are not a JSON object")
	}
	return rpc{method: method, params: mcp.CallParams{Name: name, Arguments: json.RawMessage(arguments)}, name: name}, nil
}

func (s *session) perform(ctx context.Context, request rpc) (answer, error) {
	if _, isList := listKeys[request.method]; isList {
		return s.listing(ctx, request.method)
	}
	received, err := s.call(ctx, request)
	if request.method != MethodCallTool || !s.mirrorsHeaders() || !isHeaderMismatch(err) {
		return received, err
	}
	extra, found, listErr := s.toolHeaders(ctx, request)
	if listErr != nil || !found {
		return received, err
	}
	request.extra = extra
	return s.call(ctx, request)
}

func (s *session) listing(ctx context.Context, method string) (answer, error) {
	items, last, err := listAll[json.RawMessage](ctx, newLister(s), method)
	if err != nil {
		return answer{}, err
	}
	body, err := json.Marshal(map[string][]json.RawMessage{listKeys[method]: items})
	if err != nil {
		return answer{}, protocolError("the %s result cannot be encoded: %v", method, err)
	}
	last.result = body
	return last, nil
}

func isHeaderMismatch(err error) bool {
	var refused *refusal
	if errors.As(err, &refused) {
		return refused.reason.Code == codeHeaderMismatch
	}
	var rejected *rejection
	if !errors.As(err, &rejected) {
		return false
	}
	var body refusalBody
	return json.Unmarshal([]byte(rejected.body), &body) == nil && body.Error.Code == codeHeaderMismatch
}

func (s *session) failed(ctx context.Context, err error) engine.Response {
	var rejected *rejection
	if errors.As(err, &rejected) {
		return s.respond(rejected.answer, rejected.status, mediaType(rejected.header), []byte(rejected.body), true)
	}
	var refused *refusal
	if errors.As(err, &refused) {
		body, encodeErr := json.Marshal(refusalBody{refused.reason})
		if encodeErr != nil {
			return engine.Failure(engine.ErrorNetwork, refused.Error())
		}
		return s.respond(refused.answer, statusRefused, typeJSON, body, true)
	}
	return classify(ctx, err).response()
}
