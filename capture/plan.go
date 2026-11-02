package capture

import (
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/mock"
)

type callInfo struct {
	method string
	host   string
	path   string
	query  url.Values
	header http.Header
}

type plan struct {
	fired          []string
	requestEdits   []Edit
	responseEdits  []Edit
	remote         *url.URL
	answer         *Answer
	delay          time.Duration
	fault          mock.Fault
	throttle       Throttle
	breakRequest   string
	breakResponse  string
}

func (p *plan) isEmpty() bool {
	return len(p.fired) == 0
}

func (p *plan) editsRequest() bool {
	for _, edit := range p.requestEdits {
		if len(edit.Body) > 0 {
			return true
		}
	}
	return false
}

func (p *plan) editsResponse() bool {
	for _, edit := range p.responseEdits {
		if len(edit.Body) > 0 {
			return true
		}
	}
	return false
}

func (r *compiledRule) matchesMethod(method string) bool {
	if len(r.methods) == 0 {
		return true
	}
	for _, accepted := range r.methods {
		if accepted == method {
			return true
		}
	}
	return false
}

func (r *compiledRule) matches(call callInfo) bool {
	switch {
	case !r.matchesMethod(call.method):
		return false
	case r.host != nil && !r.host.MatchString(call.host):
		return false
	case r.path != nil && !r.path.MatchString(call.path):
		return false
	case r.pathRegex != nil && !r.pathRegex.MatchString(call.path):
		return false
	}
	for _, condition := range r.Match.Conditions {
		if !conditionHolds(condition, call) {
			return false
		}
	}
	return true
}

func conditionHolds(c Condition, call callInfo) bool {
	var values []string
	if c.Field == mock.FieldQuery {
		values = call.query[c.Name]
	} else {
		values = call.header.Values(c.Name)
	}
	if c.Op == mock.OpExists {
		return len(values) > 0
	}
	for _, value := range values {
		if c.Op == mock.OpContains && strings.Contains(value, c.Value) || c.Op == mock.OpEquals && value == c.Value {
			return true
		}
	}
	return false
}

func (s *Ruleset) plan(call callInfo, dice *mock.Dice) *plan {
	made := &plan{}
	if s == nil {
		return made
	}
	for _, rule := range s.rules {
		if rule.matches(call) {
			made.absorb(rule, dice)
		}
	}
	return made
}

func (p *plan) absorb(rule *compiledRule, dice *mock.Dice) {
	p.fired = append(p.fired, rule.label())
	p.requestEdits = append(p.requestEdits, rule.Request)
	p.responseEdits = append(p.responseEdits, rule.Response)
	if rule.remote != nil {
		p.remote = rule.remote
	}
	if rule.Answer != nil && p.answer == nil {
		p.answer = rule.Answer
	}
	p.delay += time.Duration(dice.Between(rule.DelayMs, rule.DelayMaxMs)+rule.Throttle.LatencyMs) * time.Millisecond
	if rule.Fault.Percent > 0 && p.fault.Percent == 0 && dice.Roll(rule.Fault.Percent) {
		p.fault = rule.Fault
	}
	p.throttle.DownloadKBps = firstNonZero(p.throttle.DownloadKBps, rule.Throttle.DownloadKBps)
	p.throttle.UploadKBps = firstNonZero(p.throttle.UploadKBps, rule.Throttle.UploadKBps)
	if rule.Break == PhaseRequest || rule.Break == PhaseBoth {
		p.breakRequest = firstText(p.breakRequest, rule.label())
	}
	if rule.Break == PhaseResponse || rule.Break == PhaseBoth {
		p.breakResponse = firstText(p.breakResponse, rule.label())
	}
}

func firstNonZero(current, next int) int {
	if current != 0 {
		return current
	}
	return next
}

func firstText(current, next string) string {
	if current != "" {
		return current
	}
	return next
}
