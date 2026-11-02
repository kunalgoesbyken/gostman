package openapi

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

type Input struct {
	Name     string         `json:"name"`
	In       string         `json:"in"`
	Required bool           `json:"required"`
	Schema   map[string]any `json:"schema"`
}

type Target struct {
	Key         string      `json:"key"`
	Method      string      `json:"method"`
	Path        string      `json:"path"`
	Params      []Input     `json:"params"`
	Body        *Input      `json:"body,omitempty"`
	ContentType string      `json:"contentType,omitempty"`
	Auth        engine.Auth `json:"auth"`
}

type Targets struct {
	Operations []Target       `json:"operations"`
	Root       map[string]any `json:"root"`
}

var fuzzedLocations = map[string]bool{"path": true, "query": true, "header": true}

func (d *Document) Targets() Targets {
	b := &bundler{l: d.l, root: map[string]any{}, kept: map[string]bool{}, budget: maxContractNodes}
	targets := make([]Target, 0, len(d.ops))
	for _, op := range d.ops {
		targets = append(targets, d.targetOf(op, b))
	}
	b.finish()
	return Targets{Operations: targets, Root: b.root}
}

func (d *Document) targetOf(o *Operation, b *bundler) Target {
	target := Target{Key: o.Key, Method: o.Method, Path: o.Path}
	for _, p := range d.params(o) {
		schema, _ := b.schema(p.schema, 0).(map[string]any)
		switch {
		case schema == nil:
		case fuzzedLocations[p.in] && !reservedHeaders[strings.ToLower(p.name)]:
			target.Params = append(target.Params, Input{Name: p.name, In: p.in, Required: p.required, Schema: schema})
		case p.in == "body":
			target.Body = &Input{Name: "body", In: "body", Required: p.required, Schema: schema}
			target.ContentType = pickAmong(d.consumes(o), "application/json")
		}
	}
	if target.Body == nil {
		d.bodyTarget(o, b, &target)
	}
	target.Auth, _ = d.authFor(o)
	return target
}

func (d *Document) consumes(o *Operation) []string {
	if list := stringList(d.l.child(o.op, "consumes").v); len(list) > 0 {
		return list
	}
	return stringList(d.l.main.root["consumes"])
}

func (d *Document) bodyTarget(o *Operation, b *bundler, target *Target) {
	if d.v2 {
		return
	}
	body, doc, _ := d.l.resolved(d.l.child(o.op, "requestBody"))
	content := asMap(body["content"])
	contentType := pickContentType(content)
	if bodyKind(contentType) != bodyJSON {
		return
	}
	media, mediaDoc, _ := d.l.resolved(node{v: content[contentType], d: doc})
	schema, _ := b.schema(node{v: media["schema"], d: mediaDoc}, 0).(map[string]any)
	if schema == nil {
		return
	}
	target.Body = &Input{Name: "body", In: "body", Required: asBool(body["required"]), Schema: schema}
	target.ContentType = contentType
}

func (t Targets) Resolve(ref string) (map[string]any, bool) {
	if !strings.HasPrefix(ref, "#") {
		return nil, false
	}
	found, err := walkPointer(t.Root, strings.TrimPrefix(ref, "#"))
	if err != nil {
		return nil, false
	}
	schema := asMap(found)
	return schema, schema != nil
}
