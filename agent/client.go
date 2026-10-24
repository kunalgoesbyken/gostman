package agent

import (
	"context"
	"maps"
	"slices"
	"sort"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

type Client struct {
	session *runner.Session
	catalog *runner.Session
	guard   *redact.Redactor
	policy  engine.Policy
}

func NewClient(policy engine.Policy) (*Client, error) {
	session, err := runner.NewSession(policy)
	if err != nil {
		return nil, err
	}
	client := &Client{session: session, catalog: session, guard: redact.New(), policy: policy}
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
	if err := c.session.Enter(stored.Environments, environment, overrides); err != nil {
		return err
	}
	c.fillDefaults(stored)
	c.absorb()
	return c.Study(stored)
}

func (c *Client) fillDefaults(stored runner.Collection) {
	defaults, _ := runner.Environment{Variables: stored.Variables}.Values()
	defined := c.session.Variables()
	missing := map[string]string{}
	for name, value := range defaults {
		if _, set := defined[name]; !set {
			missing[name] = value
		}
	}
	c.session.Set(missing)
}

func (c *Client) SetVariables(overrides map[string]string) {
	c.session.Set(overrides)
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

func RunRedacted(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result)) (runner.Report, error) {
	client, err := NewClient(engine.Policy{Network: options.Network, ReadFile: options.Files})
	if err != nil {
		return runner.Report{}, err
	}
	if err := client.Enter(stored, options.Environment, options.Variables); err != nil {
		return runner.Report{}, err
	}
	return client.Run(ctx, stored, options, observe)
}
