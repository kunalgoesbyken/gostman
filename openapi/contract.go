package openapi

import (
	"net/url"
	"strings"
)

const (
	maxContractDepth = 64
	maxContractNodes = 200000
	nullableKey      = "x-nullable"
	extensionMark    = "x-"
)

var (
	schemaMapKeywords   = map[string]bool{"properties": true, "patternProperties": true, "$defs": true, "definitions": true, "dependentSchemas": true}
	schemaListKeywords  = map[string]bool{"allOf": true, "anyOf": true, "oneOf": true, "prefixItems": true}
	schemaValueKeywords = map[string]bool{"additionalProperties": true, "additionalItems": true, "not": true, "if": true, "then": true, "else": true, "contains": true, "propertyNames": true}
	annotationKeywords  = map[string]bool{"description": true, "title": true, "example": true, "examples": true, "externalDocs": true, "xml": true, "discriminator": true, "$comment": true}
)

type Contract struct {
	BasePaths  []string            `json:"basePaths"`
	Operations []ContractOperation `json:"operations"`
	Root       map[string]any      `json:"root"`
}

type ContractOperation struct {
	Key       string                      `json:"key"`
	Method    string                      `json:"method"`
	Path      string                      `json:"path"`
	Responses map[string]ContractResponse `json:"responses,omitempty"`
}

type ContractResponse struct {
	Content map[string]any `json:"content"`
}

type bundler struct {
	l      *loader
	root   map[string]any
	kept   map[string]bool
	queue  []string
	budget int
}

func (d *Document) Contract() Contract {
	b := &bundler{l: d.l, root: map[string]any{}, kept: map[string]bool{}, budget: maxContractNodes}
	operations := make([]ContractOperation, 0, len(d.ops))
	for _, op := range d.ops {
		operations = append(operations, ContractOperation{Key: op.Key, Method: op.Method, Path: op.Path, Responses: d.contractResponses(op, b)})
	}
	b.finish()
	return Contract{BasePaths: d.basePaths(), Operations: operations, Root: b.root}
}

func (d *Document) basePaths() []string {
	var paths []string
	for _, server := range d.Servers {
		if parsed, err := url.Parse(server.URL); err == nil {
			paths = append(paths, strings.TrimRight(parsed.Path, "/"))
		}
	}
	if len(paths) == 0 {
		return []string{""}
	}
	return paths
}

func (d *Document) contractResponses(o *Operation, b *bundler) map[string]ContractResponse {
	responses := asMap(asMap(o.op.v)["responses"])
	out := make(map[string]ContractResponse, len(responses))
	for code, raw := range responses {
		if strings.HasPrefix(code, extensionMark) {
			continue
		}
		response, doc, _ := d.l.resolved(node{v: raw, d: o.op.d})
		if d.v2 {
			out[code] = ContractResponse{Content: d.contractContent2(o, response, doc, b)}
		} else {
			out[code] = ContractResponse{Content: d.contractContent(response, doc, b)}
		}
	}
	return out
}

func (d *Document) contractContent(response map[string]any, doc *docCtx, b *bundler) map[string]any {
	content := map[string]any{}
	for mediaType, raw := range asMap(response["content"]) {
		media, mediaDoc, _ := d.l.resolved(node{v: raw, d: doc})
		schema, ok := media["schema"]
		if !ok {
			content[mediaType] = nil
			continue
		}
		content[mediaType] = b.schema(node{v: schema, d: mediaDoc}, 0)
	}
	return content
}

func (d *Document) contractContent2(o *Operation, response map[string]any, doc *docCtx, b *bundler) map[string]any {
	content := map[string]any{}
	schema, ok := response["schema"]
	if !ok {
		return content
	}
	produces := stringList(d.l.child(o.op, "produces").v)
	if len(produces) == 0 {
		produces = stringList(d.l.main.root["produces"])
	}
	if len(produces) == 0 {
		produces = []string{"application/json"}
	}
	bundled := b.schema(node{v: schema, d: doc}, 0)
	for _, mediaType := range produces {
		content[mediaType] = bundled
	}
	return content
}

