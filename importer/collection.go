package importer

import (
	"encoding/json"
	"fmt"
	"maps"

	"github.com/kunalgoesbyken/gostman/workspace"
)

func (r Result) Collection() (workspace.Collection, error) {
	collection, _, err := r.Folded()
	return collection, err
}

func (r Result) Folded() (workspace.Collection, []string, error) {
	collection := workspace.Collection{Requests: r.Requests, Folders: r.Folders, Environments: append(append([]workspace.Environment{}, r.Environments...), r.Globals...), SharedOrder: r.SharedOrder}
	var shared string
	if len(r.Variables) > 0 {
		encoded, err := json.Marshal(r.Variables)
		if err != nil {
			return collection, nil, err
		}
		shared = string(encoded)
	}
	var dropped []workspace.DroppedVariable
	collection.Variables, collection.VariablesMeta, dropped = workspace.FoldVariableLists(shared, r.VariablesMeta, OwnedLists(r.Folders))
	return collection, droppedWarnings(dropped), nil
}

func droppedWarnings(dropped []workspace.DroppedVariable) []string {
	warnings := make([]string, len(dropped))
	for i, variable := range dropped {
		if variable.KeptFrom == "" {
			warnings[i] = fmt.Sprintf(messageDroppedShared, variable.Name, variable.From)
			continue
		}
		warnings[i] = fmt.Sprintf(messageDroppedVariable, variable.Name, variable.From, variable.KeptFrom)
	}
	return warnings
}

func OwnedLists(folders []workspace.Folder) []workspace.VariableList {
	lists := make([]workspace.VariableList, len(folders))
	for i, folder := range folders {
		lists[i] = workspace.VariableList{Name: folder.Name, Variables: folder.CollectionVariables, Meta: folder.CollectionVariablesMeta}
	}
	return lists
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
