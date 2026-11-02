package agent

import (
	"context"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type Recorded struct {
	client  *Client
	display bool
}

func NewRecorded(stored runner.Collection, folder string, options runner.Options, hideInReport bool) (*Recorded, error) {
	scope := redact.AllValues
	if hideInReport {
		scope = redact.SecretValues
	}
	client, err := NewScopedClient(engine.Policy{Network: options.Network, ReadFile: options.Files}, scope)
	if err != nil {
		return nil, err
	}
	client.MarkSecret(options.Secrets)
	if err := client.EnterFolder(stored, folder, options.Environment, options.Variables); err != nil {
		return nil, err
	}
	if options.SignIn.AccessToken != "" || options.SignIn.RefreshToken != "" {
		client.SignIn(options.SignIn)
	}
	client.learnAll(options.DataValues())
	return &Recorded{client: client, display: hideInReport}, nil
}

func (r *Recorded) Text(text string) string {
	return r.client.Text(text)
}

func (r *Recorded) shown(report runner.Report) (runner.Report, error) {
	if !r.display {
		return report, nil
	}
	return redact.Clean(r.client.guard, report)
}

func (r *Recorded) Run(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result)) (runner.Report, error) {
	report, err := r.client.session.Run(ctx, stored, options, func(result runner.Result) {
		r.client.absorbShared()
		if r.display {
			if cleaned, err := redact.Clean(r.client.guard, result); err == nil {
				result = cleaned
			}
		}
		observe(result)
	})
	if err != nil {
		return runner.Report{}, err
	}
	r.client.absorb()
	return r.shown(report)
}

func (r *Recorded) RunFlow(ctx context.Context, stored runner.Collection, flow workspace.Flow, options runner.Options, watch runner.FlowWatch) (runner.Report, error) {
	report, err := r.client.session.RunFlow(ctx, stored, flow, options, runner.FlowWatch{
		Result: func(result runner.Result) {
			r.client.absorb()
			if r.display {
				if cleaned, err := redact.Clean(r.client.guard, result); err == nil {
					result = cleaned
				}
			}
			if watch.Result != nil {
				watch.Result(result)
			}
		},
		Step: func(event runner.FlowEvent) {
			r.client.absorb()
			if r.display {
				if cleaned, err := redact.Clean(r.client.guard, event); err == nil {
					event = cleaned
				}
			}
			if watch.Step != nil {
				watch.Step(event)
			}
		},
	})
	if err != nil {
		return runner.Report{}, err
	}
	r.client.absorb()
	return r.shown(report)
}
