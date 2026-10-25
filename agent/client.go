package agent

import (
	"context"
	"maps"
	"slices"
	"sort"
	"sync"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type Client struct {
	session *runner.Session
	catalog *runner.Session
	guard   *redact.Redactor
	policy  engine.Policy
	secrets sync.Map
	labels  sync.Map
}

func NewClient(policy engine.Policy) (*Client, error) {
	return NewScopedClient(policy, redact.AllValues)
}

func NewScopedClient(policy engine.Policy, scope redact.Scope) (*Client, error) {
	session, err := runner.NewSession(policy)
	if err != nil {
		return nil, err
	}
	client := &Client{session: session, catalog: session, guard: redact.NewScoped(scope), policy: policy}
	session.Watch(client.witness)
	return client, nil
}

func (c *Client) separateCatalog() error {
	catalog, err := runner.NewSession(c.policy)
	c.catalog = catalog
	return err
}

func sorted(names []string) []string {
	sort.Strings(names)
	return names
}

func sortedKeys(values map[string]string) []string {
	return slices.Sorted(maps.Keys(values))
}

func (c *Client) Enter(stored runner.Collection, environment string, overrides map[string]string) error {
	return c.EnterFolder(stored, "", environment, overrides)
}

func (c *Client) EnterFolder(stored runner.Collection, folder, environment string, overrides map[string]string) error {
	c.markSecrets(stored)
	if err := c.session.Enter(stored, folder, environment, overrides); err != nil {
		return err
	}
	c.absorb()
	return c.Study(stored)
}

func (c *Client) SetVariables(overrides map[string]string) {
	c.session.Set(overrides)
	c.absorb()
}

func (c *Client) SignIn(token engine.Token) {
	c.session.SignIn(token)
	signedIn := engine.OAuth2{AccessToken: token.AccessToken, RefreshToken: token.RefreshToken}
	for _, field := range tokenFields(&signedIn) {
		c.learnResolved(field.label, *field.value)
	}
}

func (c *Client) Remember(values map[string]string) {
	c.session.Remember(values)
	c.absorb()
}

func (c *Client) Find(stored runner.Collection, reference string) (runner.Listed, error) {
	return c.catalog.Find(stored, reference)
}

func (c *Client) Text(text string) string {
	return c.guard.Text(text)
}

func (c *Client) Run(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result)) (runner.Report, error) {
	c.learnAll(options.DataValues())
	report, err := c.session.Run(ctx, stored, options, func(result runner.Result) {
		c.absorbShared()
		if cleaned, err := redact.Clean(c.guard, result); err == nil {
			observe(cleaned)
		}
	})
	if err != nil {
		return runner.Report{}, err
	}
	c.absorb()
	return redact.Clean(c.guard, report)
}

func Redacting(secrets map[string]bool) func(context.Context, runner.Collection, runner.Options, func(runner.Result)) (runner.Report, error) {
	return func(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result)) (runner.Report, error) {
		return runRedacted(ctx, stored, options, observe, secrets)
	}
}

func runRedacted(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result), secrets map[string]bool) (runner.Report, error) {
	client, err := NewScopedClient(engine.Policy{Network: options.Network, ReadFile: options.Files}, redact.SecretValues)
	if err != nil {
		return runner.Report{}, err
	}
	client.MarkSecret(secrets)
	if err := client.EnterFolder(stored, options.Folder, options.Environment, options.Variables); err != nil {
		return runner.Report{}, err
	}
	return client.Run(ctx, stored, options, observe)
}

func (c *Client) RunFlow(ctx context.Context, stored runner.Collection, flow workspace.Flow, options runner.Options, watch runner.FlowWatch) (runner.Report, error) {
	report, err := c.session.RunFlow(ctx, stored, flow, options, runner.FlowWatch{
		Result: func(result runner.Result) {
			c.absorbShared()
			if cleaned, err := redact.Clean(c.guard, result); err == nil && watch.Result != nil {
				watch.Result(cleaned)
			}
		},
		Step: func(event runner.FlowEvent) {
			c.absorbShared()
			if cleaned, err := redact.Clean(c.guard, event); err == nil && watch.Step != nil {
				watch.Step(cleaned)
			}
		},
	})
	if err != nil {
		return runner.Report{}, err
	}
	c.absorb()
	return redact.Clean(c.guard, report)
}

func RedactingFlow(secrets map[string]bool) func(context.Context, runner.Collection, workspace.Flow, runner.Options, runner.FlowWatch) (runner.Report, error) {
	return func(ctx context.Context, stored runner.Collection, flow workspace.Flow, options runner.Options, watch runner.FlowWatch) (runner.Report, error) {
		client, err := NewScopedClient(engine.Policy{Network: options.Network, ReadFile: options.Files}, redact.SecretValues)
		if err != nil {
			return runner.Report{}, err
		}
		client.MarkSecret(secrets)
		if err := client.EnterFolder(stored, "", options.Environment, options.Variables); err != nil {
			return runner.Report{}, err
		}
		return client.RunFlow(ctx, stored, flow, options, watch)
	}
}
