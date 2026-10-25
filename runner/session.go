package runner

import (
	"context"
	"encoding/json"
	"maps"
	"slices"
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
	state := &session{scripts: scripts, policy: policy, values: newValues(), common: newShared()}
	return &Session{state: state}, nil
}

func (s *Session) Enter(stored Collection, folder, name string, overrides map[string]string) error {
	folderID, err := s.folderID(stored.Folders, folder)
	if err != nil {
		return err
	}
	primary, byCollection, err := stored.environmentsFor(folderID, name)
	if err != nil {
		return err
	}
	if err := s.LoadCollectionVariables(stored); err != nil {
		return err
	}
	chosen := map[string]string{}
	used := []Environment{primary}
	for _, collection := range slices.Sorted(maps.Keys(byCollection)) {
		chosen[collection] = byCollection[collection].ID
		used = append(used, byCollection[collection])
	}
	slots, resolved, err := startingSlots(stored.Environments, used, overrides)
	if err != nil {
		return err
	}
	s.state.values.useEnvironments(primary.ID, slots, chosen, stored.lineages()(folderID))
	s.resolved = resolved
	s.state.common.keepSecrets(resolved)
	return nil
}

func startingSlots(environments, used []Environment, overrides map[string]string) (map[string]*environmentSlot, map[string]string, error) {
	slots := map[string]*environmentSlot{}
	resolved := map[string]string{}
	for _, environment := range used {
		if slots[environment.ID] != nil {
			continue
		}
		found, err := resolveReferences(context.Background(), environments, environment, overrides)
		if err != nil {
			return nil, nil, err
		}
		if slots[environment.ID], err = startingSlot(environments, environment, overrides, found); err != nil {
			return nil, nil, err
		}
		maps.Copy(resolved, found)
	}
	return slots, resolved, nil
}

func (s *Session) LoadCollectionVariables(stored Collection) error {
	process, collection, err := baseScopes(stored)
	if err != nil {
		return err
	}
	s.state.values.load(process, collection)
	return nil
}

func (s *Session) Environment() string {
	return s.state.values.primaryName()
}

func (s *Session) Set(overrides map[string]string) {
	s.state.values.setEnvironment(overrides)
}

func (s *Session) SignIn(token engine.Token) {
	s.state.common.signIn = token
}

func (s *Session) Remember(values map[string]string) {
	s.state.values.remember(values)
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
	return s.state.values.current().plain()
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

func (s *Session) Send(ctx context.Context, request Request, folder string, arguments map[string]string) Outcome {
	s.state.once = variables{}
	s.state.once.override(arguments)
	exchanged, err := s.state.execute(ctx, request)
	s.state.once = nil
	s.state.common.publish(s.state.scoped(request).plain())
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
	folderID, err := s.folderID(stored.Folders, options.Folder)
	if err != nil {
		return Report{}, err
	}
	if err := s.LoadCollectionVariables(stored); err != nil {
		return Report{}, err
	}
	s.state.values.focusOn(stored.lineages()(folderID))
	s.state.modules = stored.Modules
	if options.SignIn != (engine.Token{}) {
		s.state.common.signIn = options.SignIn
	}
	s.state.contract = newContract(options.Contract)
	s.state.values.remember(options.Variables)
	if err := s.state.learn(planned.library); err != nil {
		return Report{}, err
	}
	total := len(planned.requests) * options.iterationCount()
	if options.OnPlanned != nil {
		options.OnPlanned(total)
	}
	started := time.Now()
	results := s.state.runAll(ctx, planned, options, observe)
	report := Report{
		Version:     ReportVersion,
		Environment: s.state.values.environmentNames(),
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
