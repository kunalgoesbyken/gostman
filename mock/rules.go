package mock

import (
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	maxRules          = 200
	maxConditions     = 20
	maxConditionBytes = 1 << 10
)

type compiledRule struct {
	Rule
	shape   pattern
	hasPath bool
	data    *dataset
	calls   atomic.Int64
}

func checkRules(rules []Rule) error {
	if len(rules) > maxRules {
		return fmt.Errorf("the mock server takes at most %d rules, but %d were given", maxRules, len(rules))
	}
	for _, rule := range rules {
		if err := rule.validate(); err != nil {
			return fmt.Errorf("rule %q: %w", rule.Name, err)
		}
	}
	return nil
}

func compileRules(rules []Rule, files engine.FileReader) ([]*compiledRule, error) {
	if err := checkRules(rules); err != nil {
		return nil, err
	}
	compiled := make([]*compiledRule, 0, len(rules))
	for _, rule := range rules {
		if rule.Disabled {
			continue
		}
		next, err := compileRule(rule, files)
		if err != nil {
			return nil, fmt.Errorf("rule %q: %w", rule.Name, err)
		}
		compiled = append(compiled, next)
	}
	return compiled, nil
}

func compileRule(rule Rule, files engine.FileReader) (*compiledRule, error) {
	compiled := &compiledRule{Rule: rule}
	if rule.Data != nil {
		data, err := rule.Data.load(files)
		if err != nil {
			return nil, err
		}
		compiled.data = data
	}
	compiled.Method = strings.ToUpper(strings.TrimSpace(rule.Method))
	compiled.Headers = servedHeaders(rule.Headers)
	if strings.TrimSpace(rule.Path) != "" {
		compiled.shape, compiled.hasPath = parsePattern(rule.Path), true
	}
	return compiled, nil
}

func (r Rule) validate() error {
	if len(r.Conditions) > maxConditions {
		return fmt.Errorf("a rule takes at most %d conditions", maxConditions)
	}
	if r.Nth < 0 {
		return fmt.Errorf("the call number must not be negative")
	}
	if r.Status != 0 && (r.Status < lowestStatus || r.Status > highestStatus) {
		return fmt.Errorf("the status must be between %d and %d", lowestStatus, highestStatus)
	}
	for _, condition := range r.Conditions {
		if err := condition.validate(); err != nil {
			return err
		}
	}
	if r.Data != nil {
		if err := r.Data.validate(); err != nil {
			return err
		}
	}
	return r.Behavior.validate()
}

func (c Condition) validate() error {
	switch c.Field {
	case FieldQuery, FieldHeader:
		if strings.TrimSpace(c.Name) == "" {
			return fmt.Errorf("a %s condition needs a name", c.Field)
		}
	case FieldBody:
	default:
		return fmt.Errorf("unknown condition field %q", c.Field)
	}
	switch c.Op {
	case OpEquals, OpContains, OpExists:
	default:
		return fmt.Errorf("unknown condition operator %q", c.Op)
	}
	if len(c.Name) > maxConditionBytes || len(c.Value) > maxConditionBytes {
		return fmt.Errorf("a condition is limited to %d bytes", maxConditionBytes)
	}
	return nil
}

type ruleHit struct {
	params map[string]string
	row    runner.Row
}

func (r *compiledRule) matches(e *exchange, routeParams map[string]string) (ruleHit, bool) {
	if r.Method != "" && r.Method != e.method {
		return ruleHit{}, false
	}
	hit := ruleHit{params: routeParams}
	if r.hasPath {
		matched, ok := r.shape.match(e.parts)
		if !ok {
			return ruleHit{}, false
		}
		hit.params = matched
	}
	for _, condition := range r.Conditions {
		if !condition.holds(e) {
			return ruleHit{}, false
		}
	}
	if r.data != nil {
		row, ok := r.data.pick(e, hit.params)
		if !ok {
			return ruleHit{}, false
		}
		hit.row = row
	}
	if r.Nth > 0 && r.calls.Add(1) != int64(r.Nth) {
		return ruleHit{}, false
	}
	return hit, true
}

func (c Condition) holds(e *exchange) bool {
	values, present := c.observed(e)
	if c.Op == OpExists {
		return present
	}
	for _, value := range values {
		if c.compare(value) {
			return true
		}
	}
	return false
}

func (c Condition) compare(value string) bool {
	if c.Op == OpContains {
		return strings.Contains(value, c.Value)
	}
	return value == c.Value
}

func (c Condition) observed(e *exchange) ([]string, bool) {
	switch c.Field {
	case FieldQuery:
		values, present := e.query[c.Name]
		return values, present
	case FieldHeader:
		values := e.header.Values(c.Name)
		return values, len(values) > 0
	}
	if strings.TrimSpace(c.Name) == "" {
		return []string{string(e.body)}, len(e.body) > 0
	}
	value, present := e.jsonValue(c.Name)
	return []string{textOf(value)}, present
}

func (r *compiledRule) overlay(base answer, row runner.Row) answer {
	if r.Status != 0 {
		base.status = r.Status
	}
	if r.Body == "" && row != nil {
		base.body, base.binary = rowJSON(row), false
		base.headers = withHeaders(base.headers, []Header{{Key: headerContentType, Value: contentTypeJSON}})
	}
	base.headers = withHeaders(base.headers, r.Headers)
	if r.Body != "" {
		base.body, base.binary = []byte(r.Body), false
	}
	return base
}

func withHeaders(current, overrides []Header) []Header {
	merged := make([]Header, 0, len(current)+len(overrides))
	for _, header := range current {
		if !hasHeader(overrides, header.Key) {
			merged = append(merged, header)
		}
	}
	return append(merged, overrides...)
}
