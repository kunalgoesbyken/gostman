package importer

import (
	"path"
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	restClientEnvironments = "rest-client.environmentVariables"
	sharedEnvironment      = "$shared"
	httpPublicEnvironment  = "http-client.env.json"
	httpPrivateEnvironment = "http-client.private.env.json"
	editorSettings         = "settings.json"
)

type httpEnvironments struct {
	order   []string
	values  map[string]map[string]string
	secrets map[string]map[string]bool
}

func classifyNamed(name string, data any) string {
	if isHTTPClientEnvironment(name, data) {
		return kindHTTPEnvironment
	}
	return classifyStructured(data)
}

func isHTTPClientEnvironment(name string, data any) bool {
	base := strings.ToLower(path.Base(name))
	root := object(data)
	if base != httpPublicEnvironment && base != httpPrivateEnvironment || len(root) == 0 {
		return false
	}
	for _, value := range root {
		if object(value) == nil {
			return false
		}
	}
	return true
}

func isPrivateEnvironment(name string) bool {
	return strings.ToLower(path.Base(name)) == httpPrivateEnvironment
}

func decodeNamed(name, source string) (any, error) {
	data, err := decodeStructured(source)
	if err != nil && strings.ToLower(path.Base(name)) == editorSettings {
		return decodeStructured(scanJSON(scanJSON(source, commentLength), trailingCommaLength))
	}
	return data, err
}

func scanJSON(source string, skipped func(string) int) string {
	var out strings.Builder
	inString, escaped := false, false
	for index := 0; index < len(source); {
		if !inString {
			if length := skipped(source[index:]); length > 0 {
				index += length
				continue
			}
		}
		char := source[index]
		out.WriteByte(char)
		index++
		switch {
		case escaped:
			escaped = false
		case inString && char == '\\':
			escaped = true
		case char == '"':
			inString = !inString
		}
	}
	return out.String()
}

func commentLength(rest string) int {
	switch {
	case strings.HasPrefix(rest, "//"):
		if end := strings.IndexByte(rest, '\n'); end >= 0 {
			return end
		}
		return len(rest)
	case strings.HasPrefix(rest, "/*"):
		if end := strings.Index(rest[2:], "*/"); end >= 0 {
			return end + 4
		}
		return len(rest)
	}
	return 0
}

func trailingCommaLength(rest string) int {
	if rest[0] != ',' {
		return 0
	}
	next := strings.TrimLeft(rest[1:], " \t\r\n")
	if next != "" && (next[0] == '}' || next[0] == ']') {
		return 1
	}
	return 0
}

func (c *collector) readHTTPEnvironments(docs []document) {
	sort.SliceStable(docs, func(i, j int) bool {
		return !isPrivateEnvironment(docs[i].file.Name) && isPrivateEnvironment(docs[j].file.Name)
	})
	names := make([]string, len(docs))
	for index, doc := range docs {
		names[index] = path.Base(doc.file.Name)
	}
	c.read(strings.Join(names, ", "), FormatHTTP, func() {
		set := &httpEnvironments{values: map[string]map[string]string{}, secrets: map[string]map[string]bool{}}
		for _, doc := range docs {
			c.collectEnvironments(set, doc)
		}
		for _, name := range set.order {
			draft := environmentDraft{name: name}
			for _, key := range sortedKeys(set.values[name]) {
				draft.variables = append(draft.variables, envVariable{name: key, value: set.values[name][key], enabled: true, secret: set.secrets[name][key]})
			}
			c.addDraftEnvironments([]environmentDraft{draft})
		}
	})
}

func (c *collector) collectEnvironments(set *httpEnvironments, doc document) {
	root := object(doc.data)
	if settings := object(root[restClientEnvironments]); settings != nil {
		root = settings
	}
	secret := isPrivateEnvironment(doc.file.Name)
	shared := c.plainValues(doc.file.Name, sharedEnvironment, object(root[sharedEnvironment]))
	for _, name := range sortedKeys(root) {
		if strings.HasPrefix(name, systemMark) {
			continue
		}
		values := c.plainValues(doc.file.Name, name, object(root[name]))
		set.add(name, c.withShared(shared, values, name), secret)
	}
}

func (c *collector) plainValues(file, environment string, entries map[string]any) map[string]string {
	values := map[string]string{}
	for _, key := range sortedKeys(entries) {
		if object(entries[key]) != nil || list(entries[key]) != nil {
			c.skip(locales.ImporterHttpEnvironmentValue, locales.Params{"file": file, "key": key, "environment": environment})
			continue
		}
		values[key] = text(entries[key])
	}
	return values
}

func (c *collector) withShared(shared, values map[string]string, label string) map[string]string {
	merged := mergedValues(shared, values)
	for key, value := range merged {
		merged[key] = c.httpPlaceholders(resolveShared(value, shared), label, nil)
	}
	return merged
}

func resolveShared(value string, shared map[string]string) string {
	return mapPlaceholders(value, func(inner string) string {
		fields := strings.Fields(inner)
		if len(fields) == 2 && fields[0] == sharedEnvironment {
			if resolved, found := shared[fields[1]]; found {
				return resolved
			}
		}
		return variableOpen + inner + variableClose
	})
}

func (s *httpEnvironments) add(name string, values map[string]string, secret bool) {
	if _, known := s.values[name]; !known {
		s.order = append(s.order, name)
		s.values[name], s.secrets[name] = map[string]string{}, map[string]bool{}
	}
	for key, value := range values {
		s.values[name][key] = value
		if secret {
			s.secrets[name][key] = true
		}
	}
}

func sortedKeys[V any](values map[string]V) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
