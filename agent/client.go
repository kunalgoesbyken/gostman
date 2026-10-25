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
	return c.EnterFolder(stored, "", environment, overrides)
}

func (c *Client) EnterFolder(stored runner.Collection, folder, environment string, overrides map[string]string) error {
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

func RunRedacted(ctx context.Context, stored runner.Collection, options runner.Options, observe func(runner.Result)) (runner.Report, error) {
	client, err := NewClient(engine.Policy{Network: options.Network, ReadFile: options.Files})
	if err != nil {
		return runner.Report{}, err
	}
	if err := client.EnterFolder(stored, options.Folder, options.Environment, options.Variables); err != nil {
		return runner.Report{}, err
	}
	return client.Run(ctx, stored, options, observe)
}
