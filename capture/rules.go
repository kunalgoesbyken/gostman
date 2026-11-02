package capture

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/kunalgoesbyken/gostman/mock"
)

const (
	PhaseRequest  = "request"
	PhaseResponse = "response"
	PhaseBoth     = "both"

	maxRules        = 200
	maxEdits        = 50
	maxConditions   = 20
	maxPatternBytes = 1 << 10
	maxDelayMs      = 60_000
	maxKBps         = 1_000_000
	maxAnswerBytes  = 10 << 20
)

type Condition = mock.Condition

type Match struct {
	Method     string      `json:"method,omitempty"`
	Host       string      `json:"host,omitempty"`
	Path       string      `json:"path,omitempty"`
	PathRegex  string      `json:"pathRegex,omitempty"`
	Conditions []Condition `json:"conditions,omitempty"`
}

type BodyEdit struct {
	Find    string `json:"find,omitempty"`
	Replace string `json:"replace,omitempty"`
	Regex   bool   `json:"regex,omitempty"`
	Path    string `json:"path,omitempty"`
	Value   string `json:"value,omitempty"`
}

type Edit struct {
	SetHeaders    []mock.Header `json:"setHeaders,omitempty"`
	RemoveHeaders []string      `json:"removeHeaders,omitempty"`
	Body          []BodyEdit    `json:"body,omitempty"`
}

type Answer struct {
	Status       int           `json:"status,omitempty"`
	Headers      []mock.Header `json:"headers,omitempty"`
	Body         string        `json:"body,omitempty"`
	BodyEncoding string        `json:"bodyEncoding,omitempty"`
	ContentType  string        `json:"contentType,omitempty"`
	File         string        `json:"file,omitempty"`
}

type Throttle struct {
	LatencyMs    int `json:"latencyMs,omitempty"`
	DownloadKBps int `json:"downloadKBps,omitempty"`
	UploadKBps   int `json:"uploadKBps,omitempty"`
}

type Rule struct {
	ID         string     `json:"id"`
	Name       string     `json:"name,omitempty"`
	Disabled   bool       `json:"disabled,omitempty"`
	Match      Match      `json:"match"`
	Request    Edit       `json:"request"`
	Response   Edit       `json:"response"`
	MapRemote  string     `json:"mapRemote,omitempty"`
	Answer     *Answer    `json:"answer,omitempty"`
	DelayMs    int        `json:"delayMs,omitempty"`
	DelayMaxMs int        `json:"delayMaxMs,omitempty"`
	Fault      mock.Fault `json:"fault"`
	Throttle   Throttle   `json:"throttle"`
	Break      string     `json:"break,omitempty"`
}

type compiledRule struct {
	Rule
	methods   []string
	host      *regexp.Regexp
	path      *regexp.Regexp
	pathRegex *regexp.Regexp
	remote    *url.URL
}

type Ruleset struct {
	rules []*compiledRule
}

func (r Rule) label() string {
	if strings.TrimSpace(r.Name) != "" {
		return r.Name
	}
	return r.ID
}

func globPattern(glob string) (*regexp.Regexp, error) {
	if len(glob) > maxPatternBytes {
		return nil, fmt.Errorf("a pattern is limited to %d bytes", maxPatternBytes)
	}
	parts := strings.Split(glob, "*")
	for i, part := range parts {
		parts[i] = regexp.QuoteMeta(part)
	}
	return regexp.Compile("(?is)^" + strings.Join(parts, ".*") + "$")
}

func optionalGlob(glob string) (*regexp.Regexp, error) {
	if strings.TrimSpace(glob) == "" {
		return nil, nil
	}
	return globPattern(strings.TrimSpace(glob))
}

func splitMethods(text string) []string {
	var methods []string
	for _, method := range strings.Split(text, ",") {
		if method = strings.ToUpper(strings.TrimSpace(method)); method != "" {
			methods = append(methods, method)
		}
	}
	return methods
}

func (r Rule) validateLimits() error {
	for _, value := range []int{r.DelayMs, r.DelayMaxMs, r.Throttle.LatencyMs} {
		if value < 0 || value > maxDelayMs {
			return fmt.Errorf("delays must be between 0 and %d ms", maxDelayMs)
		}
	}
	if r.DelayMaxMs != 0 && r.DelayMaxMs < r.DelayMs {
		return fmt.Errorf("the longest delay must not be shorter than the shortest")
	}
	for _, value := range []int{r.Throttle.DownloadKBps, r.Throttle.UploadKBps} {
		if value < 0 || value > maxKBps {
			return fmt.Errorf("bandwidth must be between 0 and %d KB/s", maxKBps)
		}
	}
	switch r.Break {
	case "", PhaseRequest, PhaseResponse, PhaseBoth:
	default:
		return fmt.Errorf("unknown breakpoint phase %q", r.Break)
	}
	if len(r.Match.Conditions) > maxConditions {
		return fmt.Errorf("a rule takes at most %d conditions", maxConditions)
	}
	if err := r.Request.validate(); err != nil {
		return err
	}
	if err := r.Response.validate(); err != nil {
		return err
	}
	return r.Fault.Check()
}

