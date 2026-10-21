package mock

import (
	"fmt"
	"strings"
	"sync/atomic"
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
	calls   atomic.Int64
}

func compileRules(rules []Rule) ([]*compiledRule, error) {
	if len(rules) > maxRules {
		return nil, fmt.Errorf("the mock server takes at most %d rules, but %d were given", maxRules, len(rules))
	}
	compiled := make([]*compiledRule, 0, len(rules))
	for _, rule := range rules {
		if rule.Disabled {
			continue
		}
		next, err := compileRule(rule)
		if err != nil {
			return nil, fmt.Errorf("rule %q: %w", rule.Name, err)
		}
		compiled = append(compiled, next)
	}
	return compiled, nil
}

func compileRule(rule Rule) (*compiledRule, error) {
	if err := rule.validate(); err != nil {
		return nil, err
	}
	compiled := &compiledRule{Rule: rule}
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

func (r *compiledRule) matches(e *exchange) (map[string]string, bool) {
	if r.Method != "" && r.Method != e.method {
		return nil, false
	}
	var params map[string]string
	if r.hasPath {
		matched, ok := r.shape.match(e.parts)
		if !ok {
			return nil, false
		}
		params = matched
	}
	for _, condition := range r.Conditions {
		if !condition.holds(e) {
			return nil, false
		}
	}
	if r.Nth > 0 && r.calls.Add(1) != int64(r.Nth) {
		return nil, false
	}
	return params, true
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

func (r *compiledRule) overlay(base answer) answer {
	if r.Status != 0 {
		base.status = r.Status
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
