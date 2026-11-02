package runner

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/fuzz"
	"github.com/kunalgoesbyken/gostman/locales"
	"github.com/kunalgoesbyken/gostman/openapi"
)

const (
	DefaultFuzzRate     = 5
	DefaultFuzzRequests = 200
	DefaultFuzzTimeout  = 10 * time.Second
	fuzzContractRule    = "contract"
	fuzzServerRule      = "server-error"
	fuzzTimeoutRule     = "timeout"
)

type FuzzOptions struct {
	Rate        float64
	MaxRequests int
	Timeout     time.Duration
}

type FuzzFinding struct {
	Operation string `json:"operation"`
	Input     string `json:"input"`
	Kind      string `json:"kind"`
	Rule      string `json:"rule"`
	Severity  string `json:"severity"`
	Message   string `json:"message"`
	Status    int    `json:"status"`
}

type FuzzReport struct {
	Operations int           `json:"operations"`
	Sent       int           `json:"sent"`
	Unsent     int           `json:"unsent"`
	Capped     bool          `json:"capped"`
	Findings   []FuzzFinding `json:"findings"`
}

type headerRow struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
}

func (s *Session) Fuzz(ctx context.Context, cases []fuzz.Case, options FuzzOptions, observe func(FuzzFinding)) (FuzzReport, error) {
	report := FuzzReport{Findings: []FuzzFinding{}}
	rate, limit, timeout := options.Rate, options.MaxRequests, options.Timeout
	if rate <= 0 {
		rate = DefaultFuzzRate
	}
	if limit <= 0 {
		limit = DefaultFuzzRequests
	}
	if timeout <= 0 {
		timeout = DefaultFuzzTimeout
	}
	pause := time.Duration(float64(time.Second) / rate)
	operations := map[string]bool{}
	for _, c := range cases {
		if ctx.Err() != nil {
			return report, ctx.Err()
		}
		if report.Sent+report.Unsent >= limit {
			report.Capped = true
			return report, nil
		}
		operations[c.Target.Key] = true
		report.Operations = len(operations)
		request, err := fuzzRequest(c, timeout)
		if err != nil {
			return report, err
		}
		sent := s.Send(ctx, request, "", nil)
		if sent.Response.Error != "" && !timedOut(sent.Response) {
			report.Unsent++
			continue
		}
		report.Sent++
		for _, found := range judgeFuzz(c, sent) {
			report.Findings = append(report.Findings, found)
			if observe != nil {
				observe(found)
			}
		}
		select {
		case <-ctx.Done():
		case <-time.After(pause):
		}
	}
	return report, nil
}

func timedOut(response engine.Response) bool {
	return response.Localized != nil && response.Localized.Code == locales.EngineFailureTimeout
}

func judgeFuzz(c fuzz.Case, sent Outcome) []FuzzFinding {
	base := FuzzFinding{Operation: c.Target.Key, Input: c.Label, Kind: c.Kind, Status: sent.Response.StatusCode}
	var found []FuzzFinding
	add := func(rule, severity, message string) {
		finding := base
		finding.Rule, finding.Severity, finding.Message = rule, severity, message
		found = append(found, finding)
	}
	switch {
	case timedOut(sent.Response):
		add(fuzzTimeoutRule, "medium", "No answer before the timeout")
	case sent.Response.StatusCode >= 500:
		add(fuzzServerRule, "high", "The server answered "+sent.Response.Status)
	}
	for _, check := range sent.Result.Tests {
		if check.Kind == ContractKind && !check.Passed {
			add(fuzzContractRule, "medium", check.Name+": "+check.Message)
		}
	}
	return found
}

func fuzzRequest(c fuzz.Case, timeout time.Duration) (Request, error) {
	request := Request{
		Name:    c.Target.Key,
		Method:  c.Target.Method,
		URL:     "{{" + openapi.BaseURLVariable + "}}" + fuzzURL(c),
		Auth:    c.Target.Auth,
		Options: engine.Options{TimeoutMs: int(timeout.Milliseconds())},
	}
	var rows []headerRow
	for _, input := range c.Target.Params {
		if value, present := c.Params[fuzz.ParamKey(input)]; present && input.In == "header" {
			rows = append(rows, headerRow{Key: input.Name, Value: fuzz.Text(value), Enabled: true})
		}
	}
	if c.HasBody {
		body, err := json.Marshal(c.Body)
		if err != nil {
			return request, err
		}
		request.Body, request.BodyType = string(body), "json"
		rows = append(rows, headerRow{Key: "Content-Type", Value: c.Target.ContentType, Enabled: true})
	}
	if len(rows) > 0 {
		encoded, err := json.Marshal(rows)
		if err != nil {
			return request, err
		}
		request.Headers = string(encoded)
	}
	return request, nil
}

func fuzzURL(c fuzz.Case) string {
	path := c.Target.Path
	var query []string
	for _, input := range c.Target.Params {
		value, present := c.Params[fuzz.ParamKey(input)]
		if !present {
			continue
		}
		switch input.In {
		case "path":
			path = strings.ReplaceAll(path, "{"+input.Name+"}", url.PathEscape(fuzz.Text(value)))
		case "query":
			query = append(query, url.QueryEscape(input.Name)+"="+url.QueryEscape(fuzz.Text(value)))
		}
	}
	if len(query) == 0 {
		return path
	}
	return path + "?" + strings.Join(query, "&")
}
