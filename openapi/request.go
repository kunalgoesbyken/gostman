package openapi

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	BaseURLVariable = "baseUrl"

	maxExamples     = 6
	maxExampleBytes = 64 << 10
	maxNameLength   = 200

	bodyNone      = "none"
	bodyJSON      = "json"
	bodyText      = "text"
	bodyXML       = "xml"
	bodyForm      = "form"
	bodyMultipart = "multipart"
	bodyBinary    = "binary"
)

var preferredContentTypes = []string{
	"application/json",
	"application/ld+json",
	"application/x-www-form-urlencoded",
	"multipart/form-data",
	"text/plain",
	"application/xml",
	"text/xml",
}

var engineDefaults = map[string]string{
	bodyJSON: "application/json",
	bodyText: "text/plain",
	bodyXML:  "application/xml",
	bodyForm: "application/x-www-form-urlencoded",
}

var reservedHeaders = map[string]bool{"accept": true, "content-type": true, "authorization": true}

type Row struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled bool   `json:"enabled"`
	Type    string `json:"type,omitempty"`
}

type Example struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Status       int      `json:"status"`
	Headers      []Header `json:"headers"`
	Body         string   `json:"body"`
	BodyEncoding string   `json:"bodyEncoding"`
	ContentType  string   `json:"contentType"`
	IsDefault    bool     `json:"isDefault"`
}

type Header struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type Request struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	URL         string      `json:"url"`
	Method      string      `json:"method"`
	Headers     string      `json:"headers"`
	Body        string      `json:"body"`
	BodyType    string      `json:"bodyType"`
	QueryParams string      `json:"queryParams"`
	FolderID    string      `json:"folderId"`
	Auth        engine.Auth `json:"auth"`
	Examples    string      `json:"examples"`
}

type param struct {
	name        string
	in          string
	required    bool
	description string
	schema      node
	meta        map[string]any
	doc         *docCtx
}

func (d *Document) params(o *Operation) []param {
	byIdentity := map[string]param{}
	var order []string
	collect := func(owner node) {
		for _, raw := range asList(d.l.child(owner, "parameters").v) {
			meta, doc, _ := d.l.resolved(node{v: raw, d: owner.d})
			if meta == nil {
				continue
			}
			p := param{
				name:        asString(meta["name"]),
				in:          asString(meta["in"]),
				required:    asBool(meta["required"]) || asString(meta["in"]) == "path",
				description: asString(meta["description"]),
				meta:        meta,
				doc:         doc,
			}
			p.schema = node{v: meta, d: doc}
			if schema, ok := meta["schema"]; ok {
				p.schema = node{v: schema, d: doc}
			}
			identity := p.in + ":" + p.name
			if _, seen := byIdentity[identity]; !seen {
				order = append(order, identity)
			}
			byIdentity[identity] = p
		}
	}
	collect(o.item)
	collect(o.op)
	result := make([]param, 0, len(order))
	for _, identity := range order {
		result = append(result, byIdentity[identity])
	}
	return result
}

func (d *Document) paramValue(p param) string {
	if value, ok := p.meta["example"]; ok && value != nil {
		return paramText(value)
	}
	if named := asMap(p.meta["examples"]); len(named) > 0 {
		first, _, _ := d.l.resolved(node{v: named[sortedKeys(named)[0]], d: p.doc})
		if value, ok := first["value"]; ok {
			return paramText(value)
		}
	}
	value, ok := d.l.exampleOf(p.schema, forRequest)
	if !ok {
		return ""
	}
	return paramText(value)
}

func paramText(value any) string {
	if list, ok := value.([]any); ok {
		if len(list) == 0 {
			return ""
		}
		value = list[0]
	}
	return scalarText(value)
}

func encodeRows(rows []Row) string {
	if len(rows) == 0 {
		return ""
	}
	encoded, _ := json.Marshal(rows)
	return string(encoded)
}

