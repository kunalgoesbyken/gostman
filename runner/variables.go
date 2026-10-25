package runner

import (
	"bytes"
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

func startingSlot(environments []Environment, environment Environment, overrides, resolved map[string]string) (*environmentSlot, error) {
	scopes, err := environmentScopes(environments, environment)
	if err != nil {
		return nil, err
	}
	last := len(scopes) - 1
	slot := &environmentSlot{name: environment.Name, inherited: layered(scopes[:last]...), own: scopes[last]}
	slot.own.override(overrides)
	for name, value := range resolved {
		target := slot.own
		if _, isOwn := slot.own[name]; !isOwn && slot.inherited[name] != nil {
			target = slot.inherited
		}
		target.override(map[string]string{name: value})
	}
	return slot, nil
}

type variableRow struct {
	Key     string `json:"key"`
	Value   any    `json:"value"`
	Enabled *bool  `json:"enabled"`
}

func (r Request) OwnVariables() map[string]string {
	return requestScope(r.Vars).plain()
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

const scopeSession = "session"

type scopedWrites map[string]variables

func isNull(value json.RawMessage) bool {
	return bytes.Equal(bytes.TrimSpace(value), []byte("null"))
}

func (v variables) change(changes variables) {
	for name, value := range changes {
		if isNull(value) {
			delete(v, name)
			continue
		}
		v[name] = value
	}
}

func (v variables) withValues() variables {
	kept := variables{}
	for name, value := range v {
		if !isNull(value) {
			kept[name] = value
		}
	}
	return kept
}

func (v variables) forget(changes variables) {
	for name := range changes {
		delete(v, name)
	}
}

func baseScopes(stored Collection) (variables, variables, variables, error) {
	collection, err := Environment{Variables: stored.Variables, Meta: stored.VariablesMeta}.ownScope()
	if err != nil {
		return nil, nil, nil, fmt.Errorf("the collection variables are not a JSON object")
	}
	globals, err := globalScope(stored.Globals)
	if err != nil {
		return nil, nil, nil, err
	}
	processed := variables{}
	for name, value := range stored.DotEnv {
		encoded, _ := json.Marshal(value)
		processed[processEnvironmentPrefix+name] = encoded
	}
	return processed, globals, collection, nil
}

func globalScope(globals []Environment) (variables, error) {
	if len(globals) == 0 {
		return variables{}, nil
	}
	return globals[0].ownScope()
}
