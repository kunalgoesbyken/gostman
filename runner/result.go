package runner

import (
	"fmt"
	"time"
)

const ReportVersion = 1

type Check struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
	Kind    string `json:"kind,omitempty"`
}

type LogLine struct {
	Level string `json:"level"`
	Text  string `json:"text"`
	At    int64  `json:"at"`
}

type Result struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Folder      string    `json:"folder"`
	Method      string    `json:"method"`
	URL         string    `json:"url"`
	ResolvedURL string    `json:"resolvedUrl,omitempty"`
	Skipped     string    `json:"skipped"`
	Status      string    `json:"status"`
	StatusCode  int       `json:"statusCode"`
	Protocol    string    `json:"protocol"`
	StreamEnd   string    `json:"streamEnd,omitempty"`
	DurationMs  int64     `json:"durationMs"`
	Error       string    `json:"error"`
	Failure     string    `json:"failure,omitempty"`
	Unresolved  []string  `json:"unresolved,omitempty"`
	Withheld    []string  `json:"withheld,omitempty"`
	Failed      bool      `json:"failed"`
	Tests       []Check   `json:"tests"`
	Logs        []LogLine `json:"logs"`
	Visual      string    `json:"visualization,omitempty"`
	Iteration   int       `json:"iteration,omitempty"`
	Exchange    *Capture  `json:"exchange,omitempty"`
	flow        flow
}

type Summary struct {
	Requests    int `json:"requests"`
	Passed      int `json:"passed"`
	Failed      int `json:"failed"`
	Skipped     int `json:"skipped"`
	NotRun      int `json:"notRun"`
	Tests       int `json:"tests"`
	FailedTests int `json:"failedTests"`
}

type Report struct {
	Version     int       `json:"version"`
	Collection  string    `json:"collection"`
	Environment string    `json:"environment"`
	StartedAt   time.Time `json:"startedAt"`
	DurationMs  int64     `json:"durationMs"`
	Iterations  int       `json:"iterations,omitempty"`
	Parallel    int       `json:"parallel,omitempty"`
	Summary     Summary   `json:"summary"`
	Results     []Result  `json:"results"`
}

func (r Result) QualifiedName() string {
	name := Listed{Folder: r.Folder, Request: Request{Name: r.Name}}.QualifiedName()
	if r.Iteration > 0 {
		return fmt.Sprintf("%s [iteration %d]", name, r.Iteration)
	}
	return name
}

func (r Result) IsSkipped() bool {
	return r.Skipped != ""
}

func (r Result) PassedTests() int {
	passed := 0
	for _, check := range r.Tests {
		if check.Passed {
			passed++
		}
	}
	return passed
}

type planSlot struct {
	id        string
	folder    string
	name      string
	iteration int
}

func reached(results []Result) int {
	slots := map[planSlot]bool{}
	for _, result := range results {
		slots[planSlot{result.ID, result.Folder, result.Name, result.Iteration}] = true
	}
	return len(slots)
}

func summarize(results []Result, planned int) Summary {
	summary := Summary{Requests: planned, NotRun: max(planned-reached(results), 0)}
	for _, result := range results {
		summary.Tests += len(result.Tests)
		summary.FailedTests += len(result.Tests) - result.PassedTests()
		switch {
		case result.IsSkipped():
			summary.Skipped++
		case result.Failed:
			summary.Failed++
		default:
			summary.Passed++
		}
	}
	return summary
}

func (r Report) HasFailed() bool {
	return r.Summary.Failed > 0
}
