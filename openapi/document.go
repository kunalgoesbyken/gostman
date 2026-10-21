package openapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
)

var methodOrder = []string{"get", "put", "post", "delete", "options", "head", "patch", "trace"}

type Info struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
}

type Tag struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type Server struct {
	URL         string `json:"url"`
	Description string `json:"description"`
}

type Operation struct {
	Key         string   `json:"key"`
	OperationID string   `json:"operationId"`
	Method      string   `json:"method"`
	Path        string   `json:"path"`
	Summary     string   `json:"summary"`
	Tags        []string `json:"tags"`
	Deprecated  bool     `json:"deprecated"`
	Hash        string   `json:"hash"`

	op      node
	item    node
	request *Request
}

type Document struct {
	Version string
	Info    Info
	Servers []Server
	Tags    []Tag
	Hash    string

	l        *loader
	v2       bool
	source   string
	ops      []*Operation
	byKey    map[string]*Operation
	schemas  []string
	security map[string]map[string]any
	baseURL  string
}

func Load(ctx context.Context, source Source, opt Options) (*Document, error) {
	opt = opt.withAllowance()
	data, base, err := opt.read(ctx, source)
	if err != nil {
		return nil, err
	}
	root, err := decode(data)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	return build(ctx, opt, root, base, hex.EncodeToString(digest[:]))
}

func build(ctx context.Context, opt Options, root map[string]any, base, hash string) (*Document, error) {
	doc := &Document{Hash: hash, Servers: []Server{}, Tags: []Tag{}, schemas: []string{}, source: base, byKey: map[string]*Operation{}, l: newLoader(ctx, opt, root, base)}
	switch {
	case asString(root["swagger"]) != "":
		if !strings.HasPrefix(asString(root["swagger"]), "2") {
			return nil, fmt.Errorf("Swagger %s is not supported", asString(root["swagger"]))
		}
		doc.Version, doc.v2 = asString(root["swagger"]), true
	case asString(root["openapi"]) != "":
		if !strings.HasPrefix(asString(root["openapi"]), "3.") {
			return nil, fmt.Errorf("OpenAPI %s is not supported", asString(root["openapi"]))
		}
		doc.Version = asString(root["openapi"])
	default:
		return nil, errors.New("this is not an OpenAPI document: it has no \"openapi\" or \"swagger\" field")
	}
	info := asMap(root["info"])
	doc.Info = Info{Title: asString(info["title"]), Description: asString(info["description"]), Version: asString(info["version"])}
	doc.readTags(root)
	doc.readSecurity(root)
	doc.readSchemas(root)
	doc.readServers(root)
	if err := doc.readOperations(root); err != nil {
		return nil, err
	}
	return doc, nil
}

func (d *Document) readTags(root map[string]any) {
	for _, item := range asList(root["tags"]) {
		tag := asMap(item)
		if name := asString(tag["name"]); name != "" {
			d.Tags = append(d.Tags, Tag{Name: name, Description: asString(tag["description"])})
		}
	}
}

func (d *Document) readSecurity(root map[string]any) {
	d.security = map[string]map[string]any{}
	definitions := asMap(root["securityDefinitions"])
	if components := asMap(root["components"]); components != nil {
		definitions = asMap(components["securitySchemes"])
	}
	for name, raw := range definitions {
		scheme, _, _ := d.l.resolved(d.l.root(raw))
		if scheme != nil {
			d.security[name] = scheme
		}
	}
}

func (d *Document) readSchemas(root map[string]any) {
	pool := asMap(root["definitions"])
	if components := asMap(root["components"]); components != nil {
		pool = asMap(components["schemas"])
	}
	d.schemas = sortedKeys(pool)
}

func (d *Document) readServers(root map[string]any) {
	if d.v2 {
		d.readServers2(root)
		return
	}
	for _, raw := range asList(root["servers"]) {
		server := asMap(raw)
		address := asString(server["url"])
		if address == "" {
			continue
		}
		for name, variable := range asMap(server["variables"]) {
			address = strings.ReplaceAll(address, "{"+name+"}", asString(asMap(variable)["default"]))
		}
		d.Servers = append(d.Servers, Server{URL: d.absolute(address), Description: asString(server["description"])})
	}
}

