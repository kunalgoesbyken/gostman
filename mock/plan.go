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

	maxRoutes = 10_000

	reasonGraphQL   = "GraphQL requests are not served."
	reasonGRPC      = "gRPC requests are not served."
	reasonMCP       = "MCP requests are not served."
	reasonWebSocket = "WebSocket requests are not served."
	reasonNoExample = "Save a response as an example to serve this route."
	reasonDisabled  = "This route is switched off."
)

var socketSchemes = []string{"ws://", "wss://"}

type servedRoute struct {
	name         string
	method       string
	shape        pattern
	answer       answer
	alternatives map[string]answer
	behavior     Behavior
}

type table struct {
	routes    []Route
	served    []servedRoute
	rules     []*compiledRule
	owners    map[string]string
	variables string
	settings  Settings
}

func Plan(sources []Source, variables string, config Config) ([]Route, error) {
	planned, err := buildTable(sources, variables, config)
	if err != nil {
		return nil, err
	}
	return planned.routes, nil
}

func buildTable(sources []Source, variables string, config Config) (*table, error) {
	if err := config.Settings.Behavior.validate(); err != nil {
		return nil, err
	}
	composed := config.compose(sources)
	if len(composed) > maxRoutes {
		return nil, fmt.Errorf("the mock server serves at most %d routes, but %d were given", maxRoutes, len(composed))
	}
	expansion, err := engine.NewExpansion(variables)
	if err != nil {
		return nil, err
	}
	rules, err := compileRules(config.Rules)
	if err != nil {
		return nil, err
	}
	planned := &table{
		routes:    make([]Route, 0, len(composed)),
		owners:    map[string]string{},
		rules:     rules,
		variables: variables,
		settings:  config.Settings,
	}
	for _, source := range composed {
		route, err := planned.admit(source, expansion.Text)
		if err != nil {
			return nil, err
		}
		planned.routes = append(planned.routes, route)
	}
	if err := expansion.Err(); err != nil {
		return nil, err
	}
	sort.SliceStable(planned.served, func(i, j int) bool {
		return planned.served[i].shape.rank() < planned.served[j].shape.rank()
	})
	return planned, nil
}

func (t *table) admit(source Source, expand func(string) string) (Route, error) {
	route := Route{RequestID: source.ID, Name: source.Name, Method: methodOf(source)}
	if reason := unservedReason(route.Method, expand(source.URL)); reason != "" {
		return route.withState(StateSkipped, reason), nil
	}
	shape := shapeOf(source, expand)
	route.Path = shape.String()
	if source.Disabled {
		return route.withState(StateDisabled, reasonDisabled), nil
	}
	if err := source.Behavior.validate(); err != nil {
		return Route{}, fmt.Errorf("%s: %w", source.Name, err)
	}

	examples := parseExamples(source.Examples)
	example, found := selectExample(examples, source.ExampleID)
	if !found {
		return route.withState(StateNoExample, reasonNoExample), nil
	}
	route.ExampleID, route.ExampleName = example.ID, example.Name
	served, err := answerFrom(example)
	if err != nil {
		return route.withState(StateSkipped, err.Error()), nil
	}

	key := route.Method + " " + shape.key()
	if owner, taken := t.owners[key]; taken {
		return route.withState(StateConflict, fmt.Sprintf("%s %s is already served by %q.", route.Method, route.Path, owner)), nil
	}
	t.owners[key] = source.Name
	t.served = append(t.served, servedRoute{
		name:         source.Name,
		method:       route.Method,
		shape:        shape,
		answer:       served,
		alternatives: alternativesOf(examples),
		behavior:     source.Behavior,
	})
	return route.withState(StateServed, ""), nil
}

func shapeOf(source Source, expand func(string) string) pattern {
	if source.Path != "" {
		return templatePattern(source.Path, source.Types)
	}
	return routePattern(source.URL, expand)
}

func alternativesOf(examples []Example) map[string]answer {
	alternatives := make(map[string]answer, len(examples))
	for _, example := range examples {
		if served, err := answerFrom(example); err == nil {
			alternatives[example.ID] = served
		}
	}
	return alternatives
}

func (t *table) find(method string, parts []string) (servedRoute, map[string]string, bool) {
	for _, candidate := range t.served {
		if candidate.method != method {
			continue
		}
		if params, ok := candidate.shape.match(parts); ok {
			return candidate, params, true
		}
	}
	return servedRoute{}, nil, false
}

type decision struct {
	route    string
	rule     string
	answer   answer
	params   map[string]string
	behavior Behavior
}

func (t *table) resolve(e *exchange) (decision, bool) {
	route, params, routed := t.find(e.method, e.parts)
	for _, rule := range t.rules {
		ruleParams, matched := rule.matches(e)
		if !matched {
			continue
		}
		if rule.hasPath {
			params = ruleParams
		}
		return rule.decide(route, routed, params), true
	}
	if !routed {
		return decision{}, false
	}
	return decision{route: route.name, answer: route.answer, params: params, behavior: route.behavior}, true
}

func (r servedRoute) answerFor(exampleID string) answer {
	if alternative, ok := r.alternatives[exampleID]; ok {
		return alternative
	}
	return r.answer
}

func (r *compiledRule) decide(route servedRoute, routed bool, params map[string]string) decision {
	chosen := decision{route: r.Name, rule: r.Name, params: params, behavior: r.Behavior}
	base := answer{status: http.StatusOK}
	if routed {
		base = route.answerFor(r.ExampleID)
		chosen.route = route.name
		if chosen.behavior.isZero() {
			chosen.behavior = route.behavior
		}
	}
	chosen.answer = r.overlay(base)
	return chosen
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
