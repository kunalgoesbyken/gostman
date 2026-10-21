package importer

import (
	"fmt"
	"sort"
	"strings"

	"github.com/krockxz/gostman/engine"
)

const (
	insomniaRequest      = "request"
	insomniaGroup        = "request_group"
	insomniaWorkspace    = "workspace"
	insomniaEnvironment  = "environment"
	maxEnvironmentDepth  = 8
	maxInsomniaNodes     = 20000
	templateTagOpen      = "{%"
	insomniaVariableRoot = "_."
	baseEnvironmentName  = "Base Environment"
)

type insomniaNode struct {
	fields   map[string]any
	children []*insomniaNode
	isFolder bool
	sortKey  float64
}

type insomniaSpace struct {
	name  string
	nodes []*insomniaNode
	base  map[string]any
	subs  []map[string]any
}

func (c *collector) readInsomnia(doc document) {
	root := object(doc.data)
	for _, space := range c.insomniaSpaces(root) {
		name := cleanName(space.name, strings.TrimSuffix(doc.file.Name, ".json"))
		c.read(name, FormatInsomnia, func() { c.importInsomnia(name, space) })
	}
}

func (c *collector) insomniaSpaces(root map[string]any) []insomniaSpace {
	if strings.HasPrefix(text(root["type"]), insomniaV5Prefix) {
		return []insomniaSpace{insomniaV5(root)}
	}
	return c.insomniaV4(root)
}

func (c *collector) insomniaV4(root map[string]any) []insomniaSpace {
	resources := objects(root["resources"])
	children := map[string][]*insomniaNode{}
	var workspaces []map[string]any
	skipped := map[string]int{}
	seenIDs := map[string]bool{}
	duplicates := 0
	for _, resource := range resources {
		kind := text(resource["_type"])
		switch kind {
		case insomniaRequest, insomniaGroup:
			id, parent := text(resource["_id"]), text(resource["parentId"])
			if id == "" || id == parent || seenIDs[id] {
				duplicates++
				continue
			}
			seenIDs[id] = true
			children[parent] = append(children[parent], &insomniaNode{fields: resource, isFolder: kind == insomniaGroup, sortKey: sortKeyOf(resource["metaSortKey"])})
		case insomniaWorkspace:
			workspaces = append(workspaces, resource)
		case insomniaEnvironment, "cookie_jar", "api_spec", "unit_test", "unit_test_suite", "proto_file", "proto_directory":
		default:
			skipped[kind]++
		}
	}
	for _, node := range allNodes(children) {
		node.children = children[text(node.fields["_id"])]
	}
	c.reportSkippedKinds(skipped)
	c.noteSkipped(duplicates, "items with a repeated or self-referencing id")
	var spaces []insomniaSpace
	for _, workspace := range workspaces {
		id := text(workspace["_id"])
		space := insomniaSpace{name: text(workspace["name"]), nodes: children[id]}
		space.base, space.subs = insomniaEnvironments(resources, id)
		spaces = append(spaces, space)
	}
	return spaces
}

func allNodes(children map[string][]*insomniaNode) []*insomniaNode {
	var nodes []*insomniaNode
	for _, group := range children {
		nodes = append(nodes, group...)
	}
	return nodes
}

func (c *collector) reportSkippedKinds(skipped map[string]int) {
	kinds := make([]string, 0, len(skipped))
	for kind := range skipped {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)
	for _, kind := range kinds {
		c.skip("%d %s items are not supported", skipped[kind], kind)
	}
}

func insomniaEnvironments(resources []map[string]any, workspaceID string) (map[string]any, []map[string]any) {
	var base map[string]any
	for _, resource := range resources {
		if text(resource["_type"]) == insomniaEnvironment && text(resource["parentId"]) == workspaceID {
			base = resource
			break
		}
	}
	if base == nil {
		return nil, nil
	}
	var subs []map[string]any
	for _, resource := range resources {
		if text(resource["_type"]) == insomniaEnvironment && text(resource["parentId"]) == text(base["_id"]) {
			subs = append(subs, resource)
		}
	}
	return base, subs
}

