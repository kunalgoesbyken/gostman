package importer

import (
	"fmt"
	"sort"
	"strings"

	"github.com/krockxz/gostman/engine"
)

const (
	itemFolder        = "folder"
	scriptBefore      = "before-request"
	scriptAfter       = "after-response"
	scriptTests       = "tests"
	collectionBundled = "OpenCollection"
)

func (c *collector) readOpenCollection(doc document) {
	root := object(doc.data)
	info := object(root["info"])
	name := cleanName(text(info["name"]), collectionBundled)
	c.read(name, FormatBruno, func() {
		rootID := c.addFolder(name, "")
		c.openItems(list(root["items"]), rootID, scope{}, 0)
		for _, environment := range objects(root["environments"]) {
			c.openEnvironment(environment)
		}
	})
}

func (c *collector) openItems(items []any, folderID string, inherited scope, depth int) {
	if depth >= maxFolderDepth {
		c.Warnings = appendUnique(c.Warnings, fmt.Sprintf(messageDepth, maxFolderDepth))
		return
	}
	entries := objects(items)
	sort.SliceStable(entries, func(i, j int) bool {
		return sortKeyOf(object(entries[i]["info"])["seq"]) < sortKeyOf(object(entries[j]["info"])["seq"])
	})
	for _, item := range entries {
		info := object(item["info"])
		if text(info["type"]) == itemFolder {
			id := c.addFolder(text(info["name"]), folderID)
			c.openItems(list(item["items"]), id, inherited.within(c.openScope(item)), depth+1)
			continue
		}
		if described := object(item["http"]); described != nil {
			c.openRequest(text(info["name"]), item, described, folderID, inherited)
			continue
		}
		c.skip("%s: only HTTP requests are imported from OpenCollection", cleanName(text(info["name"]), untitledRequest))
	}
}

func (c *collector) openScope(item map[string]any) scope {
	var inherited scope
	described := object(item["request"])
	inherited.headers = openRows(described["headers"])
	if auth := object(described["auth"]); auth != nil {
		converted, ok := c.openAuth(auth)
		if ok {
			inherited.auth = &converted
		}
	}
	pre, post := openScripts(item)
	inherited.pre, inherited.post = nonEmpty(pre), nonEmpty(post)
	return inherited
}

func openRows(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		rows = append(rows, row{Key: text(entry["name"]), Value: text(entry["value"]), Enabled: !flag(entry["disabled"])})
	}
	return keyedRows(rows)
}

func openScripts(item map[string]any) (string, string) {
	var pre, post []string
	for _, entry := range objects(object(item["runtime"])["scripts"]) {
		switch text(entry["type"]) {
		case scriptBefore:
			pre = append(pre, text(entry["code"]))
		case scriptAfter, scriptTests:
			post = append(post, text(entry["code"]))
		}
	}
	return joinScripts(pre), joinScripts(post)
}

func (c *collector) openRequest(name string, item, described map[string]any, folderID string, inherited scope) {
	var params, pathParams []row
	for _, entry := range objects(described["params"]) {
		candidate := row{Key: text(entry["name"]), Value: text(entry["value"]), Enabled: !flag(entry["disabled"])}
		if text(entry["type"]) == "path" {
			pathParams = append(pathParams, candidate)
		} else {
			params = append(params, candidate)
		}
	}
	request := parts{
		name:        name,
		method:      text(described["method"]),
		url:         applyPathParams(text(described["url"]), pathParams),
		description: text(item["docs"]),
		headers:     openRows(described["headers"]),
		params:      params,
	}
	request.preScript, request.postScript = openScripts(item)
	if auth := object(described["auth"]); auth != nil {
		converted, ok := c.openAuth(auth)
		if ok {
			request.auth = &converted
		} else if text(auth["type"]) != "inherit" {
			c.flag(messageAuthDropped, cleanName(name, untitledRequest))
		}
	}
	c.openBody(object(described["body"]), &request)
	request.assertions = openAssertions(object(item["runtime"])["assertions"])
	c.build(request, inherited, folderID)
}

func (c *collector) openAuth(auth map[string]any) (engine.Auth, bool) {
	kind := text(auth["type"])
	switch kind {
	case "none":
		return engine.Auth{}, true
	case authBasic, authDigest:
		return credentialsAuth(kind, text(auth["username"]), text(auth["password"])), true
	case authBearer:
		return bearerAuth(text(auth["token"])), true
	case authNTLM:
		return ntlmAuth(text(auth["username"]), text(auth["password"]), text(auth["domain"])), true
	case authAPIKey:
		return apiKeyAuth(text(auth["key"]), text(auth["value"]), text(auth["placement"]) == inQuery), true
	}
	return engine.Auth{}, false
}

func (c *collector) openBody(body map[string]any, request *parts) {
	if body == nil {
		return
	}
	data := body["data"]
	switch text(body["type"]) {
	case "json":
		request.body, request.bodyType = text(data), bodyJSON
	case "text", "sparql":
		request.body, request.bodyType = text(data), bodyText
	case "xml":
		request.body, request.bodyType = text(data), bodyXML
	case "form-urlencoded":
		request.body, request.bodyType = rowsJSON(openRows(data)), bodyForm
	case "multipart-form":
		rows := openRows(data)
		for index := range rows {
			rows[index].Type = rowTypeText
		}
		request.body, request.bodyType = rowsJSON(rows), bodyMultipart
	case "graphql":
		graphql := object(data)
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = text(graphql["query"]), graphqlVariables(graphql["variables"])
	case "file":
		request.bodyType, request.needsFiles = bodyBinary, true
	}
}

func openAssertions(value any) string {
	var assertions []assertion
	for _, entry := range objects(value) {
		operator, operand, _ := strings.Cut(strings.TrimSpace(text(entry["operator"])), " ")
		mapped, known := brunoAssertOperators[operator]
		if !known {
			continue
		}
		if operand == "" {
			operand = text(entry["value"])
		}
		assertions = append(assertions, assertion{Expression: text(entry["expression"]), Operator: mapped, Value: operand, Enabled: !flag(entry["disabled"])})
	}
	return jsonList(assertions)
}

func (c *collector) openEnvironment(environment map[string]any) {
	variables := map[string]string{}
	for _, entry := range objects(environment["variables"]) {
		if name := text(entry["name"]); name != "" && !flag(entry["disabled"]) {
			variables[name] = text(entry["value"])
		}
	}
	c.addEnvironment(text(environment["name"]), variables)
}
