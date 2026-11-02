package agent

import (
	"context"
	"errors"
	"sync/atomic"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type Recorded struct {
	client  *Client
	display bool
	unclean atomic.Bool
}

var errUncleaned = errors.New("the output could not be cleaned of secret values, so it was withheld")

func NewRecorded(stored runner.Collection, folder string, options runner.Options, hideInReport bool) (*Recorded, error) {
	client, err := NewScopedClient(engine.Policy{Network: options.Network, ReadFile: options.Files}, redact.AllValues)
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
	cleaned, err := redact.Clean(r.client.guard, report)
	if err != nil {
		return runner.Report{}, errUncleaned
	}
	return cleaned, nil
}

func clean[T any](r *Recorded, value T) (T, bool) {
	if !r.display {
		return value, true
	}
	cleaned, err := redact.Clean(r.client.guard, value)
	if err != nil {
		r.unclean.Store(true)
		var none T
		return none, false
	}
	return cleaned, true
}

func (r *Recorded) finish(report runner.Report) (runner.Report, error) {
	if r.unclean.Load() {
		return runner.Report{}, errUncleaned
	}
	return r.shown(report)
}

func (r *Recorded) Run(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result)) (runner.Report, error) {
	report, err := r.client.session.Run(ctx, stored, options, func(result runner.Result) {
		r.client.absorbShared()
		if shown, ok := clean(r, result); ok {
			observe(shown)
		}
	})
	if err != nil {
		return runner.Report{}, err
	}
	r.client.absorb()
	return r.finish(report)
}

func (r *Recorded) RunFlow(ctx context.Context, stored runner.Collection, flow workspace.Flow, options runner.Options, watch runner.FlowWatch) (runner.Report, error) {
	report, err := r.client.session.RunFlow(ctx, stored, flow, options, runner.FlowWatch{
		Result: func(result runner.Result) {
			r.client.absorb()
			if shown, ok := clean(r, result); ok && watch.Result != nil {
				watch.Result(shown)
			}
		},
		Step: func(event runner.FlowEvent) {
			r.client.absorb()
			if shown, ok := clean(r, event); ok && watch.Step != nil {
				watch.Step(shown)
			}
		},
	})
	if err != nil {
		return runner.Report{}, err
	}
	r.client.absorb()
	return r.finish(report)
}
