package openapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"sort"
	"strconv"
	"strings"
)

const (
	maxExampleDepth = 8
	maxExampleNodes = 2000
)

type ordered struct {
	keys []string
	vals map[string]any
}

func (o *ordered) set(key string, value any) {
	if _, exists := o.vals[key]; !exists {
		o.keys = append(o.keys, key)
	}
	o.vals[key] = value
}

func (o *ordered) MarshalJSON() ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteByte('{')
	for index, key := range o.keys {
		if index > 0 {
			buffer.WriteByte(',')
		}
		name, err := marshalPlain(key)
		if err != nil {
			return nil, err
		}
		value, err := marshalPlain(o.vals[key])
		if err != nil {
			return nil, err
		}
		buffer.Write(name)
		buffer.WriteByte(':')
		buffer.Write(value)
	}
	buffer.WriteByte('}')
	return buffer.Bytes(), nil
}

func marshalPlain(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buffer.Bytes(), "\n"), nil
}

func prettyJSON(value any) string {
	compact, err := marshalPlain(value)
	if err != nil {
		return ""
	}
	var indented bytes.Buffer
	if err := json.Indent(&indented, compact, "", "  "); err != nil {
		return string(compact)
	}
	return indented.String()
}

type exampleMode int

const (
	forRequest exampleMode = iota
	forResponse
)

type walker struct {
	l     *loader
	mode  exampleMode
	stack map[uintptr]bool
	nodes int
}

func (l *loader) exampleOf(schema node, mode exampleMode) (any, bool) {
	w := &walker{l: l, mode: mode, stack: map[uintptr]bool{}}
	return w.value(schema, 0)
}

func (w *walker) value(n node, depth int) (any, bool) {
	w.nodes++
	if depth > maxExampleDepth || w.nodes > maxExampleNodes {
		return nil, false
	}
	m, d, _ := w.l.resolved(n)
	if m == nil {
		return nil, false
	}
	id := identity(m)
	if w.stack[id] {
		return nil, false
	}
	w.stack[id] = true
	defer delete(w.stack, id)

	if value, ok := declared(m); ok {
		return value, true
	}
	here := func(v any) node { return node{v: v, d: d} }

	if parts := asList(m["allOf"]); len(parts) > 0 {
		return w.merged(m, parts, here, depth)
	}
	for _, key := range []string{"oneOf", "anyOf"} {
		if parts := asList(m[key]); len(parts) > 0 {
			return w.value(here(parts[0]), depth+1)
		}
	}
	switch schemaType(m) {
	case "object":
		return w.object(m, here, depth)
	case "array":
		return w.array(m, here, depth)
	case "string":
		return stringExample(m), true
	case "integer":
		return numberExample(m, true), true
	case "number":
		return numberExample(m, false), true
	case "boolean":
		return true, true
	case "null":
		return nil, true
	}
	return nil, false
}

func declared(m map[string]any) (any, bool) {
	if value, ok := m["example"]; ok && value != nil {
		return value, true
	}
	if list := asList(m["examples"]); len(list) > 0 {
		return list[0], true
	}
	if value, ok := m["x-example"]; ok && value != nil {
		return value, true
	}
	if value, ok := m["default"]; ok && value != nil {
		return value, true
	}
	if value, ok := m["const"]; ok {
		return value, true
	}
	if list := asList(m["enum"]); len(list) > 0 {
		return list[0], true
	}
	return nil, false
}

func schemaType(m map[string]any) string {
	switch typed := m["type"].(type) {
	case string:
		return typed
	case []any:
		for _, item := range typed {
			if name, ok := item.(string); ok && name != "null" {
				return name
			}
		}
		if len(typed) > 0 {
			return "null"
		}
	}
	switch {
	case m["properties"] != nil || m["additionalProperties"] != nil:
		return "object"
	case m["items"] != nil || m["prefixItems"] != nil:
		return "array"
	}
	return ""
}

func (w *walker) merged(m map[string]any, parts []any, here func(any) node, depth int) (any, bool) {
	combined := &ordered{vals: map[string]any{}}
	var scalar any
	hasScalar := false
	for _, part := range parts {
		value, ok := w.value(here(part), depth+1)
		if !ok {
			continue
		}
		if object, isObject := value.(*ordered); isObject {
			for _, key := range object.keys {
				combined.set(key, object.vals[key])
			}
		} else if !hasScalar {
			scalar, hasScalar = value, true
		}
	}
	if m["properties"] != nil {
		if own, ok := w.object(m, here, depth); ok {
			if object, isObject := own.(*ordered); isObject {
				for _, key := range object.keys {
					combined.set(key, object.vals[key])
				}
			}
		}
	}
	if len(combined.keys) == 0 && hasScalar {
		return scalar, true
	}
	return combined, len(combined.keys) > 0 || hasScalar
}