func (e Edit) validate() error {
	if len(e.SetHeaders)+len(e.RemoveHeaders)+len(e.Body) > maxEdits {
		return fmt.Errorf("an edit takes at most %d changes", maxEdits)
	}
	for _, change := range e.Body {
		if err := change.validate(); err != nil {
			return err
		}
	}
	return nil
}

func (b BodyEdit) validate() error {
	if len(b.Find) > maxPatternBytes || len(b.Replace) > maxAnswerBytes || len(b.Value) > maxAnswerBytes || len(b.Path) > maxPatternBytes {
		return fmt.Errorf("a body change is too large")
	}
	switch {
	case b.Path != "":
		if len(pathSteps(b.Path)) == 0 {
			return fmt.Errorf("the JSON path %q is not valid", b.Path)
		}
	case b.Find == "":
		return fmt.Errorf("a body change needs text to find or a JSON path")
	case b.Regex:
		if _, err := regexp.Compile(b.Find); err != nil {
			return fmt.Errorf("the pattern %q is not valid: %w", b.Find, err)
		}
	}
	return nil
}

func (a *Answer) validate(files bool) error {
	if a == nil {
		return nil
	}
	if a.Status != 0 && (a.Status < 100 || a.Status > 599) {
		return fmt.Errorf("the status must be between 100 and 599")
	}
	if len(a.Body) > maxAnswerBytes {
		return fmt.Errorf("an answer body is limited to %d MB", maxAnswerBytes>>20)
	}
	if a.File != "" && !files {
		return fmt.Errorf("answering from a file needs a workspace folder to read it from")
	}
	return nil
}

func compileRule(rule Rule, files bool) (*compiledRule, error) {
	if err := rule.validateLimits(); err != nil {
		return nil, err
	}
	if err := rule.Answer.validate(files); err != nil {
		return nil, err
	}
	compiled := &compiledRule{Rule: rule, methods: splitMethods(rule.Match.Method)}
	var err error
	if compiled.host, err = optionalGlob(rule.Match.Host); err != nil {
		return nil, err
	}
	if compiled.path, err = optionalGlob(rule.Match.Path); err != nil {
		return nil, err
	}
	if strings.TrimSpace(rule.Match.PathRegex) != "" {
		if len(rule.Match.PathRegex) > maxPatternBytes {
			return nil, fmt.Errorf("a pattern is limited to %d bytes", maxPatternBytes)
		}
		if compiled.pathRegex, err = regexp.Compile(rule.Match.PathRegex); err != nil {
			return nil, fmt.Errorf("the path pattern is not valid: %w", err)
		}
	}
	for _, condition := range rule.Match.Conditions {
		if err := checkCondition(condition); err != nil {
			return nil, err
		}
	}
	if strings.TrimSpace(rule.MapRemote) != "" {
		if compiled.remote, err = parseUpstream(rule.MapRemote); err != nil {
			return nil, err
		}
	}
	return compiled, nil
}

func checkCondition(c Condition) error {
	if c.Field != mock.FieldQuery && c.Field != mock.FieldHeader {
		return fmt.Errorf("a capture condition matches a query parameter or a header, not %q", c.Field)
	}
	if strings.TrimSpace(c.Name) == "" {
		return fmt.Errorf("a %s condition needs a name", c.Field)
	}
	switch c.Op {
	case mock.OpEquals, mock.OpContains, mock.OpExists:
	default:
		return fmt.Errorf("unknown condition operator %q", c.Op)
	}
	if len(c.Name) > maxPatternBytes || len(c.Value) > maxPatternBytes {
		return fmt.Errorf("a condition is limited to %d bytes", maxPatternBytes)
	}
	return nil
}

func Compile(rules []Rule, files bool) (*Ruleset, error) {
	if len(rules) > maxRules {
		return nil, fmt.Errorf("the capture takes at most %d rules, but %d were given", maxRules, len(rules))
	}
	set := &Ruleset{}
	for _, rule := range rules {
		if rule.Disabled {
			continue
		}
		compiled, err := compileRule(rule, files)
		if err != nil {
			return nil, fmt.Errorf("rule %q: %w", rule.label(), err)
		}
		set.rules = append(set.rules, compiled)
	}
	return set, nil
}

func Validate(rules []Rule, files bool) error {
	_, err := Compile(rules, files)
	return err
}
