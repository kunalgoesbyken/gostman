package agent

import (
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

func Scrubber(stored runner.Collection, options runner.Options) (func(string) string, error) {
	client, err := NewScopedClient(engine.Policy{Network: options.Network}, redact.SecretValues)
	if err != nil {
		return nil, err
	}
	client.MarkSecret(options.Secrets)
	if err := client.EnterFolder(stored, options.Folder, options.Environment, options.Variables); err != nil {
		return nil, err
	}
	return client.Text, nil
}
