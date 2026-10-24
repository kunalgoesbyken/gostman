package importer

import (
	"encoding/json"
	"maps"

	"github.com/kunalgoesbyken/gostman/workspace"
)

func (r Result) Collection() (workspace.Collection, error) {
	collection := workspace.Collection{Requests: r.Requests, Folders: r.Folders, Environments: append(append([]workspace.Environment{}, r.Environments...), r.Globals...)}
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
	merged := map[string]string{}
	for _, global := range r.Globals {
		maps.Copy(merged, valuesWithoutSecrets(global))
	}
	maps.Copy(merged, r.Variables)
	r.Variables = merged
	r.Globals = nil
	return r
}

func valuesWithoutSecrets(environment workspace.Environment) map[string]string {
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
	return values
}

func switchedOff(flags variableFlags) bool {
	return flags.Enabled != nil && !*flags.Enabled
}
