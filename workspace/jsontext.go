package workspace

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	rowEnabledKey = "enabled"
	rowValueKey   = "value"
	jsonIndent    = "  "
)

var errDuplicateKey = errors.New("duplicate key")

func numberNode(number json.Number) *yaml.Node {
	tag := tagInteger
	if strings.ContainsAny(number.String(), ".eE") {
		tag = tagDecimal
	}
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: tag, Value: number.String()}
}

func (b nodeBuilder) jsonValue(decoder *json.Decoder) (*yaml.Node, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	switch typed := token.(type) {
	case json.Delim:
		if typed == '{' {
			return b.jsonObject(decoder)
		}
		return b.jsonArray(decoder)
	case string:
		return b.explicitText(typed), nil
	case json.Number:
		return numberNode(typed), nil
	case bool:
		return flagNode(typed), nil
	}
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: tagNull, Value: "null"}, nil
}

func (b nodeBuilder) jsonObject(decoder *json.Decoder) (*yaml.Node, error) {
	object := mappingNode()
	seen := map[string]bool{}
	for decoder.More() {
		token, err := decoder.Token()
		if err != nil {
			return nil, err
		}
		key := token.(string)
		if seen[key] {
			return nil, errDuplicateKey
		}
		seen[key] = true
		value, err := b.jsonValue(decoder)
		if err != nil {
			return nil, err
		}
		object.Content = append(object.Content, keyNode(key), value)
	}
	_, err := decoder.Token()
	return object, err
}

func (b nodeBuilder) jsonArray(decoder *json.Decoder) (*yaml.Node, error) {
	array := listNode()
	for decoder.More() {
		item, err := b.jsonValue(decoder)
		if err != nil {
			return nil, err
		}
		array.Content = append(array.Content, item)
	}
	_, err := decoder.Token()
	return array, err
}

func isContainer(node *yaml.Node) bool {
	return node.Kind == yaml.MappingNode || node.Kind == yaml.SequenceNode
}

func (b nodeBuilder) container(text string) *yaml.Node {
	decoder := json.NewDecoder(strings.NewReader(text))
	decoder.UseNumber()
	node, err := b.jsonValue(decoder)
	if err != nil || !isContainer(node) {
		return nil
	}
	if _, err := decoder.Token(); err != io.EOF {
		return nil
	}
	return node
}

func (b nodeBuilder) jsonText(text string) *yaml.Node {
	if text == "" {
		return nil
	}
	if node := b.container(text); node != nil {
		return node
	}
	return b.explicitText(text)
}

func isEnabledByDefault(key, value *yaml.Node) bool {
	return key.Value == rowEnabledKey && value.Kind == yaml.ScalarNode && value.Tag == tagFlag && value.Value == "true"
}

func withoutEnabledDefault(row *yaml.Node) {
	kept := row.Content[:0]
	for i := 0; i+1 < len(row.Content); i += 2 {
		if !isEnabledByDefault(row.Content[i], row.Content[i+1]) {
			kept = append(kept, row.Content[i], row.Content[i+1])
		}
	}
	row.Content = kept
}

func (b nodeBuilder) rows(text string) *yaml.Node {
	node := b.jsonText(text)
	if node == nil || node.Kind != yaml.SequenceNode {
		return node
	}
	for _, row := range node.Content {
		if row.Kind == yaml.MappingNode {
			withoutEnabledDefault(row)
		}
	}
	return node
}

func endOfField(mapping *yaml.Node, key string) int {
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value == key {
			return i + 2
		}
	}
	return 0
}

func enabledPosition(row *yaml.Node) int {
	if afterValue := endOfField(row, rowValueKey); afterValue > 0 {
		return afterValue
	}
	return len(row.Content)
}

func withEnabledDefault(row *yaml.Node) *yaml.Node {
	if row.Kind != yaml.MappingNode || endOfField(row, rowEnabledKey) > 0 {
		return row
	}
	position := enabledPosition(row)
	completed := *row
	completed.Content = append([]*yaml.Node{}, row.Content[:position]...)
	completed.Content = append(completed.Content, keyNode(rowEnabledKey), flagNode(true))
	completed.Content = append(completed.Content, row.Content[position:]...)
	return &completed
}