func insomniaV5(root map[string]any) insomniaSpace {
	budget := maxInsomniaNodes
	space := insomniaSpace{name: text(root["name"]), nodes: v5Nodes(list(root["collection"]), 0, &budget)}
	if environments := object(root["environments"]); environments != nil {
		space.base = environments
		space.subs = objects(environments["subEnvironments"])
	}
	return space
}

func v5Nodes(items []any, depth int, budget *int) []*insomniaNode {
	if depth > maxFolderDepth {
		return nil
	}
	var nodes []*insomniaNode
	for _, entry := range items {
		fields := object(entry)
		if fields == nil {
			continue
		}
		if *budget <= 0 {
			break
		}
		*budget--
		node := &insomniaNode{fields: fields, sortKey: sortKeyOf(object(fields["meta"])["sortKey"])}
		if fields["children"] != nil {
			node.isFolder = true
			node.children = v5Nodes(list(fields["children"]), depth+1, budget)
		}
		nodes = append(nodes, node)
	}
	return nodes
}

func sortKeyOf(value any) float64 {
	var key float64
	fmt.Sscan(text(value), &key)
	return key
}

func (c *collector) importInsomnia(name string, space insomniaSpace) {
	rootID := c.addFolder(name, "")
	c.insomniaNodes(space.nodes, rootID, scope{}, 0)
	c.insomniaEnvironments(space)
}

func (c *collector) insomniaNodes(nodes []*insomniaNode, folderID string, inherited scope, depth int) {
	if depth >= maxFolderDepth {
		c.Warnings = appendUnique(c.Warnings, fmt.Sprintf(messageDepth, maxFolderDepth))
		return
	}
	sort.SliceStable(nodes, func(i, j int) bool { return nodes[i].sortKey < nodes[j].sortKey })
	for _, node := range nodes {
		if c.visitedNodes[node] {
			continue
		}
		if len(c.visitedNodes) >= maxInsomniaNodes {
			c.Warnings = appendUnique(c.Warnings, fmt.Sprintf(messageTooManyItems, maxInsomniaNodes))
			return
		}
		c.visitedNodes[node] = true
		if node.isFolder {
			id := c.addFolder(text(node.fields["name"]), folderID)
			c.insomniaNodes(node.children, id, inherited.within(c.insomniaScope(node.fields)), depth+1)
			continue
		}
		c.insomniaRequest(node.fields, folderID, inherited)
	}
}

func (c *collector) insomniaScope(fields map[string]any) scope {
	var inherited scope
	inherited.headers, _ = insomniaRows(fields["headers"])
	for key, value := range flattenEnvironment(object(fields["environment"])) {
		inherited.vars = append(inherited.vars, row{Key: key, Value: value, Enabled: true})
	}
	sort.Slice(inherited.vars, func(i, j int) bool { return inherited.vars[i].Key < inherited.vars[j].Key })
	if auth := object(fields["authentication"]); auth != nil && text(auth["type"]) != "" {
		converted, _ := c.insomniaAuth(auth)
		inherited.auth = &converted
	}
	pre, post := insomniaScripts(fields)
	inherited.pre, inherited.post = nonEmpty(pre), nonEmpty(post)
	return inherited
}

func insomniaScripts(fields map[string]any) (string, string) {
	scripts := object(fields["scripts"])
	pre := text(fields["preRequestScript"]) + text(scripts["preRequest"])
	post := text(fields["afterResponseScript"]) + text(scripts["afterResponse"])
	return pre, post
}