func (w *walker) skipped(property node) bool {
	m, _, _ := w.l.resolved(property)
	if w.mode == forRequest {
		return asBool(m["readOnly"])
	}
	return asBool(m["writeOnly"])
}

func (w *walker) object(m map[string]any, here func(any) node, depth int) (any, bool) {
	result := &ordered{vals: map[string]any{}}
	properties := asMap(m["properties"])
	required := map[string]bool{}
	for _, name := range asList(m["required"]) {
		required[asString(name)] = true
	}
	names := sortedKeys(properties)
	sort.SliceStable(names, func(i, j int) bool { return required[names[i]] && !required[names[j]] })
	for _, name := range names {
		property := here(properties[name])
		if w.skipped(property) {
			continue
		}
		if value, ok := w.value(property, depth+1); ok {
			result.set(name, value)
		}
	}
	if len(result.keys) == 0 {
		if extra := asMap(m["additionalProperties"]); extra != nil {
			if value, ok := w.value(here(extra), depth+1); ok {
				result.set("additionalProp1", value)
			}
		}
	}
	return result, true
}

func (w *walker) array(m map[string]any, here func(any) node, depth int) (any, bool) {
	if prefix := asList(m["prefixItems"]); len(prefix) > 0 {
		items := make([]any, 0, len(prefix))
		for _, item := range prefix {
			if value, ok := w.value(here(item), depth+1); ok {
				items = append(items, value)
			}
		}
		return items, true
	}
	if value, ok := w.value(here(m["items"]), depth+1); ok {
		return []any{value}, true
	}
	return []any{}, true
}

var stringFormats = map[string]string{
	"date":      "2024-01-01",
	"date-time": "2024-01-01T00:00:00Z",
	"time":      "12:00:00",
	"email":     "user@example.com",
	"uuid":      "3fa85f64-5717-4562-b3fc-2c963f66afa6",
	"uri":       "https://example.com",
	"url":       "https://example.com",
	"hostname":  "example.com",
	"ipv4":      "192.0.2.1",
	"ipv6":      "2001:db8::1",
	"password":  "password",
	"byte":      "c3RyaW5n",
	"binary":    "",
}

func stringExample(m map[string]any) string {
	if value, ok := stringFormats[asString(m["format"])]; ok {
		return value
	}
	return "string"
}

func numberExample(m map[string]any, integer bool) any {
	value, ok := m["minimum"].(float64)
	if !ok {
		value = 0
		if m["maximum"] != nil {
			if maximum, isNumber := m["maximum"].(float64); isNumber && maximum < 0 {
				value = maximum
			}
		}
	}
	if integer {
		return int64(value)
	}
	return value
}

func xmlText(name string, value any, indent int) string {
	pad := strings.Repeat("  ", indent)
	switch typed := value.(type) {
	case *ordered:
		var inner strings.Builder
		for _, key := range typed.keys {
			inner.WriteString(xmlText(key, typed.vals[key], indent+1))
		}
		return fmt.Sprintf("%s<%s>\n%s%s</%s>\n", pad, name, inner.String(), pad, name)
	case map[string]any:
		object := &ordered{vals: map[string]any{}}
		for _, key := range sortedKeys(typed) {
			object.set(key, typed[key])
		}
		return xmlText(name, object, indent)
	case []any:
		var inner strings.Builder
		for _, item := range typed {
			inner.WriteString(xmlText(name, item, indent))
		}
		return inner.String()
	case nil:
		return fmt.Sprintf("%s<%s/>\n", pad, name)
	}
	return fmt.Sprintf("%s<%s>%s</%s>\n", pad, name, html.EscapeString(fmt.Sprint(value)), name)
}

func xmlDocument(root string, value any) string {
	return strings.TrimRight(xmlText(root, value, 0), "\n")
}

func scalarText(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case *ordered, map[string]any, []any:
		compact, err := marshalPlain(typed)
		if err != nil {
			return ""
		}
		return string(compact)
	}
	return fmt.Sprint(value)
}
