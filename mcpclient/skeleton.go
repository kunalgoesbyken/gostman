package mcpclient

import (
	"bytes"
	"encoding/json"
	"strings"
)

const (
	noArguments      = "{}"
	placeholderOpen  = "{{"
	maxSkeletonDepth = 6

	kindObject  = "object"
	kindArray   = "array"
	kindString  = "string"
	kindNumber  = "number"
	kindInteger = "integer"
	kindBoolean = "boolean"
	kindNull    = "null"
)

var (
	nullExample = []byte("null")
	examples    = map[string][]byte{
		kindString:  []byte(`""`),
		kindNumber:  []byte("0"),
		kindInteger: []byte("0"),
		kindBoolean: []byte("false"),
	}
)

type schemaNode struct {
	Type       json.RawMessage   `json:"type"`
	Properties json.RawMessage   `json:"properties"`
	Items      json.RawMessage   `json:"items"`
	Default    json.RawMessage   `json:"default"`
	Const      json.RawMessage   `json:"const"`
	Enum       []json.RawMessage `json:"enum"`
	Minimum    json.RawMessage   `json:"minimum"`
}

type member struct {
	name  string
	value json.RawMessage
}

func indented(document []byte) string {
	var shown bytes.Buffer
	if json.Indent(&shown, document, "", "  ") != nil {
		return noArguments
	}
	return shown.String()
}

func skeleton(inputSchema json.RawMessage) string {
	var root schemaNode
	if json.Unmarshal(inputSchema, &root) != nil {
		return noArguments
	}
	return indented(exampleObject(root.Properties, 0))
}

func (n schemaNode) kind() string {
	var single string
	if json.Unmarshal(n.Type, &single) == nil {
		return single
	}
	var several []string
	json.Unmarshal(n.Type, &several)
	for _, candidate := range several {
		if candidate != kindNull {
			return candidate
		}
	}
	if len(n.Properties) > 0 {
		return kindObject
	}
	return kindNull
}

func (n schemaNode) suggestion() json.RawMessage {
	switch {
	case len(n.Default) > 0:
		return n.Default
	case len(n.Const) > 0:
		return n.Const
	case len(n.Enum) > 0:
		return n.Enum[0]
	default:
		return nil
	}
}

func (n schemaNode) preset() json.RawMessage {
	suggested := n.suggestion()
	if bytes.Contains(suggested, []byte(placeholderOpen)) {
		return nil
	}
	return suggested
}

func example(schema json.RawMessage, depth int) []byte {
	var node schemaNode
	if json.Unmarshal(schema, &node) != nil {
		return nullExample
	}
	if preset := node.preset(); preset != nil {
		return preset
	}
	switch kind := node.kind(); kind {
	case kindObject:
		return exampleObject(node.Properties, depth)
	case kindArray:
		return exampleArray(node.Items, depth)
	case kindNumber, kindInteger:
		if len(node.Minimum) > 0 {
			return node.Minimum
		}
		return examples[kind]
	default:
		if scalar, known := examples[kind]; known {
			return scalar
		}
		return nullExample
	}
}

func exampleObject(properties json.RawMessage, depth int) []byte {
	var fields [][]byte
	if depth < maxSkeletonDepth {
		for _, property := range members(properties) {
			name, _ := json.Marshal(property.name)
			fields = append(fields, append(append(name, ':'), example(property.value, depth+1)...))
		}
	}
	return enclose('{', fields, '}')
}

func exampleArray(items json.RawMessage, depth int) []byte {
	if len(items) == 0 || depth >= maxSkeletonDepth {
		return enclose('[', nil, ']')
	}
	return enclose('[', [][]byte{example(items, depth+1)}, ']')
}

func enclose(opening byte, parts [][]byte, closing byte) []byte {
	return append(append([]byte{opening}, bytes.Join(parts, []byte(","))...), closing)
}

func members(object json.RawMessage) []member {
	decoder := json.NewDecoder(bytes.NewReader(object))
	if opening, err := decoder.Token(); err != nil || opening != json.Delim('{') {
		return nil
	}
	var listed []member
	for decoder.More() {
		key, err := decoder.Token()
		name, isName := key.(string)
		var value json.RawMessage
		if err != nil || !isName || decoder.Decode(&value) != nil {
			return listed
		}
		if strings.Contains(name, placeholderOpen) {
			continue
		}
		listed = append(listed, member{name, value})
	}
	return listed
}

func promptSkeleton(arguments []PromptArgument) string {
	fields := make([][]byte, 0, len(arguments))
	for _, argument := range arguments {
		name, _ := json.Marshal(argument.Name)
		fields = append(fields, append(name, []byte(`:""`)...))
	}
	return indented(enclose('{', fields, '}'))
}