func insomniaRows(value any) ([]row, bool) {
	var rows []row
	tags := false
	for _, entry := range objects(value) {
		key, keyTags := convertTemplate(text(entry["name"]))
		content, valueTags := convertTemplate(text(entry["value"]))
		tags = tags || keyTags || valueTags
		rows = append(rows, row{Key: key, Value: content, Enabled: !flag(entry["disabled"])})
	}
	return keyedRows(rows), tags
}

func convertTemplate(source string) (string, bool) {
	tags := strings.Contains(source, templateTagOpen)
	converted := mapVariables(source, func(inner string) string {
		name := strings.TrimSpace(inner)
		if reference, isVariable := strings.CutPrefix(name, insomniaVariableRoot); isVariable {
			return variableOpen + reference + variableClose
		}
		return variableOpen + inner + variableClose
	})
	return converted, tags
}

func mapVariables(source string, transform func(inner string) string) string {
	var out strings.Builder
	for {
		start := strings.Index(source, variableOpen)
		if start < 0 {
			break
		}
		end := strings.Index(source[start+len(variableOpen):], variableClose)
		if end < 0 {
			break
		}
		end += start + len(variableOpen)
		out.WriteString(source[:start])
		out.WriteString(transform(source[start+len(variableOpen) : end]))
		source = source[end+len(variableClose):]
	}
	out.WriteString(source)
	return out.String()
}

func (c *collector) insomniaRequest(fields map[string]any, folderID string, inherited scope) {
	name := text(fields["name"])
	if fields["protoFileId"] != nil || fields["protoMethodName"] != nil {
		c.skip("%s: gRPC requests are not imported from Insomnia", cleanName(name, untitledRequest))
		return
	}
	headers, headerTags := insomniaRows(fields["headers"])
	params, paramTags := insomniaRows(fields["parameters"])
	address, urlTags := convertTemplate(text(fields["url"]))
	request := parts{
		name:        name,
		method:      text(fields["method"]),
		url:         address,
		description: text(fields["description"]),
		headers:     headers,
		params:      params,
		options:     insomniaOptions(fields),
	}
	request.preScript, request.postScript = insomniaScripts(fields)
	tags := headerTags || paramTags || urlTags || c.insomniaBody(object(fields["body"]), &request)
	if auth := object(fields["authentication"]); auth != nil {
		converted, ok := c.insomniaAuth(auth)
		request.auth = &converted
		if !ok {
			c.flag(messageAuthDropped, cleanName(name, untitledRequest))
		}
	}
	if tags {
		c.flag(messageTemplateTags, cleanName(name, untitledRequest))
	}
	c.build(request, inherited, folderID)
}

func insomniaOptions(fields map[string]any) engine.Options {
	following := text(fields["settingFollowRedirects"])
	if settings := object(fields["settings"]); settings != nil {
		following = text(settings["followRedirects"])
	}
	return engine.Options{NoFollowRedirects: following == "off"}
}

func (c *collector) insomniaBody(body map[string]any, request *parts) bool {
	if body == nil {
		return false
	}
	content, tags := convertTemplate(text(body["text"]))
	mime := text(body["mimeType"])
	switch {
	case mime == "application/graphql":
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = splitGraphQL(content)
	case mime == "application/x-www-form-urlencoded":
		rows, formTags := insomniaRows(body["params"])
		request.body, request.bodyType, tags = rowsJSON(rows), bodyForm, formTags
	case mime == "multipart/form-data":
		rows, formTags := insomniaMultipart(body["params"])
		request.body, request.bodyType, tags = rowsJSON(rows), bodyMultipart, formTags
		request.needsFiles = anyFile(rows)
	case mime == "application/octet-stream":
		request.bodyType, request.needsFiles = bodyBinary, true
	case content != "":
		request.body, request.bodyType = content, bodyTypeOfMime(mime)
	}
	return tags
}

