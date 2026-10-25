package mock

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	methodGraphQL = "GRAPHQL"
	methodGRPC    = "GRPC"
	methodMCP     = "MCP"

	maxRoutes = 10_000

	headerResponseName = "X-Mock-Response-Name"
	headerResponseCode = "X-Mock-Response-Code"
	reasonNoMatch      = "No saved example of %q matches the x-mock-response-name and x-mock-response-code headers."
	reasonUnanswered   = "%s %s is the route of %q, which has no saved example yet. Send that request in Gostman and choose Save as example to serve it."
)

var socketSchemes = []string{"ws://", "wss://"}

type servedRoute struct {
	name     string
	method   string
	shape    pattern
	answer   answer
	examples []servedExample
	behavior Behavior
}

type servedExample struct {
	id     string
	name   string
	status int
	answer answer
}

type table struct {
	routes     []Route
	served     []servedRoute
	unanswered []servedRoute
	rules      []*compiledRule
	owners     map[string]string
	settings   Settings
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
		routes:   make([]Route, 0, len(composed)),
		owners:   map[string]string{},
		rules:    rules,
		settings: config.Settings,
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
	if reason, unserved := unservedReason(route.Method, expand(source.URL)); unserved {
		return route.withReason(StateSkipped, reason), nil
	}
	shape := shapeOf(source)
	route.Path = shape.String()
	if source.Disabled {
		return route.withReason(StateDisabled, locales.New(locales.MockRouteDisabled, nil)), nil
	}
	if err := source.Behavior.validate(); err != nil {
		return Route{}, fmt.Errorf("%s: %w", source.Name, err)
	}

	examples := parseExamples(source.Examples)
	example, found := selectExample(examples, source.ExampleID)
	if !found {
		t.unanswered = append(t.unanswered, servedRoute{name: source.Name, method: route.Method, shape: shape})
		return route.withReason(StateNoExample, locales.New(locales.MockRouteNoExample, nil)), nil
	}
	route.ExampleID, route.ExampleName = example.ID, example.Name
	served, err := answerFrom(example)
	if err != nil {
		return route.withReason(StateSkipped, reasonOf(err)), nil
	}

	key := route.Method + " " + shape.key()
	if owner, taken := t.owners[key]; taken {
		return route.withReason(StateConflict, locales.New(locales.MockRouteConflict, locales.Params{"method": route.Method, "path": route.Path, "owner": owner})), nil
	}
	t.owners[key] = source.Name
	t.served = append(t.served, servedRoute{
		name:     source.Name,
		method:   route.Method,
		shape:    shape,
		answer:   served,
		examples: servedExamples(examples),
		behavior: source.Behavior,
	})
	return route.withState(StateServed), nil
}

func shapeOf(source Source) pattern {
	if source.Path != "" {
		return templatePattern(source.Path, source.Types)
	}
	return routePattern(source.URL)
}

func servedExamples(examples []Example) []servedExample {
	served := make([]servedExample, 0, len(examples))
	for _, example := range examples {
		if reply, err := answerFrom(example); err == nil {
			served = append(served, servedExample{id: example.ID, name: example.Name, status: example.Status, answer: reply})
		}
	}
	return served
}

func (t *table) find(method string, parts []string) (servedRoute, map[string]string, bool) {
	return matchRoute(t.served, method, parts)
}

func (t *table) unansweredRoute(e *exchange) (string, bool) {
	route, _, found := matchRoute(t.unanswered, e.method, e.parts)
	return route.name, found
}

func matchRoute(routes []servedRoute, method string, parts []string) (servedRoute, map[string]string, bool) {
	for _, candidate := range routes {
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
	return decision{route: route.name, answer: route.requested(e.header), params: params, behavior: route.behavior}, true
}

func (r servedRoute) answerFor(exampleID string) answer {
	for _, example := range r.examples {
		if example.id == exampleID {
			return example.answer
		}
	}
	return r.answer
}

func (r servedRoute) requested(header http.Header) answer {
	name := strings.TrimSpace(header.Get(headerResponseName))
	code := strings.TrimSpace(header.Get(headerResponseCode))
	if name == "" && code == "" {
		return r.answer
	}
	for _, example := range r.examples {
		if (name == "" || strings.EqualFold(example.name, name)) && (code == "" || strconv.Itoa(example.status) == code) {
			return example.answer
		}
	}
	return problem(http.StatusNotFound, fmt.Sprintf(reasonNoMatch, r.name))
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

func (r Route) withState(state string) Route {
	r.State = state
	return r
}

func (r Route) withReason(state string, reason locales.Message) Route {
	r.State, r.Reason, r.Localized = state, reason.String(), &reason
	return r
}

func reasonOf(err error) locales.Message {
	if said := locales.Whole(err); said != nil {
		return *said
	}
	return locales.Message{Code: locales.Code(err.Error())}
}

func methodOf(source Source) string {
	method := strings.ToUpper(strings.TrimSpace(source.Method))
	if method == "" {
		return http.MethodGet
	}
	return method
}

func unservedReason(method, address string) (locales.Message, bool) {
	switch {
	case method == methodGraphQL:
		return locales.New(locales.MockRouteGraphqlNotServed, nil), true
	case method == methodGRPC:
		return locales.New(locales.MockRouteGrpcNotServed, nil), true
	case method == methodMCP:
		return locales.New(locales.MockRouteMcpNotServed, nil), true
	case isSocketAddress(address):
		return locales.New(locales.MockRouteWebSocketNotServed, nil), true
	}
	return locales.Message{}, false
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
