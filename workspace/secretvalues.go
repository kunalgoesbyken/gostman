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

type variableMark struct {
	Secret  bool  `json:"secret,omitempty"`
	Enabled *bool `json:"enabled,omitempty"`
}

func (m variableMark) kept() variableMark {
	if m.Enabled != nil && *m.Enabled {
		m.Enabled = nil
	}
	return m
}

func VariableMarks(meta string) string {
	var marks map[string]variableMark
	if json.Unmarshal([]byte(meta), &marks) != nil {
		return ""
	}
	kept := map[string]variableMark{}
	for name, mark := range marks {
		if mark = mark.kept(); mark != (variableMark{}) {
			kept[name] = mark
		}
	}
	if len(kept) == 0 {
		return ""
	}
	encoded, _ := json.Marshal(kept)
	return string(encoded)
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
