package importer

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	itemFolder        = "folder"
	itemGraphQL       = "graphql"
	itemGrpc          = "grpc"
	itemWebSocket     = "websocket"
	itemWorkspace     = "workspace"
	scriptBefore      = "before-request"
	scriptAfter       = "after-response"
	scriptTests       = "tests"
	actionSetVariable = "set-variable"
	collectionBundled = "OpenCollection"
	flowPassword      = "resource_owner_password_credentials"
)

func (c *collector) readOpenCollection(doc document) {
	c.readOpenTree(doc, path.Dir(doc.file.Name))
}

func (c *collector) readOpenTree(doc document, root string) {
	data := object(doc.data)
	name := cleanName(text(object(data["info"])["name"]), collectionBundled)
	c.read(name, FormatBruno, func() {
		paths := openPaths(list(data["items"]), "", 0)
		ids, translation := runTargets(paths)
		ctx := treeContext{root: root, dialect: translation, ids: ids}
		since := c.mark()
		rootID := c.addScopedFolder(name, "", c.collectionScope(c.openScope(ctx, data, placeLabel(labelCollection, name))))
		c.openItems(ctx, list(data["items"]), rootID, "", 0)
		var drafts []environmentDraft
		for _, environment := range objects(data["environments"]) {
			drafts = append(drafts, openEnvironment(environment, text(environment["name"])))
		}
		c.addBrunoEnvironments(inFolder(drafts, rootID))
		c.noteDotEnv(name, since)
		c.summarizeScripts(brunoDialect, name)
	})
}

func sortedItems(items []any) []map[string]any {
	entries := objects(items)
	sort.SliceStable(entries, func(i, j int) bool {
		return sortKeyOf(object(entries[i]["info"])["seq"]) < sortKeyOf(object(entries[j]["info"])["seq"])
	})
	return entries
}

func openPaths(items []any, prefix string, depth int) []requestPath {
	if depth >= maxFolderDepth {
		return nil
	}
	var paths []requestPath
	for _, item := range sortedItems(items) {
		info := object(item["info"])
		name := cleanName(text(info["name"]), untitledRequest)
		if text(info["type"]) == itemFolder {
			paths = append(paths, openPaths(list(item["items"]), path.Join(prefix, name), depth+1)...)
			continue
		}
		paths = append(paths, requestPath{path: path.Join(prefix, name), name: name})
	}
	return paths
}

func (c *collector) openItems(ctx treeContext, items []any, folderID, prefix string, depth int) {
	if depth >= maxFolderDepth {
		c.warnDepth()
		return
	}
	for _, item := range sortedItems(items) {
		info := object(item["info"])
		name := cleanName(text(info["name"]), untitledRequest)
		if text(info["type"]) == itemFolder {
			id := c.addScopedFolder(text(info["name"]), folderID, c.openScope(ctx, item, placeLabel(labelFolder, name)))
			c.openItems(ctx, list(item["items"]), id, path.Join(prefix, name), depth+1)
			continue
		}
		c.openRequest(ctx, name, path.Join(prefix, name), item, folderID)
	}
}

func (c *collector) openScope(ctx treeContext, item map[string]any, label locales.Message) scope {
	inherited := scope{description: describedText(item["docs"])}
	described := object(item["request"])
	inherited.headers = openRows(described["headers"])
	inherited.vars = openRows(described["variables"])
	if auth := described["auth"]; auth != nil {
		if converted, ok := c.openAuth(auth); ok {
			inherited.auth = &converted
		}
	}
	inherited.pre, inherited.post = c.openScripts(ctx.dialect, append(objects(described["scripts"]), runtimeScripts(item)...), label)
	return inherited
}

func openRows(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		rows = append(rows, row{Key: text(entry["name"]), Value: openValue(entry["value"]), Enabled: !flag(entry["disabled"])})
	}
	return keyedRows(rows)
}

func openValue(value any) string {
	if typed := object(value); typed != nil {
		return text(typed["data"])
	}
	return text(value)
}

func runtimeScripts(item map[string]any) []map[string]any {
	return objects(object(item["runtime"])["scripts"])
}

func (c *collector) openScripts(d *dialect, entries []map[string]any, label locales.Message) (string, string) {
	var pre, post, hooks []string
	for _, entry := range entries {
		code := text(entry["code"])
		switch kind := text(entry["type"]); {
		case kind == scriptBefore:
			pre = append(pre, c.translateScript(d, label, stagePre, code))
		case kind == scriptAfter:
			post = append(post, c.translateScript(d, label, stageAfter, code))
		case kind == scriptTests:
			post = append(post, c.translateScript(d, label, stagePost, code))
		case strings.TrimSpace(code) != "":
			hooks = append(hooks, kind)
		}
	}
	if len(hooks) > 0 {
		c.warn(RemarkScripts, droppedScripts(label, hooks))
	}
	return joinScripts(pre), joinScripts(post)
}