func (d *Document) GenerateRequest(o *Operation) *Request {
	if o.request != nil {
		return o.request
	}
	params := d.params(o)
	request := &Request{Method: o.Method, Name: requestName(o)}

	path := o.Path
	var query []string
	var disabled, headers []Row
	for _, p := range params {
		value := d.paramValue(p)
		switch p.in {
		case "path":
			if value == "" {
				value = "{{" + p.name + "}}"
			} else {
				value = url.PathEscape(value)
			}
			path = strings.ReplaceAll(path, "{"+p.name+"}", value)
		case "query":
			if p.required {
				query = append(query, url.QueryEscape(p.name)+"="+url.QueryEscape(value))
			} else {
				disabled = append(disabled, Row{Key: p.name, Value: value})
			}
		case "header":
			if !reservedHeaders[strings.ToLower(p.name)] {
				headers = append(headers, Row{Key: p.name, Value: value, Enabled: p.required})
			}
		}
	}
	for _, name := range placeholders(path) {
		path = strings.ReplaceAll(path, "{"+name+"}", "{{"+name+"}}")
	}
	request.URL = "{{" + BaseURLVariable + "}}" + path
	if len(query) > 0 {
		request.URL += "?" + strings.Join(query, "&")
	}
	request.QueryParams = encodeRows(disabled)

	body := d.requestBody(o, params)
	request.Body, request.BodyType = body.text, body.kind
	if body.contentType != "" {
		headers = append(headers, Row{Key: "Content-Type", Value: body.contentType, Enabled: true})
	}
	request.Headers = encodeRows(headers)

	auth, authNote := d.authFor(o)
	request.Auth = auth
	request.Description = d.describe(o, params, authNote)
	request.Examples = d.responseExamples(o)

	request.ID, request.FolderID = "", ""
	o.request = request
	o.Hash = fingerprint(request)
	return request
}

func placeholders(path string) []string {
	var names []string
	for {
		start := strings.Index(path, "{")
		if start < 0 || strings.HasPrefix(path[start:], "{{") {
			return names
		}
		end := strings.Index(path[start:], "}")
		if end < 0 {
			return names
		}
		names = append(names, path[start+1:start+end])
		path = path[start+end+1:]
	}
}

func requestName(o *Operation) string {
	name := firstLine(o.Summary)
	if name == "" {
		name = o.OperationID
	}
	if name == "" {
		name = o.Method + " " + o.Path
	}
	if runes := []rune(name); len(runes) > maxNameLength {
		name = string(runes[:maxNameLength])
	}
	return name
}

func firstLine(text string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(text), "\n")
	return strings.TrimSpace(line)
}

func fingerprint(request *Request) string {
	encoded, _ := json.Marshal(request)
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:6])
}

type bodyResult struct {
	text        string
	kind        string
	contentType string
}

func (d *Document) requestBody(o *Operation, params []param) bodyResult {
	if d.v2 {
		return d.requestBody2(o, params)
	}
	body, doc, _ := d.l.resolved(d.l.child(o.op, "requestBody"))
	content := asMap(body["content"])
	contentType := pickContentType(content)
	if contentType == "" {
		return bodyResult{}
	}
	media, mediaDoc, _ := d.l.resolved(node{v: content[contentType], d: doc})
	value, ok := d.mediaExample(media, mediaDoc, forRequest)
	return shapeBody(contentType, value, ok, asMap(media["schema"]) != nil)
}

