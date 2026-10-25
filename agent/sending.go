package agent

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const highestIterations = 100

var textBodyTypes = []string{engine.BodyNone, engine.BodyJSON, engine.BodyText, engine.BodyXML, engine.BodyForm}

type sendArguments struct {
	Request        string            `json:"request"`
	Method         string            `json:"method"`
	URL            string            `json:"url"`
	Headers        map[string]string `json:"headers"`
	Body           string            `json:"body"`
	BodyType       string            `json:"body_type"`
	Variables      map[string]string `json:"variables"`
	Select         string            `json:"select"`
	MaxBodyBytes   int               `json:"max_body_bytes"`
	IncludeHeaders bool              `json:"include_headers"`
}

type runArguments struct {
	Folder      string       `json:"folder"`
	Bail        bool         `json:"bail"`
	Tags        []string     `json:"tags"`
	ExcludeTags []string     `json:"exclude_tags"`
	Data        []runner.Row `json:"data"`
	Iterations  int          `json:"iterations"`
}

type failedRequest struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Folder      string           `json:"folder"`
	Method      string           `json:"method"`
	URL         string           `json:"url"`
	Status      string           `json:"status"`
	Iteration   int              `json:"iteration,omitempty"`
	Error       string           `json:"error,omitempty"`
	Unresolved  []string         `json:"unresolved,omitempty"`
	FailedTests []runner.Check   `json:"failedTests"`
	Logs        []runner.LogLine `json:"logs"`
}

type unresolvedRequest struct {
	Request      string   `json:"request"`
	Placeholders []string `json:"placeholders"`
}

type runDigest struct {
	Environment string              `json:"environment"`
	DurationMs  int64               `json:"durationMs"`
	Iterations  int                 `json:"iterations,omitempty"`
	Summary     runner.Summary      `json:"summary"`
	Failures    []failedRequest     `json:"failures"`
	Unresolved  []unresolvedRequest `json:"unresolved,omitempty"`
	Hint        string              `json:"hint,omitempty"`
}

func (o Outcome) Attachment() string {
	return o.Text
}

func (a sendArguments) describesRequest() bool {
	return a.Method != "" || len(a.Headers) > 0 || a.Body != "" || a.BodyType != ""
}

func (a sendArguments) check() error {
	switch {
	case hasText(a.Request) == hasText(a.URL):
		return errors.New("Give either request (a saved request's id or name) or url (an ad hoc request), not both and not neither.")
	case hasText(a.Request) && a.describesRequest():
		return errors.New("A saved request is sent as it is saved, so method, headers, body and body_type do not apply. Change it with save_request, or send an ad hoc request with url.")
	case a.BodyType != "" && !slices.Contains(textBodyTypes, a.BodyType):
		return fmt.Errorf("body_type must be one of %s.", strings.Join(textBodyTypes, ", "))
	case a.MaxBodyBytes < 0 || a.MaxBodyBytes > HighestBodyBytes:
		return fmt.Errorf("max_body_bytes must be between 1 and %d.", HighestBodyBytes)
	default:
		return nil
	}
}

func headerEntries(headers map[string]string) []engine.HeaderEntry {
	entries := make([]engine.HeaderEntry, 0, len(headers))
	for _, name := range sortedKeys(headers) {
		entries = append(entries, engine.HeaderEntry{Key: name, Value: headers[name]})
	}
	return entries
}

func (d *Desk) target(current scene, arguments sendArguments) (runner.Listed, error) {
	if hasText(arguments.Request) {
		return d.find(current.stored, arguments.Request)
	}
	return d.client.Compose(Draft{
		Method:   arguments.Method,
		URL:      arguments.URL,
		Headers:  headerEntries(arguments.Headers),
		Body:     arguments.Body,
		BodyType: arguments.BodyType,
	})
}

