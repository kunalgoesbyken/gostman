package agent

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/kunalgoesbyken/gostman/loadtest"
	"github.com/kunalgoesbyken/gostman/mcp"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	highestLoadConcurrency = 20
	highestLoadSeconds     = 30
	highestLoadRequests    = 5000
	highestLoadRate        = 1000
	defaultLoadConcurrency = 5
)

type loadArguments struct {
	Request         string `json:"request"`
	Concurrency     int    `json:"concurrency"`
	DurationSeconds int    `json:"duration_seconds"`
	Requests        int    `json:"requests"`
	RatePerSecond   int    `json:"rps"`
}

func (c *Client) LoadTest(ctx context.Context, listed runner.Listed, config loadtest.Config, observe func(loadtest.Snapshot)) (loadtest.Report, error) {
	prepared, err := c.session.Outgoing(ctx, listed.Request)
	c.absorb()
	if err != nil {
		return loadtest.Report{}, err
	}
	report, err := loadtest.Run(ctx, loadtest.Plan{Config: config, Request: prepared, Policy: c.policy}, observe)
	if err != nil {
		return loadtest.Report{}, err
	}
	return redact.Clean(c.guard, report)
}

func (a loadArguments) config() (loadtest.Config, error) {
	switch {
	case a.Concurrency < 0 || a.Concurrency > highestLoadConcurrency:
		return loadtest.Config{}, fmt.Errorf("concurrency must be between 1 and %d.", highestLoadConcurrency)
	case a.DurationSeconds < 0 || a.DurationSeconds > highestLoadSeconds:
		return loadtest.Config{}, fmt.Errorf("duration_seconds must be between 1 and %d.", highestLoadSeconds)
	case a.Requests < 0 || a.Requests > highestLoadRequests:
		return loadtest.Config{}, fmt.Errorf("requests must be between 1 and %d.", highestLoadRequests)
	case a.RatePerSecond < 0 || a.RatePerSecond > highestLoadRate:
		return loadtest.Config{}, fmt.Errorf("rps must be between 1 and %d.", highestLoadRate)
	}
	config := loadtest.Config{
		Concurrency:   a.Concurrency,
		DurationMs:    a.DurationSeconds * int(time.Second/time.Millisecond),
		Requests:      a.Requests,
		RatePerSecond: a.RatePerSecond,
	}
	if config.Concurrency == 0 {
		config.Concurrency = defaultLoadConcurrency
	}
	if config.DurationMs == 0 && config.Requests == 0 {
		config.DurationMs = int(loadtest.DefaultDuration / time.Millisecond)
	}
	if config.DurationMs == 0 {
		config.DurationMs = highestLoadSeconds * int(time.Second/time.Millisecond)
	}
	return config.Normalized(), nil
}

func loadProgress(ctx context.Context, config loadtest.Config) func(loadtest.Snapshot) {
	return func(snapshot loadtest.Snapshot) {
		message := fmt.Sprintf("%d sent, %d failed, %.0f per second, p95 %.0f ms", snapshot.Total, snapshot.Failed, snapshot.RequestsPerSecond, snapshot.P95Ms)
		if config.Requests > 0 {
			mcp.Progress(ctx, float64(snapshot.Total), float64(config.Requests), message)
			return
		}
		mcp.Progress(ctx, float64(snapshot.ElapsedMs), float64(config.DurationMs), message)
	}
}

func (d *Desk) loadTest(ctx context.Context, current scene, arguments loadArguments) (loadtest.Report, error) {
	if !hasText(arguments.Request) {
		return loadtest.Report{}, errors.New("Name the saved request to load test; list_requests shows them.")
	}
	config, err := arguments.config()
	if err != nil {
		return loadtest.Report{}, err
	}
	target, err := d.find(current.stored, arguments.Request)
	if err != nil {
		return loadtest.Report{}, err
	}
	target.Request = d.tune(target.Request)
	var report loadtest.Report
	d.outside(func() {
		report, err = d.client.LoadTest(ctx, target, config, loadProgress(ctx, config))
	})
	return report, err
}