func (d *Document) readServers2(root map[string]any) {
	host := asString(root["host"])
	basePath := strings.TrimRight(asString(root["basePath"]), "/")
	schemes := asList(root["schemes"])
	scheme := "https"
	if len(schemes) > 0 {
		scheme = asString(schemes[0])
		for _, candidate := range schemes {
			if asString(candidate) == "https" {
				scheme = "https"
			}
		}
	}
	switch {
	case host != "":
		d.Servers = append(d.Servers, Server{URL: scheme + "://" + host + basePath})
	case basePath != "":
		d.Servers = append(d.Servers, Server{URL: d.absolute(basePath)})
	}
}

func (d *Document) absolute(address string) string {
	if parsed, err := url.Parse(address); err == nil && parsed.Scheme != "" {
		return strings.TrimRight(address, "/")
	}
	if base, err := url.Parse(d.source); err == nil && (base.Scheme == "http" || base.Scheme == "https") {
		if resolved, err := base.Parse(address); err == nil {
			return strings.TrimRight(resolved.String(), "/")
		}
	}
	return strings.TrimRight(address, "/")
}

func (d *Document) BaseURL() string {
	if len(d.Servers) > 0 {
		return d.Servers[0].URL
	}
	if base, err := url.Parse(d.source); err == nil && (base.Scheme == "http" || base.Scheme == "https") {
		return base.Scheme + "://" + base.Host
	}
	return ""
}

func (d *Document) readOperations(root map[string]any) error {
	paths := asMap(root["paths"])
	if len(paths) == 0 {
		return errors.New("this spec defines no paths, so there is nothing to import")
	}
	seenTags := map[string]bool{}
	for _, tag := range d.Tags {
		seenTags[tag.Name] = true
	}
	for _, path := range sortedKeys(paths) {
		if strings.HasPrefix(path, "x-") {
			continue
		}
		item, itemDoc, _ := d.l.resolved(d.l.root(paths[path]))
		if item == nil {
			continue
		}
		for _, method := range methodOrder {
			raw, ok := item[method]
			if !ok {
				continue
			}
			op, opDoc, _ := d.l.resolved(node{v: raw, d: itemDoc})
			if op == nil {
				continue
			}
			operation := d.operationFrom(path, method, op, node{v: item, d: itemDoc}, opDoc)
			d.ops = append(d.ops, operation)
			d.byKey[operation.Key] = operation
			for _, tag := range operation.Tags {
				if !seenTags[tag] {
					seenTags[tag] = true
					d.Tags = append(d.Tags, Tag{Name: tag})
				}
			}
		}
	}
	if len(d.ops) == 0 {
		return errors.New("this spec has paths but no operations")
	}
	return nil
}

func (d *Document) operationFrom(path, method string, op map[string]any, item node, opDoc *docCtx) *Operation {
	var tags []string
	for _, tag := range asList(op["tags"]) {
		if name := asString(tag); name != "" {
			tags = append(tags, name)
		}
	}
	upper := strings.ToUpper(method)
	return &Operation{
		Key:         upper + " " + path,
		OperationID: asString(op["operationId"]),
		Method:      upper,
		Path:        path,
		Summary:     asString(op["summary"]),
		Tags:        tags,
		Deprecated:  asBool(op["deprecated"]),
		op:          node{v: op, d: opDoc},
		item:        item,
	}
}

func (o *Operation) Tag() string {
	if len(o.Tags) > 0 {
		return o.Tags[0]
	}
	return ""
}

func (d *Document) Operations() []*Operation { return d.ops }

func (d *Document) Lookup(key string) (*Operation, bool) {
	op, ok := d.byKey[key]
	return op, ok
}

func (d *Document) SchemaNames() []string { return d.schemas }

func (d *Document) SecurityNames() []string {
	names := make([]string, 0, len(d.security))
	for name := range d.security {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
