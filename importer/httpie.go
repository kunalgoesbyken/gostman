package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

func httpieKind(root map[string]any) bool {
	meta := object(root["meta"])
	return strings.EqualFold(text(meta["format"]), "httpie") && object(root["entry"]) != nil
}

func (c *collector) readHTTPie(doc document) {
	entry := object(object(doc.data)["entry"])
	name := cleanName(text(entry["name"]), strings.TrimSuffix(doc.file.Name, ".json"))
	c.read(name, FormatHTTPie, func() {
		c.httpieCollection(entry, "", 0)
	})
}

func (c *collector) httpieCollection(entry map[string]any, parentID string, depth int) {
	if depth >= maxFolderDepth {
		c.warnDepth()
		return
	}
	folderID := c.addScopedFolder(text(entry["name"]), parentID, scope{description: text(entry["summary"])})
	for _, child := range objects(entry["collections"]) {
		c.httpieCollection(child, folderID, depth+1)
	}
	for _, request := range objects(entry["requests"]) {
		c.httpieRequest(request, folderID)
	}
}

func httpieRows(value any) []row {
	var rows []row
	for _, item := range objects(value) {
		rows = append(rows, row{Key: text(item["name"]), Value: text(item["value"]), Enabled: item["enabled"] != false})
	}
	return keyedRows(rows)
}

func (c *collector) httpieRequest(source map[string]any, folderID string) {
	name := cleanName(text(source["name"]), text(source["method"])+" "+text(source["url"]))
	request := parts{
		name:    name,
		method:  text(source["method"]),
		url:     text(source["url"]),
		headers: httpieRows(source["headers"]),
		params:  httpieRows(source["queryParams"]),
	}
	request.auth = c.httpieAuth(object(source["auth"]), name)
	c.httpieBody(&request, object(source["body"]))
	c.build(request, folderID)
}

func (c *collector) httpieAuth(source map[string]any, name string) *engine.Auth {
	kind := strings.ToLower(text(source["type"]))
	credentials := object(source["credentials"])
	if credentials == nil {
		credentials = object(source[kind])
	}
	switch {
	case kind == "" || kind == "none" || source["disabled"] == true:
		return nil
	case kind == "basic" || kind == "digest":
		auth := credentialsAuth(kind, text(credentials["username"]), text(credentials["password"]))
		return &auth
	case kind == "bearer":
		auth := bearerAuth(text(credentials["token"]))
		return &auth
	case kind == "apikey":
		auth := apiKeyAuth(firstValue(credentials["name"], credentials["key"]), text(credentials["value"]), strings.EqualFold(firstValue(credentials["in"], credentials["type"]), "query"))
		return &auth
	}
	c.flagUnique(locales.ImporterAuthDropped, name)
	return nil
}

func (c *collector) httpieBody(request *parts, body map[string]any) {
	switch strings.ToLower(text(body["type"])) {
	case "", "none":
	case "text":
		content := object(body["text"])
		request.body = text(content["value"])
		request.bodyType = bodyText
		switch strings.ToLower(text(content["format"])) {
		case "json":
			request.bodyType = bodyJSON
		case "xml":
			request.bodyType = bodyXML
		}
	case "form":
		form := object(body["form"])
		rows := httpieRows(form["fields"])
		if form["isMultipart"] == true {
			request.bodyType, request.body = bodyMultipart, jsonList(rows)
			return
		}
		request.bodyType, request.body = bodyForm, jsonList(rows)
	case "graphql":
		graphql := object(body["graphql"])
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = text(graphql["query"]), text(graphql["variables"])
	default:
		c.flag(locales.ImporterForeignBodies, request.name)
	}
}
