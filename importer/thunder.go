package importer

import (
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

var thunderOperators = map[string]string{
	"equal": "eq", "=": "eq", "notequal": "neq", "!=": "neq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte",
	"contains": "contains", "notcontains": "notContains", "count": "length", "regex": "matches", "isnumber": "isNumber",
	"isstring": "isString", "isbool": "isBoolean", "isarray": "isArray", "istype": "",
}

func thunderKind(root map[string]any) string {
	switch {
	case strings.Contains(strings.ToLower(text(root["client"])), "thunder") && (root["requests"] != nil || root["collectionName"] != nil):
		return kindThunder
	case root["collectionName"] != nil && root["requests"] != nil:
		return kindThunder
	case root["data"] != nil && text(root["name"]) != "" && (root["sortNum"] != nil || root["_id"] != nil || root["default"] != nil):
		if entries := objects(root["data"]); len(entries) > 0 && entries[0]["name"] != nil {
			return kindThunderEnvironment
		}
	}
	return kindUnknown
}

func sortedBySortNum(items []map[string]any) []map[string]any {
	sorted := append([]map[string]any(nil), items...)
	sort.SliceStable(sorted, func(first, second int) bool {
		return sortNum(sorted[first]) < sortNum(sorted[second])
	})
	return sorted
}

func sortNum(item map[string]any) float64 {
	number, ok := item["sortNum"].(interface{ Float64() (float64, error) })
	if !ok {
		return 0
	}
	value, _ := number.Float64()
	return value
}

func (c *collector) readThunder(doc document) {
	root := object(doc.data)
	name := cleanName(text(root["collectionName"]), strings.TrimSuffix(doc.file.Name, ".json"))
	c.read(name, FormatThunder, func() {
		rootID := c.addFolder(name, "")
		folders := map[string]string{"": rootID}
		pending := sortedBySortNum(objects(root["folders"]))
		for round := 0; round < maxFolderDepth && len(pending) > 0; round++ {
			var later []map[string]any
			for _, folder := range pending {
				parent, known := folders[text(folder["containerId"])]
				if !known {
					later = append(later, folder)
					continue
				}
				folders[text(folder["_id"])] = c.addFolder(text(folder["name"]), parent)
			}
			pending = later
		}
		if len(pending) > 0 {
			c.warnDepth()
		}
		for _, request := range sortedBySortNum(objects(root["requests"])) {
			parent, known := folders[text(request["containerId"])]
			if !known {
				parent = rootID
			}
			c.thunderRequest(request, parent)
		}
	})
}

func thunderRows(value any, pathRows bool) []row {
	return fieldRows(value, "name", "value", func(item map[string]any) bool { return item["isDisabled"] != true && !(pathRows && item["isPath"] == true) })
}

func (c *collector) thunderRequest(source map[string]any, folderID string) {
	name := cleanName(text(source["name"]), text(source["method"])+" "+text(source["url"]))
	request := parts{
		name:    name,
		method:  text(source["method"]),
		url:     text(source["url"]),
		headers: thunderRows(source["headers"], false),
		params:  thunderRows(source["params"], true),
	}
	request.auth = c.thunderAuth(object(source["auth"]), name)
	c.thunderBody(&request, object(source["body"]))
	request.assertions = c.thunderTests(source["tests"], name)
	c.build(request, folderID)
}

func (c *collector) thunderAuth(source map[string]any, name string) *engine.Auth {
	kind := text(source["type"])
	switch kind {
	case "", "none":
		return nil
	case "basic":
		basic := object(source["basic"])
		auth := credentialsAuth(authBasic, text(basic["username"]), text(basic["password"]))
		return &auth
	case "bearer":
		auth := bearerAuth(text(source["bearer"]))
		return &auth
	}
	c.flagUnique(locales.ImporterAuthDropped, name)
	return nil
}

func (c *collector) thunderBody(request *parts, body map[string]any) {
	switch text(body["type"]) {
	case "", "none":
	case "json":
		request.bodyType, request.body = bodyJSON, text(body["raw"])
	case "xml":
		request.bodyType, request.body = bodyXML, text(body["raw"])
	case "text":
		request.bodyType, request.body = bodyText, text(body["raw"])
	case "formencoded":
		request.bodyType, request.body = bodyForm, jsonList(thunderRows(body["form"], false))
	case "formdata":
		rows := thunderRows(body["form"], false)
		for _, file := range objects(body["files"]) {
			rows = append(rows, row{Key: text(file["name"]), Type: rowTypeFile, FileName: baseName(text(file["value"])), Enabled: true})
		}
		request.bodyType, request.body, request.needsFiles = bodyMultipart, jsonList(rows), anyFile(rows)
	case "graphql":
		graphql := object(body["graphql"])
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = text(graphql["query"]), text(graphql["variables"])
	default:
		c.flag(locales.ImporterForeignBodies, request.name)
	}
}

func (c *collector) thunderTests(value any, name string) string {
	var rows []assertion
	left := false
	for _, test := range objects(value) {
		row, ok := thunderCheck(test)
		if !ok {
			left = true
			continue
		}
		rows = append(rows, row)
	}
	if left {
		c.flag(locales.ImporterForeignChecks, name)
	}
	return jsonList(rows)
}

func thunderCheck(test map[string]any) (assertion, bool) {
	operator, known := thunderOperators[strings.ToLower(text(test["action"]))]
	if !known || operator == "" {
		return assertion{}, false
	}
	custom := strings.TrimSpace(text(test["custom"]))
	var expression string
	switch strings.ToLower(text(test["type"])) {
	case "res-code":
		expression = "res.status"
	case "res-body":
		expression = "res.body"
	case "res-header":
		expression = `res.headers["` + strings.ToLower(custom) + `"]`
	case "json-query":
		query := strings.TrimPrefix(custom, "json")
		query = strings.TrimPrefix(query, ".")
		expression = "res.body"
		if query != "" {
			expression += "." + query
			if strings.HasPrefix(query, "[") {
				expression = "res.body" + query
			}
		}
	default:
		return assertion{}, false
	}
	return responseRow(expression, operator, text(test["value"])), true
}

func (c *collector) readThunderEnvironment(doc document) {
	root := object(doc.data)
	name := cleanName(text(root["name"]), "Thunder Client")
	c.read(name, FormatThunder, func() {
		draft := environmentDraft{name: name, global: root["global"] == true}
		for _, item := range objects(root["data"]) {
			draft.variables = append(draft.variables, envVariable{name: text(item["name"]), value: text(item["value"]), enabled: true})
		}
		c.addDraftEnvironments([]environmentDraft{draft})
	})
}