func (d *Document) requestBody2(o *Operation, params []param) bodyResult {
	consumes := stringList(d.l.child(o.op, "consumes").v)
	if len(consumes) == 0 {
		consumes = stringList(d.l.main.root["consumes"])
	}
	var form []param
	for _, p := range params {
		switch p.in {
		case "body":
			contentType := pickAmong(consumes, "application/json")
			value, ok := d.l.exampleOf(p.schema, forRequest)
			if example, hasExample := p.meta["x-example"]; hasExample {
				value, ok = example, true
			}
			return shapeBody(contentType, value, ok, true)
		case "formData":
			form = append(form, p)
		}
	}
	if len(form) == 0 {
		return bodyResult{}
	}
	contentType := pickAmong(consumes, "application/x-www-form-urlencoded")
	for _, p := range form {
		if asString(p.meta["type"]) == "file" {
			contentType = "multipart/form-data"
		}
	}
	fields := &ordered{vals: map[string]any{}}
	for _, p := range form {
		if asString(p.meta["type"]) == "file" {
			fields.set(p.name, "")
			continue
		}
		fields.set(p.name, d.paramValue(p))
	}
	return shapeBody(contentType, fields, true, true)
}

func pickAmong(list []string, fallback string) string {
	for _, preferred := range preferredContentTypes {
		for _, candidate := range list {
			if candidate == preferred {
				return candidate
			}
		}
	}
	if len(list) > 0 {
		return list[0]
	}
	return fallback
}

func stringList(v any) []string {
	var list []string
	for _, item := range asList(v) {
		if text := asString(item); text != "" {
			list = append(list, text)
		}
	}
	return list
}

func pickContentType(content map[string]any) string {
	for _, preferred := range preferredContentTypes {
		if _, ok := content[preferred]; ok {
			return preferred
		}
	}
	keys := sortedKeys(content)
	if len(keys) > 0 {
		return keys[0]
	}
	return ""
}

func (d *Document) mediaExample(media map[string]any, doc *docCtx, mode exampleMode) (any, bool) {
	if media == nil {
		return nil, false
	}
	if value, ok := media["example"]; ok && value != nil {
		return value, true
	}
	if named := asMap(media["examples"]); len(named) > 0 {
		first, _, _ := d.l.resolved(node{v: named[sortedKeys(named)[0]], d: doc})
		if value, ok := first["value"]; ok {
			return value, true
		}
	}
	if schema, ok := media["schema"]; ok {
		return d.l.exampleOf(node{v: schema, d: doc}, mode)
	}
	return nil, false
}

func bodyKind(contentType string) string {
	lower := strings.ToLower(contentType)
	switch {
	case strings.Contains(lower, "json"):
		return bodyJSON
	case lower == "application/x-www-form-urlencoded":
		return bodyForm
	case lower == "multipart/form-data":
		return bodyMultipart
	case strings.Contains(lower, "xml"):
		return bodyXML
	case strings.HasPrefix(lower, "text/"):
		return bodyText
	}
	return bodyBinary
}

func shapeBody(contentType string, value any, ok, hasSchema bool) bodyResult {
	kind := bodyKind(contentType)
	result := bodyResult{kind: kind}
	if kind != bodyMultipart && engineDefaults[kind] != contentType {
		result.contentType = contentType
	}
	if kind == bodyBinary {
		result.kind = bodyNone
		return result
	}
	if !ok {
		if !hasSchema {
			result.kind = bodyNone
		}
		return result
	}
	switch kind {
	case bodyJSON:
		if text, isText := value.(string); isText && looksLikeJSON(text) {
			result.text = text
		} else {
			result.text = prettyJSON(value)
		}
	case bodyForm, bodyMultipart:
		result.text = encodeRows(formRows(value, kind == bodyMultipart))
	case bodyXML:
		if text, isText := value.(string); isText {
			result.text = text
		} else {
			result.text = xmlDocument("root", value)
		}
	default:
		result.text = scalarText(value)
	}
	return result
}

