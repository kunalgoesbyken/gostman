package importer

import (
	"encoding/json"
	"maps"
	"slices"

	"github.com/kunalgoesbyken/gostman/workspace"
)

func (r Result) Collection() (workspace.Collection, error) {
	collection := workspace.Collection{Requests: r.Requests, Folders: r.Folders, Environments: append(append([]workspace.Environment{}, r.Environments...), r.Globals...), VariablesMeta: r.VariablesMeta, SharedOrder: r.SharedOrder, Flows: r.Flows}
	if r.Settings != nil {
		collection.Settings = *r.Settings
	}
	if len(r.Variables) == 0 {
		return collection, nil
	}
	encoded, err := json.Marshal(r.Variables)
	collection.Variables = string(encoded)
	return collection, err
}

func (r Result) GlobalsAsVariables() Result {
	if len(r.Globals) == 0 {
		return r
	}
	merged, secret := map[string]string{}, map[string]bool{}
	for _, global := range r.Globals {
		values, hidden := valuesWithoutSecrets(global)
		for name, value := range values {
			merged[name] = value
			secret[name] = slices.Contains(hidden, name)
		}
	}
	maps.Copy(merged, r.Variables)
	for name := range r.Variables {
		delete(secret, name)
	}
	r.Variables = merged
	r.VariablesMeta = workspace.MarkSecret(r.VariablesMeta, markedNames(secret)...)
	r.Globals = nil
	return r.scriptsReadingCollection()
}

func markedNames(marks map[string]bool) []string {
	return slices.DeleteFunc(sortedKeys(marks), func(name string) bool { return !marks[name] })
}

func valuesWithoutSecrets(environment workspace.Environment) (map[string]string, []string) {
	kept, secret := workspace.WithoutSecretValues(environment)
	var flags map[string]variableFlags
	_ = json.Unmarshal([]byte(environment.Meta), &flags)
	values := map[string]string{}
	entries, _ := workspace.ParseVariableEntries(kept.Variables)
	for _, entry := range entries {
		if switchedOff(flags[entry.Name]) {
			continue
		}
		var value any
		if json.Unmarshal(entry.Raw, &value) == nil {
			values[entry.Name] = text(value)
		}
	}
	for _, name := range secret {
		values[name] = ""
	}
	return values, secret
}

func switchedOff(flags variableFlags) bool {
	return flags.Enabled != nil && !*flags.Enabled
}
