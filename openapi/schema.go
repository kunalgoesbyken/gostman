package openapi

import (
	"fmt"
	"strings"
)

const (
	maxSchemaDepth = 10
	maxSchemaNodes = 1500
)

type SchemaNode struct {
	Name                 string        `json:"name,omitempty"`
	Ref                  string        `json:"ref,omitempty"`
	Type                 string        `json:"type,omitempty"`
	Format               string        `json:"format,omitempty"`
	Title                string        `json:"title,omitempty"`
	Description          string        `json:"description,omitempty"`
	Required             bool          `json:"required,omitempty"`
	Nullable             bool          `json:"nullable,omitempty"`
	ReadOnly             bool          `json:"readOnly,omitempty"`
	WriteOnly            bool          `json:"writeOnly,omitempty"`
	Deprecated           bool          `json:"deprecated,omitempty"`
	Enum                 []string      `json:"enum,omitempty"`
	Default              string        `json:"default,omitempty"`
	Example              string        `json:"example,omitempty"`
	Constraints          string        `json:"constraints,omitempty"`
	Properties           []*SchemaNode `json:"properties,omitempty"`
	Items                *SchemaNode   `json:"items,omitempty"`
	AdditionalProperties *SchemaNode   `json:"additionalProperties,omitempty"`
	Combine              string        `json:"combine,omitempty"`
	Options              []*SchemaNode `json:"options,omitempty"`
	Circular             bool          `json:"circular,omitempty"`
	Truncated            bool          `json:"truncated,omitempty"`
}

type schemaBuilder struct {
	l     *loader
	stack map[uintptr]bool
	nodes int
}

func (l *loader) schemaTree(n node) *SchemaNode {
	b := &schemaBuilder{l: l, stack: map[uintptr]bool{}}
	return b.build(n, 0)
}

func (b *schemaBuilder) build(n node, depth int) *SchemaNode {
	m, d, ref := b.l.resolved(n)
	if m == nil {
		return &SchemaNode{Ref: ref}
	}
	b.nodes++
	result := &SchemaNode{Ref: ref}
	id := identity(m)
	if b.stack[id] {
		result.Circular = true
		result.Type = typeLabel(m)
		return result
	}
	if depth > maxSchemaDepth || b.nodes > maxSchemaNodes {
		result.Truncated = true
		result.Type = typeLabel(m)
		return result
	}
	b.stack[id] = true
	defer delete(b.stack, id)

	result.Type = typeLabel(m)
	result.Format = asString(m["format"])
	result.Title = asString(m["title"])
	result.Description = strings.TrimSpace(asString(m["description"]))
	result.Nullable = asBool(m["nullable"]) || typeAllowsNull(m)
	result.ReadOnly, result.WriteOnly, result.Deprecated = asBool(m["readOnly"]), asBool(m["writeOnly"]), asBool(m["deprecated"])
	for _, item := range asList(m["enum"]) {
		result.Enum = append(result.Enum, scalarText(item))
	}
	if value, ok := m["default"]; ok {
		result.Default = scalarText(value)
	}
	if value, ok := m["example"]; ok {
		result.Example = scalarText(value)
	}
	result.Constraints = constraintsOf(m)

	here := func(v any) node { return node{v: v, d: d} }
	required := map[string]bool{}
	for _, name := range asList(m["required"]) {
		required[asString(name)] = true
	}
	b.addProperties(result, m, here, required, depth)
	for _, part := range asList(m["allOf"]) {
		sub := b.build(here(part), depth+1)
		if sub.Circular || sub.Truncated {
			result.Options = append(result.Options, sub)
			continue
		}
		result.Properties = append(result.Properties, sub.Properties...)
		if result.Type == "" {
			result.Type = sub.Type
		}
		if result.Items == nil {
			result.Items = sub.Items
		}
	}
	for _, key := range []string{"oneOf", "anyOf"} {
		parts := asList(m[key])
		if len(parts) == 0 {
			continue
		}
		result.Combine = key
		for _, part := range parts {
			result.Options = append(result.Options, b.build(here(part), depth+1))
		}
	}
	if items, ok := m["items"]; ok {
		result.Items = b.build(here(items), depth+1)
	}
	if extra := asMap(m["additionalProperties"]); extra != nil {
		result.AdditionalProperties = b.build(here(extra), depth+1)
	}
	return result
}

func (b *schemaBuilder) addProperties(result *SchemaNode, m map[string]any, here func(any) node, required map[string]bool, depth int) {
	properties := asMap(m["properties"])
	for _, name := range sortedKeys(properties) {
		child := b.build(here(properties[name]), depth+1)
		child.Name = name
		child.Required = required[name]
		result.Properties = append(result.Properties, child)
	}
}

func typeLabel(m map[string]any) string {
	if list, ok := m["type"].([]any); ok {
		var names []string
		for _, item := range list {
			if name := asString(item); name != "null" {
				names = append(names, name)
			}
		}
		return strings.Join(names, " | ")
	}
	return schemaType(m)
}

func typeAllowsNull(m map[string]any) bool {
	for _, item := range asList(m["type"]) {
		if asString(item) == "null" {
			return true
		}
	}
	return false
}

func constraintsOf(m map[string]any) string {
	var parts []string
	for _, key := range []string{"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems", "multipleOf"} {
		if value, ok := m[key]; ok {
			if _, isBool := value.(bool); !isBool {
				parts = append(parts, key+" "+scalarText(value))
			}
		}
	}
	if pattern := asString(m["pattern"]); pattern != "" {
		parts = append(parts, "pattern "+pattern)
	}
	if asBool(m["uniqueItems"]) {
		parts = append(parts, "unique items")
	}
	return strings.Join(parts, ", ")
}

