package runner

import (
	"encoding/json"
	"fmt"
	"strings"
)

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

func startingVariables(environment Environment, overrides map[string]string) (variables, error) {
	parsed, err := parseVariables(environment.Variables)
	if err != nil {
		return nil, fmt.Errorf("environment %q cannot be used: %w", environment.Name, err)
	}
	parsed.override(overrides)
	return parsed, nil
}
