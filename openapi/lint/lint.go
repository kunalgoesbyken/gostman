package lint

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/kunalgoesbyken/gostman/openapi"
)

const timeLimit = 30 * time.Second

var errTookTooLong = errors.New("linting took too long and was stopped")

type Query struct {
	Source openapi.Source `json:"source"`
	Config string         `json:"config"`
}

type Reply struct {
	Error  string  `json:"error,omitempty"`
	Report *Report `json:"report,omitempty"`
}

func Run(ctx context.Context, source openapi.Source, opt openapi.Options, config Config) (Report, error) {
	if err := config.validate(); err != nil {
		return Report{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, timeLimit)
	defer cancel()
	root, err := openapi.ReadRoot(ctx, source, opt)
	if errors.Is(err, context.DeadlineExceeded) {
		return Report{}, errTookTooLong
	}
	if err != nil {
		return Report{}, err
	}
	return Analyze(ctx, root, config)
}

func Handle(ctx context.Context, query Query, opt openapi.Options) Reply {
	config, err := ParseConfig([]byte(query.Config))
	if err != nil {
		return Reply{Error: err.Error()}
	}
	report, err := Run(ctx, query.Source, opt, config)
	if err != nil {
		return Reply{Error: err.Error()}
	}
	return Reply{Report: &report}
}

func Analyze(ctx context.Context, root map[string]any, config Config) (Report, error) {
	spec, err := newSpec(ctx, root)
	if err != nil {
		return Report{}, err
	}
	return evaluate(ctx, spec, config)
}

func evaluate(ctx context.Context, spec *Spec, config Config) (Report, error) {
	report := Report{Findings: []Finding{}}
	order := map[string]int{}
	for index, rule := range Rules() {
		order[rule.ID] = index
		severity := config.severityOf(rule)
		if severity == SeverityOff {
			continue
		}
		report.Findings = append(report.Findings, findingsOf(rule, severity, spec)...)
		if ctx.Err() != nil {
			return Report{}, errTookTooLong
		}
	}
	sortFindings(report.Findings, order)
	for _, finding := range report.Findings {
		report.Counts.add(finding.Severity)
	}
	return report, nil
}

func findingsOf(rule Rule, severity Severity, spec *Spec) []Finding {
	var findings []Finding
	for _, issue := range rule.Check(spec) {
		operation := issue.Operation
		if operation == "" {
			operation = operationAt(issue.Path)
		}
		findings = append(findings, Finding{Rule: rule.ID, Severity: severity, Message: issue.Message, Path: issue.Path, Operation: operation})
	}
	return findings
}

func sortFindings(findings []Finding, order map[string]int) {
	sort.SliceStable(findings, func(i, j int) bool {
		a, b := findings[i], findings[j]
		if a.Severity.rank() != b.Severity.rank() {
			return a.Severity.rank() > b.Severity.rank()
		}
		if a.Rule != b.Rule {
			return order[a.Rule] < order[b.Rule]
		}
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		return a.Message < b.Message
	})
}