func insomniaMultipart(value any) ([]row, bool) {
	var rows []row
	tags := false
	for _, entry := range objects(value) {
		key, keyTags := convertTemplate(text(entry["name"]))
		content, valueTags := convertTemplate(text(entry["value"]))
		tags = tags || keyTags || valueTags
		candidate := row{Key: key, Value: content, Enabled: !flag(entry["disabled"]), Type: rowTypeText}
		if text(entry["type"]) == rowTypeFile {
			candidate = row{Key: key, Enabled: candidate.Enabled, Type: rowTypeFile, FileName: baseName(text(entry["fileName"]))}
		}
		rows = append(rows, candidate)
	}
	return keyedRows(rows), tags
}

func splitGraphQL(content string) (string, string) {
	payload, err := decodeStructured(content)
	fields := object(payload)
	if err != nil || fields == nil {
		return content, ""
	}
	return text(fields["query"]), graphqlVariables(fields["variables"])
}

func (c *collector) insomniaAuth(auth map[string]any) (engine.Auth, bool) {
	kind := text(auth["type"])
	if kind == "" || kind == "none" || flag(auth["disabled"]) {
		return engine.Auth{}, true
	}
	value := func(key string) string {
		converted, _ := convertTemplate(text(auth[key]))
		return converted
	}
	switch kind {
	case authBasic, authDigest:
		return credentialsAuth(kind, value("username"), value("password")), true
	case authBearer:
		return bearerAuth(value("token")), true
	case authNTLM:
		return ntlmAuth(value("username"), value("password"), value("domain")), true
	case authAPIKey:
		return apiKeyAuth(value("key"), value("value"), value("addTo") == "queryParams"), true
	case "iam":
		return awsAuth(value("accessKeyId"), value("secretAccessKey"), value("sessionToken"), value("region"), value("service")), true
	case authOAuth1:
		return insomniaOAuth1(value), true
	case authOAuth2:
		return oauth2Auth(oauth2Fields{
			Grant: value("grantType"), AuthURL: value("authorizationUrl"), TokenURL: value("accessTokenUrl"),
			ClientID: value("clientId"), ClientSecret: value("clientSecret"), Scope: value("scope"),
			Username: value("username"), Password: value("password"), CallbackURL: value("redirectUrl"),
			PKCE: flag(auth["usePkce"]), SecretInBody: flag(auth["credentialsInBody"]),
		})
	}
	return engine.Auth{}, false
}

func insomniaOAuth1(value func(string) string) engine.Auth {
	return engine.Auth{Type: authOAuth1, OAuth1: engine.OAuth1Auth{
		ConsumerKey: value("consumerKey"), ConsumerSecret: value("consumerSecret"), Token: value("tokenKey"),
		TokenSecret: value("tokenSecret"), SignatureMethod: value("signatureMethod"), PrivateKey: value("privateKey"),
		Realm: value("realm"), Callback: value("callback"), Verifier: value("verifier"), Nonce: value("nonce"), Timestamp: value("timestamp"),
	}}
}

func (c *collector) insomniaEnvironments(space insomniaSpace) {
	if space.base == nil {
		return
	}
	base := flattenEnvironment(object(space.base["data"]))
	if len(base) > 0 {
		c.addEnvironment(cleanName(text(space.base["name"]), baseEnvironmentName), base)
	}
	for _, sub := range space.subs {
		merged := map[string]string{}
		for key, value := range base {
			merged[key] = value
		}
		for key, value := range flattenEnvironment(object(sub["data"])) {
			merged[key] = value
		}
		c.addEnvironment(text(sub["name"]), merged)
	}
}

func flattenEnvironment(data map[string]any) map[string]string {
	flat := map[string]string{}
	var walk func(prefix string, value map[string]any, depth int)
	walk = func(prefix string, value map[string]any, depth int) {
		for key, item := range value {
			name := prefix + key
			if nested := object(item); nested != nil && depth < maxEnvironmentDepth {
				walk(name+".", nested, depth+1)
				continue
			}
			converted, _ := convertTemplate(text(item))
			flat[name] = converted
		}
	}
	walk("", data, 0)
	return flat
}
