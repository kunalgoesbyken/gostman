package agent

import (
	"context"

	"github.com/kunalgoesbyken/gostman/loadtest"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

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
