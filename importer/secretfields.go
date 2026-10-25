package importer

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

const (
	secretFieldMark  = "."
	labelSecretField = "%s, key %s"
)

func (r secretRef) place() string {
	if r.Field == "" {
		return r.Path
	}
	return fmt.Sprintf(labelSecretField, r.Path, r.Field)
}

func (c *collector) placeholderNames() []string {
	encoded, err := json.Marshal([]any{c.Requests, c.Folders})
	if err != nil {
		return nil
	}
	seen := map[string]bool{}
	mapPlaceholders(string(encoded), func(inner string) string {
		seen[inner] = true
		return ""
	})
	names := make([]string, 0, len(seen))
	for name := range seen {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func withSecretFields(variables []envVariable, used []string) []envVariable {
	out := make([]envVariable, 0, len(variables))
	for _, variable := range variables {
		fields := secretFields(variable, used)
		if len(fields) == 0 || contains(used, variable.name) {
			out = append(out, variable)
		}
		out = append(out, fields...)
	}
	return out
}

func secretFields(variable envVariable, used []string) []envVariable {
	if variable.ref == nil {
		return nil
	}
	var fields []envVariable
	for _, name := range used {
		field, found := strings.CutPrefix(name, variable.name+secretFieldMark)
		if !found || field == "" {
			continue
		}
		ref := *variable.ref
		ref.Field = field
		fields = append(fields, envVariable{name: name, enabled: variable.enabled, ref: &ref})
	}
	return fields
}

func contains(names []string, name string) bool {
	index := sort.SearchStrings(names, name)
	return index < len(names) && names[index] == name
}
