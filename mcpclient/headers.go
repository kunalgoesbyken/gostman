package mcpclient

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	headerMethod      = "Mcp-Method"
	headerName        = "Mcp-Name"
	headerParamPrefix = "Mcp-Param-"

	annotationKey  = "x-mcp-header"
	keyProperties  = "properties"
	keyType        = "type"
	arrayStep      = "[]"
	sentinelPrefix = "=?base64?"
	sentinelSuffix = "?="
	tokenSymbols   = "!#$%&'*+-.^_`|~"
	maxSafeInteger = 1<<53 - 1
)

var headerTypes = map[string]bool{kindString: true, kindInteger: true, kindBoolean: true}

type annotation struct {
	path   []string
	header string
	kind   string
	valid  bool
}

func (s *session) mirrorsHeaders() bool {
	_, overHTTP := s.link.(*httpLink)
	return s.modern && overHTTP
}

func isPlainHeaderValue(value string) bool {
	if value != strings.TrimSpace(value) {
		return false
	}
	if strings.HasPrefix(value, sentinelPrefix) && strings.HasSuffix(value, sentinelSuffix) {
		return false
	}
	for _, character := range value {
		if character != '\t' && (character < ' ' || character > '~') {
			return false
		}
	}
	return true
}

func headerValue(value string) string {
	if isPlainHeaderValue(value) {
		return value
	}
	return sentinelPrefix + base64.StdEncoding.EncodeToString([]byte(value)) + sentinelSuffix
}

func isToken(name string) bool {
	if name == "" {
		return false
	}
	for _, character := range name {
		isAlphanumeric := character < 128 && (character >= '0' && character <= '9' || character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z')
		if !isAlphanumeric && !strings.ContainsRune(tokenSymbols, character) {
			return false
		}
	}
	return true
}

func isPropertyChain(path []string) bool {
	if len(path) == 0 || len(path)%2 != 0 {
		return false
	}
	for index := 0; index < len(path); index += 2 {
		if path[index] != keyProperties {
			return false
		}
	}
	return true
}

func propertyNames(path []string) []string {
	names := make([]string, 0, len(path)/2)
	for index := 1; index < len(path); index += 2 {
		names = append(names, path[index])
	}
	return names
}

func collectAnnotations(node any, path []string, found *[]annotation) {
	switch value := node.(type) {
	case map[string]any:
		if raw, annotated := value[annotationKey]; annotated {
			header, isText := raw.(string)
			kind, _ := value[keyType].(string)
			*found = append(*found, annotation{path: path, header: header, kind: kind, valid: isText})
		}
		for key, child := range value {
			collectAnnotations(child, append(append([]string{}, path...), key), found)
		}
	case []any:
		for _, child := range value {
			collectAnnotations(child, append(append([]string{}, path...), arrayStep), found)
		}
	}
}

func annotationsOf(schema json.RawMessage) ([]annotation, string) {
	var root any
	if json.Unmarshal(schema, &root) != nil {
		return nil, ""
	}
	var found []annotation
	collectAnnotations(root, nil, &found)
	seen := map[string]bool{}
	for _, mark := range found {
		folded := strings.ToLower(mark.header)
		switch {
		case !mark.valid || !isToken(mark.header):
			return nil, fmt.Sprintf("%s value %q is not a valid header name", annotationKey, mark.header)
		case !isPropertyChain(mark.path):
			return nil, fmt.Sprintf("%s %q is not on a property reached only through properties", annotationKey, mark.header)
		case !headerTypes[mark.kind]:
			return nil, fmt.Sprintf("%s %q is on a parameter of type %q; only string, integer and boolean are allowed", annotationKey, mark.header, mark.kind)
		case seen[folded]:
			return nil, fmt.Sprintf("%s %q appears more than once", annotationKey, mark.header)
		}
		seen[folded] = true
	}
	return found, ""
}

func checkHeaderAnnotations(schema json.RawMessage) string {
	_, reason := annotationsOf(schema)
	return reason
}

func argumentAt(arguments json.RawMessage, names []string) (json.RawMessage, bool) {
	current := arguments
	for _, name := range names {
		var fields map[string]json.RawMessage
		if json.Unmarshal(current, &fields) != nil {
			return nil, false
		}
		next, present := fields[name]
		if !present {
			return nil, false
		}
		current = next
	}
	return current, !bytes.Equal(bytes.TrimSpace(current), nullExample)
}

func headerText(value json.RawMessage) (string, bool) {
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.UseNumber()
	var decoded any
	if decoder.Decode(&decoded) != nil {
		return "", false
	}
	switch typed := decoded.(type) {
	case string:
		return typed, true
	case bool:
		return strconv.FormatBool(typed), true
	case json.Number:
		integer, err := strconv.ParseInt(typed.String(), 10, 64)
		if err != nil || integer > maxSafeInteger || integer < -maxSafeInteger {
			return "", false
		}
		return strconv.FormatInt(integer, 10), true
	default:
		return "", false
	}
}

func mirroredHeaders(schema, arguments json.RawMessage) http.Header {
	found, reason := annotationsOf(schema)
	header := http.Header{}
	if reason != "" {
		return header
	}
	for _, mark := range found {
		value, present := argumentAt(arguments, propertyNames(mark.path))
		if !present {
			continue
		}
		if text, ok := headerText(value); ok {
			header.Set(headerParamPrefix+mark.header, headerValue(text))
		}
	}
	return header
}

func (s *session) toolHeaders(ctx context.Context, request rpc) (http.Header, bool, error) {
	params, isCall := request.params.(mcp.CallParams)
	if !isCall {
		return nil, false, nil
	}
	tools, _, err := listAll[listedTool](ctx, newLister(s), MethodListTools)
	if err != nil {
		return nil, false, err
	}
	for _, tool := range tools {
		if tool.Name == params.Name {
			return mirroredHeaders(tool.InputSchema, params.Arguments), true, nil
		}
	}
	return nil, false, nil
}