func (c *collector) openRequest(ctx treeContext, name, location string, item map[string]any, folderID string) {
	info := object(item["info"])
	runtime := object(item["runtime"])
	request := parts{
		id:          ctx.ids[location],
		name:        name,
		description: describedText(item["docs"]),
		tags:        texts(info["tags"]),
		vars:        openRows(runtime["variables"]),
	}
	label := placeLabel(labelRequest, name)
	request.preScript, request.postScript = c.openScripts(ctx.dialect, runtimeScripts(item), label)
	rows, tests := c.brunoChecks(ctx.dialect, label, openAssertChecks(runtime["assertions"]))
	request.postScript = joinScripts([]string{request.postScript, tests})
	request.assertions = jsonList(rows)
	var described map[string]any
	switch kind := text(info["type"]); {
	case object(item["http"]) != nil || kind == itemGraphQL && object(item["graphql"]) != nil:
		described = object(item["http"])
		if described == nil {
			described = object(item["graphql"])
		}
		c.openHTTP(item, described, &request)
	case kind == itemGrpc:
		described = object(item["grpc"])
		c.openGrpc(ctx, described, &request)
	case kind == itemWebSocket:
		described = object(item["websocket"])
		socketParts(text(described["url"]), openSocketMessages(described["message"]), &request)
		request.headers = openRows(described["headers"])
	default:
		c.skip(locales.ImporterOpenItemType, locales.Params{"name": name, "type": kind})
		return
	}
	if auth := described["auth"]; text(auth) != authInherit {
		converted, supported := c.openAuth(auth)
		request.auth = c.checkedAuth(name, converted, supported)
	}
	c.build(request, folderID)
}

func (c *collector) openHTTP(item, described map[string]any, request *parts) {
	var pathParams []row
	for _, entry := range objects(described["params"]) {
		candidate := row{Key: text(entry["name"]), Value: text(entry["value"]), Enabled: !flag(entry["disabled"])}
		if text(entry["type"]) == "path" {
			pathParams = append(pathParams, candidate)
		} else {
			request.params = append(request.params, candidate)
		}
	}
	address, pathVars := pathParamVariables(text(described["url"]), pathParams)
	request.method = text(described["method"])
	request.url = address
	request.vars = append(request.vars, pathVars...)
	request.headers = openRows(described["headers"])
	if strings.Contains(request.url, "?") {
		request.params = disabledOnly(request.params)
	}
	c.openBody(openBodyOf(described["body"]), request)
	request.extractors = c.openExtractors(request.name, object(item["runtime"])["actions"])
	settings := object(item["settings"])
	request.options = c.settingsOptions(request.name, requestSettings{
		timeout:         text(settings["timeout"]),
		followRedirects: text(settings["followRedirects"]),
		maxRedirects:    text(settings["maxRedirects"]),
	})
	request.examples = c.savedExamples(request.name, openExamples(item["examples"]))
}

func openBodyOf(value any) map[string]any {
	variants := objects(value)
	if variants == nil {
		return object(value)
	}
	for _, variant := range variants {
		if flag(variant["selected"]) {
			return object(variant["body"])
		}
	}
	if len(variants) > 0 {
		return object(variants[0]["body"])
	}
	return nil
}

func (c *collector) openGrpc(ctx treeContext, described map[string]any, request *parts) {
	call := grpcCall{
		url:        text(described["url"]),
		method:     text(described["method"]),
		methodType: text(described["methodType"]),
		protoPath:  text(described["protoFilePath"]),
	}
	if single, isText := described["message"].(string); isText {
		call.messages = []string{single}
	}
	for _, message := range objects(described["message"]) {
		call.messages = append(call.messages, text(message["message"]))
	}
	c.grpcParts(ctx.root, call, request)
	request.headers = openRows(described["metadata"])
}

func openSocketMessages(value any) []socketMessage {
	entries := objects(value)
	if single := object(value); single != nil {
		entries = []map[string]any{{"message": single}}
	}
	var messages []socketMessage
	for index, entry := range entries {
		name := cleanName(text(entry["title"]), fmt.Sprintf(untitledMessage, index+1))
		messages = append(messages, socketMessage{Name: name, Body: openValue(entry["message"])})
	}
	return messages
}

func openExamples(value any) []exampleDraft {
	var drafts []exampleDraft
	for _, example := range objects(value) {
		response := object(example["response"])
		body := object(response["body"])
		drafts = append(drafts, exampleDraft{
			name:        text(example["name"]),
			status:      text(response["status"]),
			headers:     openRows(response["headers"]),
			body:        text(body["data"]),
			contentType: exampleContentType(text(body["type"])),
		})
	}
	return drafts
}

func (c *collector) openExtractors(name string, actions any) string {
	var extractors []extractor
	for _, action := range objects(actions) {
		if text(action["type"]) != actionSetVariable || text(action["phase"]) != scriptAfter {
			continue
		}
		variable := text(object(action["variable"])["name"])
		expression := text(object(action["selector"])["expression"])
		rule, ok := responseExtractor(variable, expression, !flag(action["disabled"]))
		if !ok {
			c.skip(locales.ImporterPostResponseVariable, locales.Params{"name": name, "variable": variable, "expression": expression})
			continue
		}
		extractors = append(extractors, rule)
	}
	return jsonList(extractors)
}

