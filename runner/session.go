package runner

import (
	"context"
	"encoding/json"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner/sandbox"
)

const (
	selectionName = "selected"
	sourceBody    = "body"
)

type Session struct {
	state    *session
	resolved map[string]string
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
	state := &session{scripts: scripts, policy: policy, variables: variables{}, session: variables{}, common: newShared()}
	return &Session{state: state}, nil
}

func (s *Session) Enter(stored Collection, folder, name string, overrides map[string]string) error {
	folderID, err := s.folderID(stored.Folders, folder)
	if err != nil {
		return err
	}
	environment, err := stored.ChooseEnvironment(folderID, name)
	if err != nil {
		return err
	}
	if err := s.LoadCollectionVariables(stored); err != nil {
		return err
	}
	environments := stored.Environments
	starting, err := startingVariables(environments, environment, overrides)
	if err != nil {
		return err
	}
	resolved, err := resolveReferences(context.Background(), environments, environment, overrides)
	if err != nil {
		return err
	}
	starting.override(resolved)
	s.state.variables = starting
	s.state.session = variables{}
	s.resolved = resolved
	s.state.common.keepSecrets(resolved)
	s.state.environment = environment.Name
	return nil
}

func (s *Session) LoadCollectionVariables(stored Collection) error {
	base, err := baseScopes(stored)
	if err != nil {
		return err
	}
	s.state.collection = layered(base...)
	return nil
}

func (s *Session) Environment() string {
	return s.state.environment
}

func (s *Session) Set(overrides map[string]string) {
	s.state.variables.override(overrides)
}

func (s *Session) SignIn(token engine.Token) {
	s.state.common.signIn = token
}

func (s *Session) Remember(values map[string]string) {
	s.state.session.override(values)
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
	return s.state.current().plain()
}

func (s *Session) Observed() map[string]string {
	return s.state.common.observedList()
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
	result := describe(request, folder, exchanged)
	result.ResolvedURL = s.state.shownURL(request, exchanged.response.URL)
	return Outcome{Result: result, Response: exchanged.response}
}

func (s *Session) Run(ctx context.Context, stored Collection, options Options, observe func(Result)) (Report, error) {
	if err := options.CheckIterations(); err != nil {
		return Report{}, err
	}
	planned, err := prepare(s.state.scripts, stored, options)
	if err != nil {
		return Report{}, err
	}
	base, err := baseScopes(stored)
	if err != nil {
		return Report{}, err
	}
	owned, err := s.collectionLayers(stored, options.Folder)
	if err != nil {
		return Report{}, err
	}
	base = append(base, owned...)
	s.state.modules = stored.Modules
	if options.SignIn != (engine.Token{}) {
		s.state.common.signIn = options.SignIn
	}
	s.state.contract = newContract(options.Contract)
	s.state.collection = layered(base...)
	s.state.session.override(options.Variables)
	if err := s.state.learn(planned.library); err != nil {
		return Report{}, err
	}
	total := len(planned.requests) * options.iterationCount()
	if options.OnPlanned != nil {
		options.OnPlanned(total)
	}
	started := time.Now()
	before := layered(s.state.session)
	results := s.state.runAll(ctx, planned, options, observe)
	s.state.session.withdraw(options.Data, before)
	report := Report{
		Version:     ReportVersion,
		Environment: s.state.environment,
		StartedAt:   started.UTC(),
		DurationMs:  time.Since(started).Milliseconds(),
		Summary:     summarize(results, total),
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
