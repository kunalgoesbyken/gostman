package monitor

import (
	"regexp"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	RecordVersion = 1
	KindRun       = "run"
	KindFlow      = "flow"
	maxText       = 300
)

var queryPattern = regexp.MustCompile(`(https?://[^\s"'?#]+)\?[^\s"'#]*`)

type FailedCheck struct {
	Name    string `json:"name"`
	Message string `json:"message,omitempty"`
}

type Entry struct {
	Name       string        `json:"name"`
	Method     string        `json:"method,omitempty"`
	Status     string        `json:"status,omitempty"`
	StatusCode int           `json:"statusCode,omitempty"`
	DurationMs int64         `json:"durationMs"`
	Skipped    bool          `json:"skipped,omitempty"`
	Failed     bool          `json:"failed,omitempty"`
	Handled    bool          `json:"handled,omitempty"`
	Error      string        `json:"error,omitempty"`
	Checks     int           `json:"checks,omitempty"`
	Failures   []FailedCheck `json:"failedChecks,omitempty"`
}

type Record struct {
	Version     int            `json:"version"`
	ID          string         `json:"id"`
	Monitor     string         `json:"monitor,omitempty"`
	StartedAt   time.Time      `json:"startedAt"`
	Kind        string         `json:"kind"`
	Target      string         `json:"target"`
	Environment string         `json:"environment,omitempty"`
	DurationMs  int64          `json:"durationMs"`
	Passed      bool           `json:"passed"`
	ExitCode    int            `json:"exitCode"`
	Outcome     string         `json:"outcome,omitempty"`
	Summary     runner.Summary `json:"summary"`
	Requests    []Entry        `json:"requests"`
}

type Source struct {
	Kind     string
	Target   string
	ExitCode int
	Scrub    func(string) string
}

func IDFor(at time.Time) string {
	return at.UTC().Format("20060102T150405.000Z")
}

func clip(text string) string {
	if len(text) <= maxText {
		return text
	}
	cut := maxText
	for cut > 0 && text[cut]&0xC0 == 0x80 {
		cut--
	}
	return text[:cut] + "..."
}

func (s Source) clean(text string) string {
	text = strings.TrimSpace(queryPattern.ReplaceAllString(text, "$1"))
	if s.Scrub != nil {
		text = s.Scrub(text)
	}
	return clip(text)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func (s Source) entry(result runner.Result) Entry {
	entry := Entry{
		Name:       result.QualifiedName(),
		Method:     result.Method,
		Status:     result.Status,
		StatusCode: result.StatusCode,
		DurationMs: result.DurationMs,
		Skipped:    result.IsSkipped(),
		Handled:    result.Handled != "",
		Failed:     result.Failed && result.Handled == "",
		Checks:     len(result.Tests),
	}
	if result.Failed {
		entry.Error = s.clean(firstNonEmpty(result.Failure, result.Error))
	}
	for _, check := range result.Tests {
		if !check.Passed {
			entry.Failures = append(entry.Failures, FailedCheck{Name: s.clean(check.Name), Message: s.clean(check.Message)})
		}
	}
	return entry
}

func (s Source) Record(report runner.Report) Record {
	record := Record{
		Version:     RecordVersion,
		ID:          IDFor(report.StartedAt),
		StartedAt:   report.StartedAt.UTC(),
		Kind:        s.Kind,
		Target:      s.Target,
		Environment: report.Environment,
		DurationMs:  report.DurationMs,
		Passed:      !report.HasFailed(),
		ExitCode:    s.ExitCode,
		Summary:     report.Summary,
		Requests:    make([]Entry, 0, len(report.Results)),
	}
	if report.Flow != nil {
		record.Outcome = report.Flow.Outcome
	}
	for _, result := range report.Results {
		record.Requests = append(record.Requests, s.entry(result))
	}
	return record
}
