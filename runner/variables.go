package runner

import (
	"encoding/json"
	"fmt"
	"strings"
)

const processEnvironmentPrefix = "process.env."

type variables map[string]json.RawMessage

func parseVariables(text string) (variables, error) {
	parsed := variables{}
	if strings.TrimSpace(text) == "" {
		return parsed, nil
	}
	if err := json.Unmarshal([]byte(text), &parsed); err != nil || parsed == nil {
		return nil, fmt.Errorf("its variables are not a JSON object")
	}
	return parsed, nil
}

func (v variables) text() string {
	encoded, _ := json.Marshal(v)
	return string(encoded)
}

func (v variables) merge(additions variables) {
	for name, value := range additions {
		v[name] = value
	}
}

func (v variables) override(overrides map[string]string) {
	for name, value := range overrides {
		encoded, _ := json.Marshal(value)
		v[name] = encoded
	}
}

func selectEnvironment(environments []Environment, name string) (Environment, error) {
	if name == "" {
		if len(environments) == 0 {
			return Environment{}, nil
		}
		return environments[0], nil
	}
	names := make([]string, 0, len(environments))
	for _, environment := range environments {
		if environment.Name == name {
			return environment, nil
		}
		names = append(names, environment.Name)
	}
	if len(names) == 0 {
		return Environment{}, fmt.Errorf("there is no environment named %q: the collection has no environments", name)
	}
	return Environment{}, fmt.Errorf("there is no environment named %q; the collection has %s", name, strings.Join(names, ", "))
}

func layered(scopes ...variables) variables {
	merged := variables{}
	for _, scope := range scopes {
		merged.merge(scope)
	}
	return merged
}

type variableFlags map[string]struct {
	Enabled *bool `json:"enabled"`
}

func (e Environment) ownScope() (variables, error) {
	parsed, err := parseVariables(e.Variables)
	if err != nil {
		return nil, fmt.Errorf("environment %q cannot be used: %w", e.Name, err)
	}
	var flags variableFlags
	if strings.TrimSpace(e.Meta) != "" {
		if err := json.Unmarshal([]byte(e.Meta), &flags); err != nil {
			return nil, fmt.Errorf("environment %q has unreadable variable settings: %w", e.Name, err)
		}
	}
	for name, flag := range flags {
		if flag.Enabled != nil && !*flag.Enabled {
			delete(parsed, name)
		}
	}
	return parsed, nil
}

func environmentScopes(environments []Environment, environment Environment) ([]variables, error) {
	visited := map[string]bool{}
	var chain []Environment
	for current, found := environment, true; found && !visited[current.ID]; {
		visited[current.ID] = true
		chain = append([]Environment{current}, chain...)
		current, found = findEnvironment(environments, current.Extends)
	}
	scopes := make([]variables, 0, len(chain))
	for _, link := range chain {
		scope, err := link.ownScope()
		if err != nil {
			return nil, err
		}
		scopes = append(scopes, scope)
	}
	return scopes, nil
}

func findEnvironment(environments []Environment, id string) (Environment, bool) {
	for _, candidate := range environments {
		if id != "" && candidate.ID == id {
			return candidate, true
		}
	}
	return Environment{}, false
}

func startingVariables(environments []Environment, environment Environment, overrides map[string]string) (variables, error) {
	scopes, err := environmentScopes(environments, environment)
	if err != nil {
		return nil, err
	}
	starting := layered(scopes...)
	starting.override(overrides)
	return starting, nil
}

type variableRow struct {
	Key     string `json:"key"`
	Value   any    `json:"value"`
	Enabled *bool  `json:"enabled"`
}

func requestScope(text string) variables {
	scope := variables{}
	var rows []variableRow
	if json.Unmarshal([]byte(text), &rows) != nil {
		return scope
	}
	for _, row := range rows {
		if strings.TrimSpace(row.Key) == "" || (row.Enabled != nil && !*row.Enabled) {
			continue
		}
		encoded, _ := json.Marshal(row.Value)
		scope[row.Key] = encoded
	}
	return scope
}

func (v variables) withRequest(text string) variables {
	if strings.TrimSpace(text) == "" {
		return v
	}
	return layered(v, requestScope(text))
}

func baseScopes(stored Collection) ([]variables, error) {
	collection, err := parseVariables(stored.Variables)
	if err != nil {
		return nil, fmt.Errorf("the collection variables are not a JSON object")
	}
	processed := variables{}
	for name, value := range stored.DotEnv {
		encoded, _ := json.Marshal(value)
		processed[processEnvironmentPrefix+name] = encoded
	}
	return []variables{processed, collection}, nil
}
