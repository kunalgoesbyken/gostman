package runner

import (
	"context"
	"encoding/json"
	"time"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/runner/sandbox"
)

const (
	selectionName = "selected"
	sourceBody    = "body"
)

type Session struct {
	state       *session
	environment string
}

type Outcome struct {
	Result   Result
	Response engine.Response
}

type selectionRule struct {
	Name       string `json:"name"`
	Source     string `json:"source"`
	Expression string `json:"expression"`
}

func NewSession(policy engine.Policy) (*Session, error) {
	scripts, err := sandbox.New()
	if err != nil {
		return nil, err
	}
	state := &session{scripts: scripts, policy: policy, variables: variables{}, common: newShared()}
	return &Session{state: state}, nil
}

func (s *Session) Enter(environments []Environment, name string, overrides map[string]string) error {
	environment, err := selectEnvironment(environments, name)
	if err != nil {
		return err
	}
	starting, err := startingVariables(environment, overrides)
	if err != nil {
		return err
	}
	s.state.variables = starting
	s.environment = environment.Name
	return nil
}

func (s *Session) Environment() string {
	return s.environment
}

func (s *Session) Set(overrides map[string]string) {
	s.state.variables.override(overrides)
}

func (s *Session) Watch(witness func(engine.Request)) {
	s.state.common.watch(witness)
}

func (v variables) plain() map[string]string {
	values := make(map[string]string, len(v))
	for name, raw := range v {
		values[name] = plainText(raw)
	}
	return values
}

func (e Environment) Values() (map[string]string, error) {
	parsed, err := parseVariables(e.Variables)
	return parsed.plain(), err
}

func (s *Session) Variables() map[string]string {
	return s.state.variables.plain()
}

func (s *Session) Cookies() []engine.CookieInfo {
	return s.state.common.cookieList()
}

func (s *Session) Tokens() []engine.OAuth2 {
	return s.state.common.tokenList()
}

func (s *Session) Send(ctx context.Context, request Request, folder string) Outcome {
	exchanged, err := s.state.execute(ctx, request)
	if err != nil {
		exchanged.stop(err.Error())
	}
	return Outcome{Result: describe(request, folder, exchanged), Response: exchanged.response}
}

func (s *Session) Run(ctx context.Context, stored Collection, options Options, observe func(Result)) (Report, error) {
	planned, err := prepare(s.state.scripts, stored, options)
	if err != nil {
		return Report{}, err
	}
	started := time.Now()
	results := s.state.runAll(ctx, planned, options, observe)
	report := Report{
		Version:     ReportVersion,
		Environment: s.environment,
		StartedAt:   started.UTC(),
		DurationMs:  time.Since(started).Milliseconds(),
		Summary:     summarize(results, len(planned.requests)*options.iterationCount()),
		Results:     results,
	}
	if options.isIterating() {
		report.Iterations = options.iterationCount()
	}
	if options.Parallel > 1 {
		report.Parallel = options.Parallel
	}
	return report, nil
}

func (s *Session) Normalize(draft any) (Request, error) {
	var request Request
	return request, s.state.scripts.Call("normalizeRequest", &request, draft)
}

func (s *Session) Select(response engine.Response, path string) (string, bool, error) {
	rules, err := json.Marshal([]selectionRule{{Name: selectionName, Source: sourceBody, Expression: path}})
	if err != nil {
		return "", false, err
	}
	var found variables
	if err := s.state.scripts.Call("extract", &found, Request{Extractors: string(rules)}, response); err != nil {
		return "", false, err
	}
	selected, ok := found[selectionName]
	return plainText(selected), ok, nil
}

func plainText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	return string(raw)
}