func withEnabledDefaults(node *yaml.Node) *yaml.Node {
	if node.Kind != yaml.SequenceNode {
		return node
	}
	completed := *node
	completed.Content = make([]*yaml.Node, len(node.Content))
	for i, row := range node.Content {
		completed.Content[i] = withEnabledDefault(row)
	}
	return &completed
}

type jsonWriter struct {
	out      strings.Builder
	indented bool
}

func quoteJSON(text string) string {
	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(text); err != nil {
		return `""`
	}
	return strings.TrimSuffix(out.String(), "\n")
}

func (w *jsonWriter) lineBreak(depth int) {
	if !w.indented {
		return
	}
	w.out.WriteByte('\n')
	w.out.WriteString(strings.Repeat(jsonIndent, depth))
}

func (w *jsonWriter) keySeparator() string {
	if w.indented {
		return ": "
	}
	return ":"
}

func (w *jsonWriter) object(node *yaml.Node, depth int) error {
	if len(node.Content) == 0 {
		w.out.WriteString("{}")
		return nil
	}
	w.out.WriteByte('{')
	for i := 0; i+1 < len(node.Content); i += 2 {
		key, value := node.Content[i], node.Content[i+1]
		if key.Kind != yaml.ScalarNode {
			return failAt(key, "field names must be plain text")
		}
		if i > 0 {
			w.out.WriteByte(',')
		}
		w.lineBreak(depth + 1)
		w.out.WriteString(quoteJSON(key.Value))
		w.out.WriteString(w.keySeparator())
		if err := w.value(value, depth+1); err != nil {
			return err
		}
	}
	w.lineBreak(depth)
	w.out.WriteByte('}')
	return nil
}

func (w *jsonWriter) array(node *yaml.Node, depth int) error {
	if len(node.Content) == 0 {
		w.out.WriteString("[]")
		return nil
	}
	w.out.WriteByte('[')
	for i, item := range node.Content {
		if i > 0 {
			w.out.WriteByte(',')
		}
		w.lineBreak(depth + 1)
		if err := w.value(item, depth+1); err != nil {
			return err
		}
	}
	w.lineBreak(depth)
	w.out.WriteByte(']')
	return nil
}

func numberLiteral(node *yaml.Node) string {
	if json.Valid([]byte(node.Value)) {
		return node.Value
	}
	var value any
	if err := node.Decode(&value); err != nil {
		return quoteJSON(node.Value)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return quoteJSON(node.Value)
	}
	return string(encoded)
}

func flagLiteral(node *yaml.Node) string {
	var value bool
	if err := node.Decode(&value); err != nil {
		return quoteJSON(node.Value)
	}
	if value {
		return "true"
	}
	return "false"
}

func scalarLiteral(node *yaml.Node) string {
	switch node.ShortTag() {
	case tagNull:
		return "null"
	case tagFlag:
		return flagLiteral(node)
	case tagInteger, tagDecimal:
		return numberLiteral(node)
	}
	return quoteJSON(node.Value)
}

func (w *jsonWriter) value(node *yaml.Node, depth int) error {
	switch node.Kind {
	case yaml.MappingNode:
		return w.object(node, depth)
	case yaml.SequenceNode:
		return w.array(node, depth)
	case yaml.ScalarNode:
		w.out.WriteString(scalarLiteral(node))
		return nil
	}
	return failAt(node, "anchors and aliases are not supported")
}

func toJSON(node *yaml.Node, indented bool) (string, error) {
	writer := jsonWriter{indented: indented}
	if err := writer.value(node, 0); err != nil {
		return "", err
	}
	return writer.out.String(), nil
}

func (r *fieldReader) jsonText(key string, indented bool, complete func(*yaml.Node) *yaml.Node) string {
	node := r.fields[key]
	if node == nil {
		return ""
	}
	if !isContainer(node) {
		return r.text(key)
	}
	text, err := toJSON(complete(node), indented)
	if err != nil {
		r.fail(err)
	}
	return text
}

func unchanged(node *yaml.Node) *yaml.Node {
	return node
}
