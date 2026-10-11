package workspace

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	tagText    = "!!str"
	tagFlag    = "!!bool"
	tagInteger = "!!int"
	tagDecimal = "!!float"
	tagNull    = "!!null"
	tagMapping = "!!map"
	tagList    = "!!seq"

	indentSpaces = 2
)

type fileError struct {
	line    int
	message string
}

func (e *fileError) Error() string {
	if e.line == 0 {
		return e.message
	}
	return fmt.Sprintf("line %d: %s", e.line, e.message)
}

func failAt(node *yaml.Node, message string) error {
	return &fileError{line: node.Line, message: message}
}

func syntaxError(err error) error {
	text := strings.TrimPrefix(err.Error(), "yaml: ")
	var line int
	if _, scanErr := fmt.Sscanf(text, "line %d:", &line); scanErr != nil {
		return &fileError{message: text}
	}
	return &fileError{line: line, message: strings.TrimPrefix(text, fmt.Sprintf("line %d: ", line))}
}

type nodeBuilder struct {
	quoteEverything bool
}

func mappingNode() *yaml.Node {
	return &yaml.Node{Kind: yaml.MappingNode, Tag: tagMapping}
}

func listNode() *yaml.Node {
	return &yaml.Node{Kind: yaml.SequenceNode, Tag: tagList}
}

func keyNode(key string) *yaml.Node {
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: tagText, Value: key}
}

func flagNode(value bool) *yaml.Node {
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: tagFlag, Value: strconv.FormatBool(value)}
}

func integerNode(value int64) *yaml.Node {
	if value == 0 {
		return nil
	}
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: tagInteger, Value: strconv.FormatInt(value, 10)}
}

func setFlagNode(value bool) *yaml.Node {
	if !value {
		return nil
	}
	return flagNode(true)
}

func breaksBlockScalar(value string) bool {
	return strings.HasPrefix(value, "\n") || strings.HasPrefix(value, "\t")
}

func (b nodeBuilder) styleOf(value string) yaml.Style {
	if b.quoteEverything {
		return yaml.DoubleQuotedStyle
	}
	if !strings.Contains(value, "\n") {
		return 0
	}
	if breaksBlockScalar(value) {
		return yaml.DoubleQuotedStyle
	}
	return yaml.LiteralStyle
}

func (b nodeBuilder) explicitText(value string) *yaml.Node {
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: tagText, Value: value, Style: b.styleOf(value)}
}

func (b nodeBuilder) text(value string) *yaml.Node {
	if value == "" {
		return nil
	}
	return b.explicitText(value)
}

func setField(mapping *yaml.Node, key string, value *yaml.Node) {
	if value == nil {
		return
	}
	mapping.Content = append(mapping.Content, keyNode(key), value)
}

func filledMapping(mapping *yaml.Node) *yaml.Node {
	if len(mapping.Content) == 0 {
		return nil
	}
	return mapping
}

func encodeDocument(root *yaml.Node) ([]byte, error) {
	var out bytes.Buffer
	encoder := yaml.NewEncoder(&out)
	encoder.SetIndent(indentSpaces)
	if err := encoder.Encode(root); err != nil {
		return nil, err
	}
	if err := encoder.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

func parseDocument(content []byte) (*yaml.Node, error) {
	var document yaml.Node
	if err := yaml.Unmarshal(content, &document); err != nil {
		return nil, syntaxError(err)
	}
	if len(document.Content) == 0 {
		return nil, &fileError{message: "the file is empty"}
	}
	root := document.Content[0]
	if root.Kind != yaml.MappingNode {
		return nil, failAt(root, "expected a list of fields")
	}
	return root, nil
}

func decodeFile[T any](content []byte, readErr error, read func(*yaml.Node) (T, error)) (T, error) {
	var empty T
	if readErr != nil {
		return empty, readErr
	}
	root, err := parseDocument(content)
	if err != nil {
		return empty, err
	}
	return read(root)
}

var errUnstable = errors.New("the content cannot be written as YAML without changing it")

func encodeVerified[T comparable](build func(nodeBuilder) *yaml.Node, read func(*yaml.Node) (T, error)) ([]byte, error) {
	for _, builder := range []nodeBuilder{{}, {quoteEverything: true}} {
		root := build(builder)
		content, err := encodeDocument(root)
		if err != nil {
			return nil, err
		}
		if survivesParsing(content, root, read) {
			return content, nil
		}
	}
	return nil, errUnstable
}

func survivesParsing[T comparable](content []byte, root *yaml.Node, read func(*yaml.Node) (T, error)) bool {
	parsed, err := parseDocument(content)
	if err != nil {
		return false
	}
	written, err := read(root)
	if err != nil {
		return false
	}
	reread, err := read(parsed)
	return err == nil && written == reread
}

type fieldReader struct {
	fields  map[string]*yaml.Node
	extras  []*yaml.Node
	failure *error
}

func (r *fieldReader) fail(err error) {
	if *r.failure == nil {
		*r.failure = err
	}
}

func isKnownKey(known []string, key string) bool {
	for _, candidate := range known {
		if candidate == key {
			return true
		}
	}
	return false
}

func readFields(mapping *yaml.Node, known []string, failure *error) *fieldReader {
	reader := &fieldReader{fields: map[string]*yaml.Node{}, failure: failure}
	if mapping == nil {
		return reader
	}
	if mapping.Kind != yaml.MappingNode {
		reader.fail(failAt(mapping, "expected a list of fields"))
		return reader
	}
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		key, value := mapping.Content[i], mapping.Content[i+1]
		if key.Kind != yaml.ScalarNode {
			reader.fail(failAt(key, "field names must be plain text"))
			continue
		}
		if isKnownKey(known, key.Value) {
			reader.fields[key.Value] = value
			continue
		}
		reader.extras = append(reader.extras, key, value)
	}
	return reader
}

func (r *fieldReader) has(key string) bool {
	return r.fields[key] != nil
}

func (r *fieldReader) scalar(key string) *yaml.Node {
	node := r.fields[key]
	if node == nil {
		return nil
	}
	if node.Kind != yaml.ScalarNode {
		r.fail(failAt(node, key+" must be a single value"))
		return nil
	}
	return node
}

func (r *fieldReader) text(key string) string {
	node := r.scalar(key)
	if node == nil || node.ShortTag() == tagNull {
		return ""
	}
	return node.Value
}

func (r *fieldReader) flag(key string, fallback bool) bool {
	node := r.scalar(key)
	if node == nil {
		return fallback
	}
	var value bool
	if err := node.Decode(&value); err != nil {
		r.fail(failAt(node, key+" must be true or false"))
	}
	return value
}

func (r *fieldReader) integer(key string) int64 {
	node := r.scalar(key)
	if node == nil {
		return 0
	}
	var value int64
	if err := node.Decode(&value); err != nil {
		r.fail(failAt(node, key+" must be a whole number"))
	}
	return value
}
