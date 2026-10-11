package mock

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/krockxz/gostman/engine"
)

const (
	methodGraphQL = "GRAPHQL"
	methodGRPC    = "GRPC"
	methodMCP     = "MCP"

	reasonGraphQL   = "GraphQL requests are not served."
	reasonGRPC      = "gRPC requests are not served."
	reasonMCP       = "MCP requests are not served."
	reasonWebSocket = "WebSocket requests are not served."
	reasonNoExample = "Save a response as an example to serve this route."
)

var socketSchemes = []string{"ws://", "wss://"}

type servedRoute struct {
	name   string
	method string
	shape  pattern
	answer answer
}

type table struct {
	routes []Route
	served []servedRoute
	owners map[string]string
}

func Plan(sources []Source, variables string) ([]Route, error) {
	planned, err := buildTable(sources, variables)
	if err != nil {
		return nil, err
	}
	return planned.routes, nil
}

func buildTable(sources []Source, variables string) (*table, error) {
	expansion, err := engine.NewExpansion(variables)
	if err != nil {
		return nil, err
	}
	planned := &table{routes: make([]Route, 0, len(sources)), owners: map[string]string{}}
	for _, source := range sources {
		planned.routes = append(planned.routes, planned.admit(source, expansion.Text))
	}
	if err := expansion.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(planned.served, func(i, j int) bool {
		return planned.served[i].shape.rank() < planned.served[j].shape.rank()
	})
	return planned, nil
}

func (t *table) admit(source Source, expand func(string) string) Route {
	route := Route{RequestID: source.ID, Name: source.Name, Method: methodOf(source)}
	if reason := unservedReason(route.Method, expand(source.URL)); reason != "" {
		return route.withState(StateSkipped, reason)
	}
	shape := routePattern(source.URL, expand)
	route.Path = shape.String()

	example, found := selectExample(parseExamples(source.Examples), source.ExampleID)
	if !found {
		return route.withState(StateNoExample, reasonNoExample)
	}
	route.ExampleID, route.ExampleName = example.ID, example.Name
	served, err := answerFrom(example)
	if err != nil {
		return route.withState(StateSkipped, err.Error())
	}

	key := route.Method + " " + shape.key()
	if owner, taken := t.owners[key]; taken {
		return route.withState(StateConflict, fmt.Sprintf("%s %s is already served by %q.", route.Method, route.Path, owner))
	}
	t.owners[key] = source.Name
	t.served = append(t.served, servedRoute{name: source.Name, method: route.Method, shape: shape, answer: served})
	return route.withState(StateServed, "")
}

func (t *table) find(method string, parts []string) (servedRoute, bool) {
	for _, candidate := range t.served {
		if candidate.method == method && candidate.shape.matches(parts) {
			return candidate, true
		}
	}
	return servedRoute{}, false
}

func (r Route) withState(state, reason string) Route {
	r.State, r.Reason = state, reason
	return r
}

func methodOf(source Source) string {
	method := strings.ToUpper(strings.TrimSpace(source.Method))
	if method == "" {
		return http.MethodGet
	}
	return method
}

func unservedReason(method, address string) string {
	if method == methodGraphQL {
		return reasonGraphQL
	}
	if method == methodGRPC {
		return reasonGRPC
	}
	if method == methodMCP {
		return reasonMCP
	}
	if isSocketAddress(address) {
		return reasonWebSocket
	}
	return ""
}

func isSocketAddress(address string) bool {
	lowered := strings.ToLower(strings.TrimSpace(address))
	for _, scheme := range socketSchemes {
		if strings.HasPrefix(lowered, scheme) {
			return true
		}
	}
	return false
}
