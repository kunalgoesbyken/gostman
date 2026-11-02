package importer

import (
	"regexp"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

var hoppscotchVariable = regexp.MustCompile(`<<([^<>\s]+)>>`)

func hoppscotchText(source string) string {
	return hoppscotchVariable.ReplaceAllString(source, "{{$1}}")
}

func hoppscotchEntries(data any) []map[string]any {
	if root := object(data); root != nil {
		return []map[string]any{root}
	}
	return objects(data)
}

func hoppscotchKind(data any) string {
	items := hoppscotchEntries(data)
	if len(items) == 0 {
		return kindUnknown
	}
	for _, item := range items {
		if item["v"] == nil || text(item["name"]) == "" {
			return kindUnknown
		}
	}
	first := items[0]
	_, folders := first["folders"].([]any)
	_, requests := first["requests"].([]any)
	if folders || requests {
		return kindHoppscotch
	}
	if variables := objects(first["variables"]); len(variables) > 0 && variables[0]["key"] != nil {
		return kindHoppscotchEnvironment
	}
	return kindUnknown
}

func (c *collector) readHoppscotch(doc document) {
	for _, entry := range hoppscotchEntries(doc.data) {
		name := cleanName(text(entry["name"]), "Hoppscotch")
		c.read(name, FormatHoppscotch, func() {
			c.hoppscotchFolder(entry, "", 0)
		})
	}
}

func (c *collector) hoppscotchFolder(entry map[string]any, parentID string, depth int) {
	if depth >= maxFolderDepth {
		c.warnDepth()
		return
	}
	settings := scope{headers: hoppscotchRows(entry["headers"]), description: text(entry["description"])}
	if auth, ok := c.hoppscotchAuth(object(entry["auth"]), text(entry["name"])); ok && auth != nil {
		settings.auth = auth
	}
	folderID := c.addScopedFolder(text(entry["name"]), parentID, settings)
	for _, child := range objects(entry["folders"]) {
		c.hoppscotchFolder(child, folderID, depth+1)
	}
	for _, request := range objects(entry["requests"]) {
		c.hoppscotchRequest(request, folderID)
	}
}

func hoppscotchRows(value any) []row {
	var rows []row
	for _, item := range objects(value) {
		rows = append(rows, row{Key: hoppscotchText(text(item["key"])), Value: hoppscotchText(text(item["value"])), Enabled: item["active"] != false})
	}
	return keyedRows(rows)
}

func (c *collector) hoppscotchRequest(source map[string]any, folderID string) {
	name := cleanName(text(source["name"]), text(source["method"])+" "+text(source["endpoint"]))
	request := parts{
		name:        name,
		method:      text(source["method"]),
		url:         hoppscotchText(text(source["endpoint"])),
		description: text(source["description"]),
		params:      hoppscotchRows(source["params"]),
		headers:     hoppscotchRows(source["headers"]),
		vars:        hoppscotchRows(source["requestVariables"]),
		preScript:   text(source["preRequestScript"]),
		postScript:  text(source["testScript"]),
	}
	if auth, ok := c.hoppscotchAuth(object(source["auth"]), name); ok {
		request.auth = auth
	}
	c.hoppscotchBody(&request, object(source["body"]))
	c.build(request, folderID)
}

func (c *collector) hoppscotchAuth(source map[string]any, name string) (*engine.Auth, bool) {
	kind := text(source["authType"])
	switch {
	case source == nil || kind == "inherit":
		return nil, true
	case kind == "none" || source["authActive"] == false:
		return noAuth(), true
	}
	field := func(key string) string { return hoppscotchText(text(source[key])) }
	var auth engine.Auth
	switch kind {
	case "basic", "digest":
		auth = credentialsAuth(kind, field("username"), field("password"))
	case "bearer":
		auth = bearerAuth(field("token"))
	case "api-key":
		auth = apiKeyAuth(field("key"), field("value"), text(source["addTo"]) == "QUERY_PARAMS")
	default:
		c.flagUnique(locales.ImporterAuthDropped, name)
		return nil, false
	}
	return &auth, true
}

func (c *collector) hoppscotchBody(request *parts, body map[string]any) {
	contentType := text(body["contentType"])
	if contentType == "" {
		return
	}
	switch bodyTypeOfMime(contentType) {
	case bodyForm:
		request.bodyType = bodyForm
		request.body = jsonList(hoppscotchFormRows(body["body"], false))
	case bodyMultipart:
		rows := hoppscotchFormRows(body["body"], true)
		request.bodyType, request.body, request.needsFiles = bodyMultipart, jsonList(rows), anyFile(rows)
	case bodyBinary:
		c.flag(locales.ImporterForeignBodies, request.name)
	case bodyJSON:
		request.bodyType, request.body = bodyJSON, hoppscotchText(text(body["body"]))
	case bodyXML:
		request.bodyType, request.body = bodyXML, hoppscotchText(text(body["body"]))
	default:
		request.bodyType, request.body = bodyText, hoppscotchText(text(body["body"]))
	}
}

func hoppscotchFormRows(body any, files bool) []row {
	if items := objects(body); items != nil {
		var rows []row
		for _, item := range items {
			entry := row{Key: hoppscotchText(text(item["key"])), Value: hoppscotchText(text(item["value"])), Enabled: item["active"] != false}
			if files && item["isFile"] == true {
				entry.Type, entry.Value = rowTypeFile, ""
			}
			rows = append(rows, entry)
		}
		return keyedRows(rows)
	}
	var rows []row
	for _, line := range strings.Split(hoppscotchText(text(body)), "\n") {
		enabled := !strings.HasPrefix(line, "//")
		key, value, _ := strings.Cut(strings.TrimPrefix(line, "//"), ":")
		rows = append(rows, row{Key: strings.TrimSpace(key), Value: strings.TrimSpace(value), Enabled: enabled})
	}
	return keyedRows(rows)
}

func (c *collector) readHoppscotchEnvironments(doc document) {
	for _, entry := range hoppscotchEntries(doc.data) {
		name := cleanName(text(entry["name"]), "Hoppscotch")
		c.read(name, FormatHoppscotch, func() {
			draft := environmentDraft{name: name}
			for _, item := range objects(entry["variables"]) {
				value := firstValue(item["value"], item["currentValue"], item["initialValue"])
				draft.variables = append(draft.variables, envVariable{name: text(item["key"]), value: hoppscotchText(value), enabled: true, secret: item["secret"] == true})
			}
			c.addDraftEnvironments([]environmentDraft{draft})
		})
	}
}

func firstValue(values ...any) string {
	for _, value := range values {
		if found := text(value); found != "" {
			return found
		}
	}
	return ""
}