func (c *collector) openAuth(value any) (engine.Auth, bool) {
	auth := object(value)
	kind := text(auth["type"])
	if auth == nil {
		kind = text(value)
	}
	field := func(key string) string { return text(auth[key]) }
	switch kind {
	case authNone, "":
		return engine.Auth{}, true
	case authBasic, authDigest:
		return credentialsAuth(kind, field("username"), field("password")), true
	case authBearer:
		return bearerAuth(field("token")), true
	case authNTLM:
		return ntlmAuth(field("username"), field("password"), field("domain")), true
	case authAPIKey:
		return apiKeyAuth(field("key"), field("value"), field("placement") == inQuery), true
	case authAWS:
		return awsAuth(field("accessKeyId"), field("secretAccessKey"), field("sessionToken"), field("region"), field("service")), true
	case authOAuth2:
		return openOAuth2(auth)
	}
	return engine.Auth{}, false
}

func openOAuth2(auth map[string]any) (engine.Auth, bool) {
	credentials := object(auth["credentials"])
	owner := object(auth["resourceOwner"])
	grant := text(auth["flow"])
	if grant == flowPassword {
		grant = grantPassword
	}
	pkce := object(auth["pkce"])
	token := object(auth["tokenConfig"])
	return oauth2Auth(oauth2Fields{
		Grant: grant, AuthURL: text(auth["authorizationUrl"]), TokenURL: text(auth["accessTokenUrl"]),
		ClientID: text(credentials["clientId"]), ClientSecret: text(credentials["clientSecret"]), Scope: text(auth["scope"]),
		Username: text(owner["username"]), Password: text(owner["password"]), CallbackURL: text(auth["callbackUrl"]),
		HeaderPrefix: text(object(token["placement"])["header"]), PKCE: pkce != nil && !flag(pkce["disabled"]),
		SecretInBody: text(credentials["placement"]) != basicAuthHeader, SendIDToken: text(token["source"]) == idTokenSource,
	})
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
		request.body, request.bodyType = jsonList(openRows(data)), bodyForm
	case "multipart-form":
		rows := openMultipart(data)
		request.body, request.bodyType, request.needsFiles = jsonList(rows), bodyMultipart, anyFile(rows)
	case "graphql":
		graphql := object(data)
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = text(graphql["query"]), graphqlVariables(graphql["variables"])
	case "file":
		request.bodyType, request.needsFiles = bodyBinary, true
	}
	if query := text(body["query"]); query != "" {
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = query, graphqlVariables(body["variables"])
	}
}

func openMultipart(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		candidate := row{Key: text(entry["name"]), Enabled: !flag(entry["disabled"]), Type: rowTypeText, ContentType: text(entry["contentType"])}
		if text(entry["type"]) == rowTypeFile {
			files := texts(entry["value"])
			if len(files) == 0 {
				files = []string{text(entry["value"])}
			}
			candidate.Type, candidate.FileName = rowTypeFile, baseName(files[0])
		} else {
			candidate.Value = text(entry["value"])
		}
		rows = append(rows, candidate)
	}
	return keyedRows(rows)
}

func openAssertChecks(value any) []brunoCheck {
	var checks []brunoCheck
	for _, entry := range objects(value) {
		written := strings.TrimSpace(text(entry["operator"]) + " " + text(entry["value"]))
		checks = append(checks, readBrunoCheck(text(entry["expression"]), written, !flag(entry["disabled"])))
	}
	return checks
}

func openEnvironment(environment map[string]any, name string) environmentDraft {
	draft := environmentDraft{name: name, color: text(environment["color"]), extends: text(environment["extends"])}
	if parents := texts(environment["extends"]); len(parents) > 0 {
		draft.extends = parents[0]
	}
	for _, entry := range objects(environment["variables"]) {
		draft.variables = append(draft.variables, envVariable{
			name:    text(entry["name"]),
			value:   openValue(entry["value"]),
			enabled: !flag(entry["disabled"]) && entry["enabled"] != false,
			secret:  flag(entry["secret"]),
		})
	}
	external := object(environment["externalSecrets"])
	provider := text(external["type"])
	for _, entry := range objects(external["variables"]) {
		reference := firstText(entry, "path", "secretName", "vaultName", "projectId")
		draft.variables = append(draft.variables, envVariable{
			name:    text(entry["name"]),
			enabled: !flag(entry["disabled"]),
			ref:     &secretRef{Provider: provider, Path: reference},
		})
	}
	return draft
}

func firstText(entry map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := text(entry[key]); value != "" {
			return value
		}
	}
	return ""
}

func (c *collector) readBrunoEnvironments(doc document) {
	root := object(doc.data)
	entries := objects(root["environments"])
	if entries == nil {
		entries = []map[string]any{root}
	}
	name := fileStem(doc.file.Name)
	c.read(name, FormatBruno, func() {
		drafts := make([]environmentDraft, 0, len(entries))
		for _, entry := range entries {
			drafts = append(drafts, openEnvironment(entry, cleanName(text(entry["name"]), name)))
		}
		c.addDraftEnvironments(drafts)
	})
}