func (d *Document) Schema(name string) (*SchemaNode, error) {
	root := d.l.main.root
	pool := asMap(root["definitions"])
	if components := asMap(root["components"]); components != nil {
		pool = asMap(components["schemas"])
	}
	raw, ok := pool[name]
	if !ok {
		return nil, fmt.Errorf("the spec has no schema named %q", name)
	}
	tree := d.l.schemaTree(d.l.root(raw))
	if tree.Ref == "" {
		tree.Ref = name
	}
	return tree, nil
}

type ParameterInfo struct {
	Name        string      `json:"name"`
	In          string      `json:"in"`
	Required    bool        `json:"required"`
	Description string      `json:"description"`
	Schema      *SchemaNode `json:"schema"`
	Example     string      `json:"example"`
}

type BodyInfo struct {
	ContentType string      `json:"contentType"`
	Schema      *SchemaNode `json:"schema"`
	Example     string      `json:"example"`
}

type ResponseInfo struct {
	Status      string     `json:"status"`
	Description string     `json:"description"`
	Bodies      []BodyInfo `json:"bodies"`
}

type Detail struct {
	Operation   Operation       `json:"operation"`
	Description string          `json:"description"`
	Parameters  []ParameterInfo `json:"parameters"`
	Required    bool            `json:"bodyRequired"`
	Bodies      []BodyInfo      `json:"bodies"`
	Responses   []ResponseInfo  `json:"responses"`
	Security    []string        `json:"security"`
	Request     *Request        `json:"request"`
}

func (d *Document) Detail(o *Operation) Detail {
	request := d.GenerateRequest(o)
	detail := Detail{
		Operation:   *o,
		Request:     request,
		Description: strings.TrimSpace(asString(asMap(o.op.v)["description"])),
		Parameters:  []ParameterInfo{},
	}
	for _, p := range d.params(o) {
		detail.Parameters = append(detail.Parameters, ParameterInfo{
			Name: p.name, In: p.in, Required: p.required, Description: strings.TrimSpace(p.description),
			Schema: d.l.schemaTree(p.schema), Example: d.paramValue(p),
		})
	}
	detail.Bodies, detail.Required = d.bodyInfos(o)
	detail.Responses = d.responseInfos(o)
	detail.Security = d.securityNames(o)
	return detail
}

func (d *Document) bodyInfos(o *Operation) ([]BodyInfo, bool) {
	if d.v2 {
		for _, p := range d.params(o) {
			if p.in == "body" {
				value, ok := d.l.exampleOf(p.schema, forRequest)
				info := BodyInfo{ContentType: pickAmong(stringList(d.l.child(o.op, "consumes").v), "application/json"), Schema: d.l.schemaTree(p.schema)}
				if ok {
					info.Example = prettyJSON(value)
				}
				return []BodyInfo{info}, p.required
			}
		}
		return []BodyInfo{}, false
	}
	body, doc, _ := d.l.resolved(d.l.child(o.op, "requestBody"))
	return d.mediaInfos(asMap(body["content"]), doc, forRequest), asBool(body["required"])
}

func (d *Document) mediaInfos(content map[string]any, doc *docCtx, mode exampleMode) []BodyInfo {
	infos := []BodyInfo{}
	for _, contentType := range sortedKeys(content) {
		media, mediaDoc, _ := d.l.resolved(node{v: content[contentType], d: doc})
		info := BodyInfo{ContentType: contentType}
		if schema, ok := media["schema"]; ok {
			info.Schema = d.l.schemaTree(node{v: schema, d: mediaDoc})
		}
		if value, ok := d.mediaExample(media, mediaDoc, mode); ok {
			info.Example = exampleText(contentType, value)
		}
		infos = append(infos, info)
	}
	return infos
}

func exampleText(contentType string, value any) string {
	switch bodyKind(contentType) {
	case bodyJSON:
		if text, ok := value.(string); ok && looksLikeJSON(text) {
			return text
		}
		return prettyJSON(value)
	case bodyXML:
		if text, ok := value.(string); ok {
			return text
		}
		return xmlDocument("root", value)
	}
	return scalarText(value)
}

func (d *Document) responseInfos(o *Operation) []ResponseInfo {
	responses := asMap(asMap(o.op.v)["responses"])
	infos := []ResponseInfo{}
	for _, code := range sortedKeys(responses) {
		response, doc, _ := d.l.resolved(node{v: responses[code], d: o.op.d})
		if response == nil {
			continue
		}
		info := ResponseInfo{Status: code, Description: strings.TrimSpace(asString(response["description"]))}
		if d.v2 {
			if schema, ok := response["schema"]; ok {
				body := BodyInfo{ContentType: pickAmong(stringList(d.l.main.root["produces"]), "application/json"), Schema: d.l.schemaTree(node{v: schema, d: doc})}
				if value, generated := d.l.exampleOf(node{v: schema, d: doc}, forResponse); generated {
					body.Example = prettyJSON(value)
				}
				info.Bodies = append(info.Bodies, body)
			}
		} else {
			info.Bodies = d.mediaInfos(asMap(response["content"]), doc, forResponse)
		}
		infos = append(infos, info)
	}
	return infos
}

func (d *Document) securityNames(o *Operation) []string {
	requirements := d.l.main.root["security"]
	if given, ok := asMap(o.op.v)["security"]; ok {
		requirements = given
	}
	names := []string{}
	for _, raw := range asList(requirements) {
		keys := sortedKeys(asMap(raw))
		if len(keys) == 0 {
			continue
		}
		var parts []string
		for _, key := range keys {
			parts = append(parts, key+" ("+d.schemeLabel(key)+")")
		}
		names = append(names, strings.Join(parts, " + "))
	}
	return names
}