func looksLikeJSON(text string) bool {
	trimmed := strings.TrimSpace(text)
	return strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[")
}

func formRows(value any, multipart bool) []Row {
	var rows []Row
	add := func(key string, item any) {
		row := Row{Key: key, Value: scalarText(item), Enabled: true}
		if multipart {
			row.Type = "text"
		}
		rows = append(rows, row)
	}
	switch typed := value.(type) {
	case *ordered:
		for _, key := range typed.keys {
			add(key, typed.vals[key])
		}
	case map[string]any:
		for _, key := range sortedKeys(typed) {
			add(key, typed[key])
		}
	case string:
		if parsed, err := url.ParseQuery(typed); err == nil {
			keys := make([]string, 0, len(parsed))
			for key := range parsed {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			for _, key := range keys {
				add(key, parsed.Get(key))
			}
		}
	}
	return rows
}

func (d *Document) authFor(o *Operation) (engine.Auth, string) {
	requirements, defined := d.l.child(o.op, "security").v, false
	if _, ok := asMap(o.op.v)["security"]; ok {
		defined = true
	}
	if !defined {
		requirements = d.l.main.root["security"]
	}
	var alternatives [][]string
	for _, raw := range asList(requirements) {
		names := sortedKeys(asMap(raw))
		if len(names) > 0 {
			alternatives = append(alternatives, names)
		}
	}
	if len(alternatives) == 0 {
		return engine.Auth{}, ""
	}
	var notes []string
	for _, names := range alternatives {
		var parts []string
		for _, name := range names {
			parts = append(parts, name+" ("+d.schemeLabel(name)+")")
		}
		notes = append(notes, strings.Join(parts, " + "))
	}
	note := "Authentication: " + strings.Join(notes, " or ")
	for _, name := range alternatives[0] {
		if auth, ok := d.authFromScheme(d.security[name]); ok {
			return auth, note
		}
	}
	return engine.Auth{}, note
}

func (d *Document) schemeLabel(name string) string {
	scheme := d.security[name]
	switch kind := asString(scheme["type"]); kind {
	case "http":
		return "HTTP " + asString(scheme["scheme"])
	case "apiKey":
		return "API key in " + asString(scheme["in"]) + " " + asString(scheme["name"])
	case "":
		return "unknown"
	default:
		return kind
	}
}

func (d *Document) authFromScheme(scheme map[string]any) (engine.Auth, bool) {
	switch asString(scheme["type"]) {
	case "http":
		switch strings.ToLower(asString(scheme["scheme"])) {
		case "bearer":
			return engine.Auth{Type: "bearer", Token: "{{token}}"}, true
		case "basic":
			return engine.Auth{Type: "basic", Username: "{{username}}", Password: "{{password}}"}, true
		}
	case "basic":
		return engine.Auth{Type: "basic", Username: "{{username}}", Password: "{{password}}"}, true
	case "oauth2", "openIdConnect":
		return engine.Auth{Type: "bearer", Token: "{{accessToken}}"}, true
	case "apiKey":
		location := asString(scheme["in"])
		if location == "header" || location == "query" {
			return engine.Auth{Type: "apikey", Key: asString(scheme["name"]), Value: "{{apiKey}}", In: location}, true
		}
	}
	return engine.Auth{}, false
}

func (d *Document) describe(o *Operation, params []param, authNote string) string {
	var out []string
	text := strings.TrimSpace(asString(asMap(o.op.v)["description"]))
	if text == "" {
		text = strings.TrimSpace(o.Summary)
	}
	if text != "" {
		out = append(out, text)
	}
	if o.Deprecated {
		out = append(out, "Deprecated.")
	}
	var documented []string
	for _, p := range params {
		if p.name == "" {
			continue
		}
		line := "- " + p.name + " (" + p.in
		if p.required {
			line += ", required"
		}
		line += ")"
		if p.description != "" {
			line += ": " + firstLine(p.description)
		}
		documented = append(documented, line)
	}
	if len(documented) > 0 {
		out = append(out, "Parameters:\n"+strings.Join(documented, "\n"))
	}
	if authNote != "" {
		out = append(out, authNote)
	}
	return strings.Join(out, "\n\n")
}

func (d *Document) responseExamples(o *Operation) string {
	responses := asMap(asMap(o.op.v)["responses"])
	var examples []Example
	for _, code := range sortedKeys(responses) {
		if len(examples) >= maxExamples {
			break
		}
		status, ok := statusOf(code)
		if !ok {
			continue
		}
		response, doc, _ := d.l.resolved(node{v: responses[code], d: o.op.d})
		if response == nil {
			continue
		}
		for _, example := range d.exampleFor(o, response, doc, status, code) {
			if len(examples) < maxExamples {
				examples = append(examples, example)
			}
		}
	}
	if len(examples) == 0 {
		return ""
	}
	chosen := 0
	for index, example := range examples {
		if example.Status >= 200 && example.Status < 300 {
			chosen = index
			break
		}
	}
	for index := range examples {
		examples[index].ID = fmt.Sprintf("%s-%d", exampleSalt(o), index+1)
		examples[index].IsDefault = index == chosen
	}
	encoded, _ := json.Marshal(examples)
	return string(encoded)
}

func exampleSalt(o *Operation) string {
	sum := sha256.Sum256([]byte(o.Key))
	return "ex-" + hex.EncodeToString(sum[:4])
}

func statusOf(code string) (int, bool) {
	if number, err := strconv.Atoi(code); err == nil && number >= 100 && number <= 599 {
		return number, true
	}
	if len(code) == 3 && strings.HasSuffix(strings.ToUpper(code), "XX") {
		if class, err := strconv.Atoi(code[:1]); err == nil && class >= 1 && class <= 5 {
			return class * 100, true
		}
	}
	return 0, false
}

func (d *Document) exampleFor(o *Operation, response map[string]any, doc *docCtx, status int, code string) []Example {
	label := strings.TrimSpace(code + " " + firstLine(asString(response["description"])))
	if runes := []rune(label); len(runes) > 80 {
		label = string(runes[:80])
	}
	if d.v2 {
		return d.exampleFor2(o, response, doc, status, label)
	}
	content := asMap(response["content"])
	contentType := pickContentType(content)
	if contentType == "" {
		return nil
	}
	media, mediaDoc, _ := d.l.resolved(node{v: content[contentType], d: doc})
	value, ok := d.mediaExample(media, mediaDoc, forResponse)
	if !ok {
		return nil
	}
	return exampleFrom(label, status, contentType, value)
}

func (d *Document) exampleFor2(o *Operation, response map[string]any, doc *docCtx, status int, label string) []Example {
	produces := stringList(d.l.child(o.op, "produces").v)
	if len(produces) == 0 {
		produces = stringList(d.l.main.root["produces"])
	}
	contentType := pickAmong(produces, "application/json")
	if given := asMap(response["examples"]); len(given) > 0 {
		key := contentType
		if _, ok := given[key]; !ok {
			key = sortedKeys(given)[0]
		}
		return exampleFrom(label, status, key, given[key])
	}
	if schema, ok := response["schema"]; ok {
		if value, generated := d.l.exampleOf(node{v: schema, d: doc}, forResponse); generated {
			return exampleFrom(label, status, contentType, value)
		}
	}
	return nil
}

func exampleFrom(label string, status int, contentType string, value any) []Example {
	var body string
	switch kind := bodyKind(contentType); kind {
	case bodyJSON:
		if text, isText := value.(string); isText && looksLikeJSON(text) {
			body = text
		} else {
			body = prettyJSON(value)
		}
	case bodyXML:
		if text, isText := value.(string); isText {
			body = text
		} else {
			body = xmlDocument("root", value)
		}
	case bodyText, bodyForm:
		body = scalarText(value)
	default:
		return nil
	}
	if body == "" || len(body) > maxExampleBytes {
		return nil
	}
	return []Example{{
		Name:         label,
		Status:       status,
		Headers:      []Header{{Key: "Content-Type", Value: contentType}},
		Body:         body,
		BodyEncoding: "utf8",
		ContentType:  contentType,
	}}
}
