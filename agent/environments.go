package agent

import (
	"context"
	"errors"
	"maps"
	"slices"

	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type noArguments struct{}

type environmentArguments struct {
	Name string `json:"name"`
}

type environmentLine struct {
	Name      string   `json:"name"`
	Active    bool     `json:"active"`
	Variables []string `json:"variables"`
	Secret    []string `json:"secret,omitempty"`
}

type environmentList struct {
	Active           string            `json:"active"`
	Environments     []environmentLine `json:"environments"`
	SessionVariables []string          `json:"sessionVariables"`
}

func (d *Desk) sessionVariableNames() []string {
	values := d.client.session.Variables()
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	return sorted(names)
}

func (d *Desk) describeEnvironments(environments []runner.Environment) environmentList {
	active := d.client.session.Environment()
	list := environmentList{
		Active:           active,
		Environments:     make([]environmentLine, 0, len(environments)),
		SessionVariables: d.sessionVariableNames(),
	}
	for _, environment := range environments {
		secret := slices.Sorted(maps.Keys(workspace.SecretNames(environment.Meta)))
		list.Environments = append(list.Environments, environmentLine{
			Name:      environment.Name,
			Active:    environment.Name == active,
			Variables: slices.Compact(sorted(append(variableNames(environment), secret...))),
			Secret:    secret,
		})
	}
	return list
}

func (d *Desk) listEnvironments(_ context.Context, current scene, _ noArguments) (environmentList, error) {
	return d.describeEnvironments(current.stored.Environments), nil
}

func (d *Desk) setEnvironment(_ context.Context, current scene, arguments environmentArguments) (environmentList, error) {
	if !hasText(arguments.Name) {
		return environmentList{}, errors.New("Name the environment; list_environments shows the names.")
	}
	if err := d.client.Enter(current.stored, arguments.Name, d.startup); err != nil {
		return environmentList{}, err
	}
	return d.describeEnvironments(current.stored.Environments), nil
}
