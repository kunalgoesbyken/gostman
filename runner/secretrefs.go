package runner

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/krockxz/gostman/secrets"
)

type Resolver interface {
	Resolve(ctx context.Context, ref secrets.Ref) (string, error)
}

var secretResolver Resolver

func UseResolver(resolver Resolver) {
	secretResolver = resolver
}

type referenceFlags map[string]struct {
	Enabled *bool        `json:"enabled"`
	Ref     *secrets.Ref `json:"ref"`
}

func lineage(environments []Environment, environment Environment) []Environment {
	visited := map[string]bool{}
	var chain []Environment
	for current, found := environment, true; found && !visited[current.ID]; {
		visited[current.ID] = true
		chain = append([]Environment{current}, chain...)
		current, found = findEnvironment(environments, current.Extends)
	}
	return chain
}

func (e Environment) references() (map[string]secrets.Ref, []string, error) {
	plain, err := parseVariables(e.Variables)
	if err != nil {
		return nil, nil, fmt.Errorf("environment %q cannot be used: %w", e.Name, err)
	}
	var flags referenceFlags
	if strings.TrimSpace(e.Meta) != "" {
		if err := json.Unmarshal([]byte(e.Meta), &flags); err != nil {
			return nil, nil, fmt.Errorf("environment %q has unreadable variable settings: %w", e.Name, err)
		}
	}
	found := map[string]secrets.Ref{}
	for name, flag := range flags {
		if flag.Ref != nil && (flag.Enabled == nil || *flag.Enabled) {
			found[name] = *flag.Ref
		}
	}
	return found, slices.Collect(maps.Keys(plain)), nil
}

func referencedVariables(environments []Environment, environment Environment, overrides map[string]string) (map[string]secrets.Ref, error) {
	wanted := map[string]secrets.Ref{}
	for _, link := range lineage(environments, environment) {
		found, defined, err := link.references()
		if err != nil {
			return nil, err
		}
		for _, name := range defined {
			delete(wanted, name)
		}
		maps.Copy(wanted, found)
	}
	for name := range overrides {
		delete(wanted, name)
	}
	return wanted, nil
}

func resolveReferences(ctx context.Context, environments []Environment, environment Environment, overrides map[string]string) (map[string]string, error) {
	wanted, err := referencedVariables(environments, environment, overrides)
	if err != nil || len(wanted) == 0 {
		return nil, err
	}
	if secretResolver == nil {
		return nil, errors.New("the environment has secret manager references, but no secret manager connection is configured")
	}
	resolved := make(map[string]string, len(wanted))
	for _, name := range slices.Sorted(maps.Keys(wanted)) {
		value, err := secretResolver.Resolve(ctx, wanted[name])
		if err != nil {
			return nil, fmt.Errorf("variable %q: %w", name, err)
		}
		resolved[name] = value
	}
	return resolved, nil
}

func (s *Session) Resolved() map[string]string {
	return maps.Clone(s.resolved)
}
