package mock

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	rootMarker      = "$"
	stepSeparator   = "."
	bracketOpen     = "["
	bracketClose    = "]"
	pathDelimiters  = stepSeparator + bracketOpen
	quoteCharacters = `'"`

	scopeParams = "params"
	scopeQuery  = "query"
	scopeHeader = "header"
	scopeMethod = "method"
	scopeBody   = "body"
	bodyJSON    = "json"
	bodyText    = "text"
)

type exchange struct {
	method   string
	parts    []string
	query    url.Values
	header   http.Header
	body     []byte
	params   map[string]string
	document any
	decoded  bool
	valid    bool
}

func newExchange(r *http.Request, body []byte) *exchange {
	return &exchange{
		method: r.Method,
		parts:  requestParts(r.URL),
		query:  r.URL.Query(),
		header: r.Header,
		body:   body,
	}
}

func (e *exchange) json() (any, bool) {
	if e.decoded {
		return e.document, e.valid
	}
	e.decoded = true
	decoder := json.NewDecoder(bytes.NewReader(e.body))
	decoder.UseNumber()
	e.valid = decoder.Decode(&e.document) == nil
	return e.document, e.valid
}

func (e *exchange) lookup(name string) string {
	scope, key, _ := strings.Cut(name, stepSeparator)
	switch scope {
	case scopeParams:
		return e.params[key]
	case scopeQuery:
		return e.query.Get(key)
	case scopeHeader:
		return e.header.Get(key)
	case scopeMethod:
		return e.method
	case scopeBody:
		return e.bodyValue(key)
	}
	return ""
}

func (e *exchange) bodyValue(key string) string {
	format, path, _ := strings.Cut(key, stepSeparator)
	if format == bodyText {
		return string(e.body)
	}
	if format != bodyJSON {
		return ""
	}
	value, ok := e.jsonValue(path)
	if !ok {
		return ""
	}
	return textOf(value)
}

func (e *exchange) jsonValue(path string) (any, bool) {
	document, ok := e.json()
	if !ok {
		return nil, false
	}
	return lookupPath(document, path)
}

func lookupPath(document any, path string) (any, bool) {
	current := document
	for _, step := range pathSteps(path) {
		next, ok := descend(current, step)
		if !ok {
			return nil, false
		}
		current = next
	}
	return current, true
}

func pathSteps(path string) []string {
	rest := strings.TrimPrefix(strings.TrimSpace(path), rootMarker)
	var steps []string
	for rest != "" {
		var step string
		step, rest = nextStep(rest)
		if step != "" {
			steps = append(steps, step)
		}
	}
	return steps
}

func nextStep(rest string) (string, string) {
	if strings.HasPrefix(rest, stepSeparator) {
		return "", rest[len(stepSeparator):]
	}
	if inner, ok := strings.CutPrefix(rest, bracketOpen); ok {
		token, after, _ := strings.Cut(inner, bracketClose)
		return strings.Trim(token, quoteCharacters), after
	}
	end := strings.IndexAny(rest, pathDelimiters)
	if end < 0 {
		return rest, ""
	}
	return rest[:end], rest[end:]
}

func descend(current any, step string) (any, bool) {
	switch node := current.(type) {
	case map[string]any:
		value, ok := node[step]
		return value, ok
	case []any:
		index, err := strconv.Atoi(step)
		if err != nil || index < 0 || index >= len(node) {
			return nil, false
		}
		return node[index], true
	}
	return nil, false
}

func textOf(value any) string {
	switch node := value.(type) {
	case nil:
		return ""
	case string:
		return node
	case json.Number:
		return node.String()
	case bool:
		return strconv.FormatBool(node)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(encoded)
}