func (b *bundler) schema(n node, depth int) any {
	m, ok := n.v.(map[string]any)
	if !ok {
		return n.v
	}
	b.budget--
	if depth > maxContractDepth || b.budget < 0 {
		return map[string]any{}
	}
	if ref, isRef := refOf(m); isRef && (n.d != b.l.main || !strings.HasPrefix(ref, "#")) {
		target, _ := b.l.deref(n)
		return b.schema(target, depth+1)
	}
	out := make(map[string]any, len(m))
	for key, value := range m {
		child := node{v: value, d: n.d}
		switch {
		case key == "$ref":
			b.keep(asString(value))
			out[key] = value
		case schemaMapKeywords[key]:
			out[key] = b.schemaMap(child, depth)
		case schemaListKeywords[key], key == "items" && asList(value) != nil:
			out[key] = b.schemaList(child, depth)
		case schemaValueKeywords[key], key == "items":
			out[key] = b.schema(child, depth+1)
		case annotationKeywords[key], strings.HasPrefix(key, extensionMark) && key != nullableKey:
		default:
			out[key] = value
		}
	}
	return out
}

func (b *bundler) schemaMap(n node, depth int) map[string]any {
	source := asMap(n.v)
	out := make(map[string]any, len(source))
	for key, value := range source {
		out[key] = b.schema(node{v: value, d: n.d}, depth+1)
	}
	return out
}

func (b *bundler) schemaList(n node, depth int) []any {
	source := asList(n.v)
	out := make([]any, len(source))
	for index, value := range source {
		out[index] = b.schema(node{v: value, d: n.d}, depth+1)
	}
	return out
}

func (b *bundler) keep(ref string) {
	pointer := strings.TrimPrefix(ref, "#")
	if b.kept[pointer] {
		return
	}
	b.kept[pointer] = true
	b.queue = append(b.queue, pointer)
}

func (b *bundler) finish() {
	for len(b.queue) > 0 {
		pointer := b.queue[0]
		b.queue = b.queue[1:]
		target, err := walkPointer(b.l.main.root, pointer)
		if err != nil {
			b.l.warn("Could not resolve #" + pointer + ": " + err.Error())
			continue
		}
		place(b.root, pointer, b.schema(node{v: target, d: b.l.main}, 0))
	}
}

func place(root map[string]any, pointer string, value any) {
	tokens := strings.Split(strings.TrimPrefix(pointer, "/"), "/")
	current := root
	for _, raw := range tokens[:len(tokens)-1] {
		token := unescapeToken(raw)
		next, ok := current[token].(map[string]any)
		if !ok {
			next = map[string]any{}
			current[token] = next
		}
		current = next
	}
	current[unescapeToken(tokens[len(tokens)-1])] = value
}

func (c Contract) Index() Contract {
	operations := make([]ContractOperation, len(c.Operations))
	for index, op := range c.Operations {
		operations[index] = ContractOperation{Key: op.Key, Method: op.Method, Path: op.Path}
	}
	return Contract{BasePaths: c.BasePaths, Operations: operations}
}

type referenceCopier struct {
	source map[string]any
	root   map[string]any
	seen   map[string]bool
}

func (r *referenceCopier) follow(ref string) {
	if !strings.HasPrefix(ref, "#") || r.seen[ref] {
		return
	}
	r.seen[ref] = true
	pointer := strings.TrimPrefix(ref, "#")
	target, err := walkPointer(r.source, pointer)
	if err != nil {
		return
	}
	if _, missing := walkPointer(r.root, pointer); missing != nil {
		place(r.root, pointer, target)
	}
	r.visit(target)
}

func (r *referenceCopier) visit(value any) {
	switch typed := value.(type) {
	case map[string]any:
		if ref, ok := typed["$ref"].(string); ok {
			r.follow(ref)
		}
		for _, child := range typed {
			r.visit(child)
		}
	case []any:
		for _, child := range typed {
			r.visit(child)
		}
	}
}

func (c Contract) Operation(key string) (ContractOperation, map[string]any, bool) {
	for _, op := range c.Operations {
		if op.Key != key {
			continue
		}
		copier := &referenceCopier{source: c.Root, root: map[string]any{}, seen: map[string]bool{}}
		for _, response := range op.Responses {
			copier.visit(response.Content)
		}
		return op, copier.root, true
	}
	return ContractOperation{}, nil, false
}
