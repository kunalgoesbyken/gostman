package agent

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/runner"
)

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
	Folder string `json:"folder"`
	Bail   bool   `json:"bail"`
}

type failedRequest struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Folder      string           `json:"folder"`
	Method      string           `json:"method"`
	URL         string           `json:"url"`
	Status      string           `json:"status"`
	Error       string           `json:"error,omitempty"`
	FailedTests []runner.Check   `json:"failedTests"`
	Logs        []runner.LogLine `json:"logs"`
}

type runDigest struct {
	Environment string          `json:"environment"`
	DurationMs  int64           `json:"durationMs"`
	Summary     runner.Summary  `json:"summary"`
	Failures    []failedRequest `json:"failures"`
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
	names := make([]string, 0, len(headers))
	for name := range headers {
		names = append(names, name)
	}
	entries := make([]engine.HeaderEntry, 0, len(headers))
	for _, name := range sorted(names) {
		entries = append(entries, engine.HeaderEntry{Key: name, Value: headers[name]})
	}
	return entries
}

func (d *Desk) target(current scene, arguments sendArguments) (runner.Listed, error) {
	if hasText(arguments.Request) {
		return d.client.Find(current.stored, arguments.Request)
	}
	return d.client.Compose(Draft{
		Method:   arguments.Method,
		URL:      arguments.URL,
		Headers:  headerEntries(arguments.Headers),
		Body:     arguments.Body,
		BodyType: arguments.BodyType,
	})
}

func (d *Desk) sendRequest(ctx context.Context, current scene, arguments sendArguments) (Outcome, error) {
	if err := arguments.check(); err != nil {
		return Outcome{}, err
	}
	target, err := d.target(current, arguments)
	if err != nil {
		return Outcome{}, err
	}
	d.client.SetVariables(arguments.Variables)
	return d.client.Send(ctx, target, View{
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
		Error:       result.Error,
		FailedTests: failedChecks(result.Tests),
		Logs:        result.Logs,
	}
}

func digest(report runner.Report) runDigest {
	summary := runDigest{
		Environment: report.Environment,
		DurationMs:  report.DurationMs,
		Summary:     report.Summary,
		Failures:    []failedRequest{},
	}
	for _, result := range report.Results {
		if result.Failed {
			summary.Failures = append(summary.Failures, describeFailure(result))
		}
	}
	return summary
}

func (d *Desk) runFolder(ctx context.Context, current scene, arguments runArguments) (runDigest, error) {
	options := runner.Options{Folder: arguments.Folder, Bail: arguments.Bail}
	report, err := d.client.Run(ctx, current.stored, options, func(runner.Result) {})
	if err != nil {
		return runDigest{}, err
	}
	return digest(report), nil
}
