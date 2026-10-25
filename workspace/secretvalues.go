package workspace

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
)

var errNotObject = errors.New("the variables are not a JSON object")

type VariableEntry struct {
	Name string
	Raw  json.RawMessage
}

type secretFlags map[string]struct {
	Secret bool `json:"secret"`
}

func ParseVariableEntries(text string) ([]VariableEntry, error) {
	if strings.TrimSpace(text) == "" {
		return nil, nil
	}
	decoder := json.NewDecoder(strings.NewReader(text))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return nil, errNotObject
	}
	var entries []VariableEntry
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		name, isName := token.(string)
		if !isName {
			return nil, errNotObject
		}
		var raw json.RawMessage
		if err := decoder.Decode(&raw); err != nil {
			return nil, err
		}
		entries = append(entries, VariableEntry{Name: name, Raw: raw})
	}
	return entries, nil
}

func EncodeVariableEntries(entries []VariableEntry) string {
	var encoded bytes.Buffer
	encoded.WriteByte('{')
	for index, entry := range entries {
		if index > 0 {
			encoded.WriteByte(',')
		}
		name, _ := json.Marshal(entry.Name)
		encoded.Write(name)
		encoded.WriteByte(':')
		encoded.Write(entry.Raw)
	}
	encoded.WriteByte('}')
	return encoded.String()
}

func secretVariables(meta string) map[string]bool {
	var flags secretFlags
	json.Unmarshal([]byte(meta), &flags)
	secret := map[string]bool{}
	for name, flag := range flags {
		secret[name] = flag.Secret
	}
	return secret
}

func SecretNames(meta string) map[string]bool {
	names := map[string]bool{}
	for name, secret := range secretVariables(meta) {
		if secret {
			names[name] = true
		}
	}
	return names
}

func WithoutSecretValues(environment Environment) (Environment, []string) {
	var removed []string
	environment.Variables, removed = WithoutSecretVariables(environment.Variables, environment.Meta)
	return environment, removed
}

func WithoutSecretVariables(variables, meta string) (string, []string) {
	secret := secretVariables(meta)
	entries, err := ParseVariableEntries(variables)
	if err != nil || len(secret) == 0 {
		return variables, nil
	}
	var removed []string
	kept := make([]VariableEntry, 0, len(entries))
	for _, entry := range entries {
		if secret[entry.Name] {
			removed = append(removed, entry.Name)
			continue
		}
		kept = append(kept, entry)
	}
	if len(removed) == 0 {
		return variables, nil
	}
	return EncodeVariableEntries(kept), removed
}

type VariableList struct {
	Name      string
	Variables string
	Meta      string
}

type DroppedVariable struct {
	Name     string
	From     string
	KeptFrom string
}

func FoldVariableLists(variables, meta string, lists []VariableList) (string, string, []DroppedVariable) {
	entries, err := ParseVariableEntries(variables)
	if err != nil {
		return variables, meta, nil
	}
	kept := map[string]json.RawMessage{}
	owner := map[string]string{}
	claimable := map[string]bool{}
	for _, entry := range entries {
		kept[entry.Name] = entry.Raw
		claimable[entry.Name] = true
	}
	added := false
	var dropped []DroppedVariable
	for _, list := range lists {
		owned, err := ParseVariableEntries(list.Variables)
		if err != nil {
			continue
		}
		secret := SecretNames(list.Meta)
		for _, entry := range owned {
			if current, taken := kept[entry.Name]; taken {
				switch {
				case sameValue(current, entry.Raw) && claimable[entry.Name]:
					owner[entry.Name] = list.Name
					claimable[entry.Name] = false
				case !sameValue(current, entry.Raw):
					dropped = append(dropped, DroppedVariable{Name: entry.Name, From: list.Name, KeptFrom: owner[entry.Name]})
				}
				continue
			}
			kept[entry.Name] = entry.Raw
			owner[entry.Name] = list.Name
			entries = append(entries, entry)
			added = true
			if secret[entry.Name] {
				meta = MarkSecret(meta, entry.Name)
			}
		}
	}
	if !added {
		return variables, meta, dropped
	}
	return EncodeVariableEntries(entries), meta, dropped
}

func sameValue(first, second json.RawMessage) bool {
	return plainValue(first) == plainValue(second)
}

func plainValue(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	return string(bytes.TrimSpace(raw))
}

func MarkSecret(meta string, names ...string) string {
	if len(names) == 0 {
		return meta
	}
	marks := map[string]map[string]any{}
	json.Unmarshal([]byte(meta), &marks)
	for _, name := range names {
		if marks[name] == nil {
			marks[name] = map[string]any{}
		}
		marks[name]["secret"] = true
	}
	encoded, _ := json.Marshal(marks)
	return string(encoded)
}
