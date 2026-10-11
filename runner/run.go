package runner

import (
	"context"
	"strings"
	"time"

	"github.com/krockxz/gostman/engine"
)

type Options struct {
	Environment string
	Folder      string
	Variables   map[string]string
	Bail        bool
	Delay       time.Duration
	Timeout     time.Duration
	Insecure    bool
}

func identify(request Request, folder string) Result {
	return Result{
		ID:     request.ID,
		Name:   request.Name,
		Folder: folder,
		Method: request.Method,
		URL:    request.URL,
		Tests:  []Check{},
		Logs:   []LogLine{},
	}
}

func hasFailedCheck(tests []Check) bool {
	for _, check := range tests {
		if !check.Passed {
			return true
		}
	}
	return false
}

func describe(request Request, folder string, outcome exchange) Result {
	result := identify(request, folder)
	if outcome.skipped != "" {
		result.Skipped = outcome.skipped
		return result
	}
	response := outcome.response
	result.Status = response.Status
	result.StatusCode = response.StatusCode
	result.Protocol = response.Protocol
	result.DurationMs = response.DurationMs
	result.Tests = append(result.Tests, outcome.tests...)
	result.Logs = append(result.Logs, outcome.logs...)
	result.Error = strings.Join(outcome.errors, "\n")
	if response.Error != "" {
		result.Error = response.Body
	}
	result.Failed = result.Error != "" || hasFailedCheck(result.Tests)
	return result
}

func (s *session) attempt(ctx context.Context, request Request, folder string) Result {
	outcome, err := s.execute(ctx, request)
	if err != nil {
		outcome.stop(err.Error())
	}
	return describe(request, folder, outcome)
}

func pause(ctx context.Context, delay time.Duration) {
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
	case <-ctx.Done():
	}
}

func (s *session) runAll(ctx context.Context, planned plan, options Options, observe func(Result)) []Result {
	results := make([]Result, 0, len(planned.requests))
	for index, request := range planned.requests {
		result := s.attempt(ctx, request, planned.folderNames[request.FolderID])
		results = append(results, result)
		observe(result)
		isLast := index == len(planned.requests)-1
		if ctx.Err() != nil || isLast || (options.Bail && result.Failed) {
			break
		}
		pause(ctx, options.Delay)
		if ctx.Err() != nil {
			break
		}
	}
	return results
}

func Run(ctx context.Context, stored Collection, options Options, observe func(Result)) (Report, error) {
	session, err := NewSession(engine.Policy{})
	if err != nil {
		return Report{}, err
	}
	if err := session.Enter(stored.Environments, options.Environment, options.Variables); err != nil {
		return Report{}, err
	}
	return session.Run(ctx, stored, options, observe)
}