func (d *Desk) deliver(ctx context.Context, target runner.Listed, view View) (Outcome, error) {
	target.Request = d.tune(target.Request)
	var outcome Outcome
	var response engine.Response
	var err error
	d.outside(func() {
		outcome, response, err = d.client.Exchange(ctx, target, view)
	})
	if err == nil && target.Request.ID != "" {
		d.responses.record(target.Request.ID, received(response))
	}
	switch {
	case response.Error == engine.ErrorBlocked:
		outcome.Hint = hintRefused
	case strings.Contains(outcome.Error, runner.SignInNeeded):
		outcome.Hint = hintSignIn
	case len(outcome.Unresolved) > 0:
		outcome.Hint = hintUndefined
	}
	return outcome, err
}

func (d *Desk) sendRequest(ctx context.Context, current scene, arguments sendArguments) (Outcome, error) {
	if err := arguments.check(); err != nil {
		return Outcome{}, err
	}
	target, err := d.target(current, arguments)
	if err != nil {
		return Outcome{}, err
	}
	d.client.Remember(arguments.Variables)
	return d.deliver(ctx, target, View{
		Select:         arguments.Select,
		MaxBodyBytes:   arguments.MaxBodyBytes,
		IncludeHeaders: arguments.IncludeHeaders,
	})
}

func failedChecks(tests []runner.Check) []runner.Check {
	failed := []runner.Check{}
	for _, check := range tests {
		if !check.Passed {
			failed = append(failed, check)
		}
	}
	return failed
}

func describeFailure(result runner.Result) failedRequest {
	return failedRequest{
		ID:          result.ID,
		Name:        result.Name,
		Folder:      result.Folder,
		Method:      result.Method,
		URL:         result.URL,
		Status:      result.Status,
		Iteration:   result.Iteration,
		Error:       result.Error,
		Unresolved:  result.Unresolved,
		FailedTests: failedChecks(result.Tests),
		Logs:        result.Logs,
	}
}

func digest(report runner.Report) runDigest {
	summary := runDigest{
		Environment: report.Environment,
		DurationMs:  report.DurationMs,
		Iterations:  report.Iterations,
		Summary:     report.Summary,
		Failures:    []failedRequest{},
	}
	undefined := false
	for _, result := range report.Results {
		undefined = undefined || len(result.Unresolved) > 0
		switch {
		case result.Failed:
			summary.Failures = append(summary.Failures, describeFailure(result))
		case len(result.Unresolved) > 0:
			summary.Unresolved = append(summary.Unresolved, unresolvedRequest{Request: result.QualifiedName(), Placeholders: result.Unresolved})
		}
	}
	if undefined {
		summary.Hint = hintRunUndefined
	}
	return summary
}

func (d *Desk) observeRun(ctx context.Context, options *runner.Options) func(runner.Result) {
	var planned, finished, failed int
	options.OnPlanned = func(requests int) { planned = requests }
	return func(result runner.Result) {
		finished++
		if result.Failed {
			failed++
		}
		if result.Exchange != nil {
			d.responses.record(result.ID, captured(result))
		}
		total := max(planned, finished)
		mcp.Progress(ctx, float64(finished), float64(total), fmt.Sprintf("%d of %d done, %d failed; last: %s", finished, total, failed, result.Name))
	}
}

func (d *Desk) runFolder(ctx context.Context, current scene, arguments runArguments) (runDigest, error) {
	if arguments.Iterations < 0 || arguments.Iterations > highestIterations || len(arguments.Data) > highestIterations {
		return runDigest{}, fmt.Errorf("A run from here is limited to %d iterations and %d data rows.", highestIterations, highestIterations)
	}
	options := runner.Options{
		Folder:      arguments.Folder,
		Bail:        arguments.Bail,
		Tags:        workspace.NormalizeTags(arguments.Tags),
		ExcludeTags: workspace.NormalizeTags(arguments.ExcludeTags),
		Data:        arguments.Data,
		Iterations:  arguments.Iterations,
		Timeout:     d.timeout,
		Insecure:    d.insecure,
		Capture:     true,
	}
	observe := d.observeRun(ctx, &options)
	var report runner.Report
	var err error
	d.outside(func() {
		report, err = d.client.Run(ctx, current.stored, options, observe)
	})
	if err != nil {
		return runDigest{}, err
	}
	return digest(report), nil
}
