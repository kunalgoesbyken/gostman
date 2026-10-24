package importer

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/openapi"
	"gopkg.in/yaml.v3"
)

const (
	insomniaRequest         = "request"
	insomniaGroup           = "request_group"
	insomniaGrpc            = "grpc_request"
	insomniaSocket          = "websocket_request"
	insomniaSocketPayload   = "websocket_payload"
	insomniaSocketIO        = "socketio_request"
	insomniaSocketIOPayload = "socketio_payload"
	insomniaMcp             = "mcp_request"
	insomniaWorkspace       = "workspace"
	insomniaEnvironment     = "environment"
	insomniaProtoFile       = "proto_file"
	insomniaProtoDirectory  = "proto_directory"
	insomniaSuite           = "unit_test_suite"
	insomniaTest            = "unit_test"
	insomniaSpec            = "api_spec"
	insomniaCookieJar       = "cookie_jar"
	insomniaMock            = "mock"
	insomniaMockRoute       = "mock_route"
	insomniaEnvironmentKind = "environment.insomnia.rest/5"
	insomniaVault           = "__insomnia_vault"
	insomniaVaultRoot       = "vault."
	insomniaStdio           = "stdio"
	insomniaSecretType      = "secret"
	insomniaJSONType        = "json"
	socketIOProtocol        = "socketio"
	socketIOPath            = "/socket.io"
	methodMCP               = "MCP"
	mockBaseVariable        = "{{mockUrl}}"
	maxEnvironmentDepth     = 8
	maxInsomniaNodes        = 20000
	templateTagOpen         = "{%"
	insomniaVariableRoot    = "_."
	baseEnvironmentName     = "Base Environment"
	mcpCommandPrefix        = "stdio:"
)

var (
	insomniaV5Types = []string{
		"collection.insomnia.rest/5", "spec.insomnia.rest/5", insomniaEnvironmentKind, "mock.insomnia.rest/5", "mcpClient.insomnia/5",
	}
	insomniaRequestKinds = setOf(insomniaRequest, insomniaGrpc, insomniaSocket, insomniaSocketIO, insomniaMcp)
	insomniaKnownKinds   = setOf(insomniaRequest, insomniaGroup, insomniaGrpc, insomniaSocket, insomniaSocketPayload, insomniaSocketIO,
		insomniaSocketIOPayload, insomniaMcp, insomniaWorkspace, insomniaEnvironment, insomniaProtoFile, insomniaProtoDirectory,
		insomniaSuite, insomniaTest, insomniaSpec, insomniaCookieJar, insomniaMock, insomniaMockRoute)
	socketURLSchemes = map[string]string{"http://": "ws://", "https://": "wss://"}
)

type insomniaNode struct {
	fields   map[string]any
	kind     string
	children []*insomniaNode
	payloads []map[string]any
	sortKey  float64
}

type insomniaUnitTest struct {
	suite     string
	name      string
	requestID string
	code      string
}

type insomniaMockServer struct {
	name   string
	url    string
	routes []map[string]any
}

type insomniaSpace struct {
	name         string
	description  string
	global       bool
	nodes        []*insomniaNode
	base         map[string]any
	subs         []map[string]any
	protos       map[string][]protoFile
	tests        []insomniaUnitTest
	spec         string
	specFile     string
	mocks        []insomniaMockServer
	cookies      int
	certificates int
}

func isInsomniaV5(kind string) bool {
	for _, prefix := range insomniaV5Types {
		if strings.HasPrefix(kind, prefix) {
			return true
		}
	}
	return false
}

func (c *collector) readInsomnia(ctx context.Context, doc document, config Config) {
	root := object(doc.data)
	for _, space := range c.insomniaSpaces(root, doc.file.Text) {
		name := cleanName(space.name, fileStem(doc.file.Name))
		c.read(name, FormatInsomnia, func() { c.importInsomnia(ctx, config, name, space) })
	}
}

func (c *collector) insomniaSpaces(root map[string]any, source string) []insomniaSpace {
	if isInsomniaV5(text(root["type"])) {
		return []insomniaSpace{insomniaV5(root, source)}
	}
	return c.insomniaV4(root)
}

func (c *collector) insomniaV4(root map[string]any) []insomniaSpace {
	resources := objects(root["resources"])
	byID := map[string]map[string]any{}
	byParent := map[string][]map[string]any{}
	skipped := map[string]int{}
	duplicates := 0
	for _, resource := range resources {
		kind, id, parent := text(resource["_type"]), text(resource["_id"]), text(resource["parentId"])
		switch {
		case !insomniaKnownKinds[kind]:
			skipped[kind]++
		case id == "" || id == parent || byID[id] != nil:
			duplicates++
		default:
			byID[id] = resource
			byParent[parent] = append(byParent[parent], resource)
		}
	}
	c.reportSkippedKinds(skipped)
	c.noteSkipped(duplicates, "items with a repeated or self-referencing id")
	protos := v4Protos(byID, byParent)
	var spaces []insomniaSpace
	for _, workspace := range byParent[""] {
		if text(workspace["_type"]) != insomniaWorkspace {
			continue
		}
		id := text(workspace["_id"])
		budget := maxInsomniaNodes
		space := insomniaSpace{
			name:        text(workspace["name"]),
			description: text(workspace["description"]),
			global:      text(workspace["scope"]) == insomniaEnvironment,
			nodes:       v4Nodes(byParent, id, 0, &budget),
			protos:      protos,
		}
		space.base, space.subs = insomniaEnvironments(resources, id)
		for _, child := range byParent[id] {
			space.addV4Child(child, byParent)
		}
		spaces = append(spaces, space)
	}
	return spaces
}

func (space *insomniaSpace) addV4Child(child map[string]any, byParent map[string][]map[string]any) {
	id := text(child["_id"])
	switch text(child["_type"]) {
	case insomniaSuite:
		for _, test := range byParent[id] {
			space.tests = append(space.tests, insomniaUnitTest{suite: text(child["name"]), name: text(test["name"]), requestID: text(test["requestId"]), code: text(test["code"])})
		}
	case insomniaSpec:
		space.spec = text(child["contents"])
	case insomniaMock:
		space.mocks = append(space.mocks, insomniaMockServer{name: text(child["name"]), url: text(child["url"]), routes: byParent[id]})
	case insomniaCookieJar:
		space.cookies += len(list(child["cookies"]))
	}
}

func (c *collector) reportSkippedKinds(skipped map[string]int) {
	for _, kind := range sortedKeys(skipped) {
		c.skip("%d %s items are not supported", skipped[kind], kind)
	}
}

func v4Nodes(byParent map[string][]map[string]any, parentID string, depth int, budget *int) []*insomniaNode {
	if depth > maxFolderDepth {
		return nil
	}
	var nodes []*insomniaNode
	for _, resource := range byParent[parentID] {
		kind := text(resource["_type"])
		if kind != insomniaGroup && !insomniaRequestKinds[kind] {
			continue
		}
		if *budget <= 0 {
			break
		}
		*budget--
		id := text(resource["_id"])
		node := &insomniaNode{fields: resource, kind: kind, sortKey: sortKeyOf(resource["metaSortKey"])}
		if kind == insomniaGroup {
			node.children = v4Nodes(byParent, id, depth+1, budget)
		}
		for _, payload := range byParent[id] {
			if payloadKind := text(payload["_type"]); payloadKind == insomniaSocketPayload || payloadKind == insomniaSocketIOPayload {
				node.payloads = append(node.payloads, payload)
			}
		}
		nodes = append(nodes, node)
	}
	return nodes
}

func v4Protos(byID map[string]map[string]any, byParent map[string][]map[string]any) map[string][]protoFile {
	sets := map[string][]protoFile{}
	for id, resource := range byID {
		if text(resource["_type"]) != insomniaProtoFile {
			continue
		}
		top := ""
		for current, depth := resource, 0; depth < maxFolderDepth; depth++ {
			parent := byID[text(current["parentId"])]
			if parent == nil || text(parent["_type"]) != insomniaProtoDirectory {
				break
			}
			top, current = text(parent["_id"]), parent
		}
		if top == "" {
			sets[id] = []protoFile{{Name: text(resource["name"]), Content: text(resource["protoText"])}}
			continue
		}
		sets[id] = protoTree(byParent, top, "", 0)
	}
	return sets
}

func protoTree(byParent map[string][]map[string]any, directoryID, prefix string, depth int) []protoFile {
	if depth > maxFolderDepth {
		return nil
	}
	var files []protoFile
	for _, child := range byParent[directoryID] {
		switch text(child["_type"]) {
		case insomniaProtoDirectory:
			files = append(files, protoTree(byParent, text(child["_id"]), prefix+text(child["name"])+"/", depth+1)...)
		case insomniaProtoFile:
			files = append(files, protoFile{Name: prefix + text(child["name"]), Content: text(child["protoText"])})
		}
	}
	return files
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

func insomniaV5(root map[string]any, source string) insomniaSpace {
	budget := maxInsomniaNodes
	space := insomniaSpace{
		name:         text(root["name"]),
		description:  text(object(root["meta"])["description"]),
		global:       strings.HasPrefix(text(root["type"]), insomniaEnvironmentKind),
		nodes:        v5Nodes(list(root["collection"]), 0, &budget),
		certificates: len(list(root["certificates"])),
		cookies:      len(list(object(root["cookieJar"])["cookies"])),
	}
	if environments := object(root["environments"]); environments != nil {
		space.base = environments
		space.subs = objects(environments["subEnvironments"])
	}
	for _, suite := range objects(root["testSuites"]) {
		for _, test := range objects(suite["tests"]) {
			space.tests = append(space.tests, insomniaUnitTest{suite: text(suite["name"]), name: text(test["name"]), requestID: text(test["requestId"]), code: text(test["code"])})
		}
	}
	space.spec, space.specFile = v5Spec(object(root["spec"]), source)
	if routes := objects(root["routes"]); routes != nil {
		server := object(root["server"])
		space.mocks = []insomniaMockServer{{name: text(root["name"]), url: text(server["url"]), routes: routes}}
	}
	if client := object(root["mcpRequest"]); client != nil {
		space.nodes = append(space.nodes, &insomniaNode{fields: client, kind: insomniaMcp})
	}
	return space
}

func v5Spec(spec map[string]any, source string) (string, string) {
	contents := object(spec["contents"])
	if len(contents) == 0 {
		return text(spec["contents"]), text(spec["file"])
	}
	var ordered any = contents
	if node := mappingChild(mappingChild(documentRoot(source), "spec"), "contents"); node != nil {
		ordered = node
	}
	encoded, err := yaml.Marshal(ordered)
	if err != nil {
		return "", text(spec["file"])
	}
	return string(encoded), ""
}

func documentRoot(source string) *yaml.Node {
	var document yaml.Node
	if yaml.Unmarshal([]byte(source), &document) != nil || len(document.Content) == 0 {
		return nil
	}
	return document.Content[0]
}

func mappingChild(node *yaml.Node, key string) *yaml.Node {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	for index := 0; index+1 < len(node.Content); index += 2 {
		if node.Content[index].Value == key {
			return node.Content[index+1]
		}
	}
	return nil
}

func v5Nodes(items []any, depth int, budget *int) []*insomniaNode {
	if depth > maxFolderDepth {
		return nil
	}
	var nodes []*insomniaNode
	for _, entry := range objects(items) {
		if *budget <= 0 {
			break
		}
		*budget--
		node := &insomniaNode{fields: entry, kind: v5Kind(entry), sortKey: sortKeyOf(object(entry["meta"])["sortKey"])}
		switch node.kind {
		case insomniaGroup:
			node.children = v5Nodes(list(entry["children"]), depth+1, budget)
		case insomniaSocket, insomniaSocketIO:
			if body := object(entry["body"]); body != nil {
				node.payloads = []map[string]any{body}
			}
		}
		nodes = append(nodes, node)
	}
	return nodes
}

func v5Kind(fields map[string]any) string {
	id := text(object(fields["meta"])["id"])
	body := object(fields["body"])
	switch {
	case fields["method"] != nil:
		return insomniaRequest
	case fields["reflectionApi"] != nil || strings.HasPrefix(id, "greq"):
		return insomniaGrpc
	case fields["url"] == nil:
		return insomniaGroup
	case strings.HasPrefix(id, "socketio-req"), fields["eventListeners"] != nil, object(fields["settings"])["path"] != nil,
		body != nil && (body["eventName"] != nil || body["args"] != nil || body["ack"] != nil):
		return insomniaSocketIO
	}
	return insomniaSocket
}

func sortKeyOf(value any) float64 {
	var key float64
	fmt.Sscan(text(value), &key)
	return key
}

type insomniaImport struct {
	c         *collector
	space     insomniaSpace
	templates *insomniaTemplates
	ids       map[string]string
	targets   map[string]string
	names     map[string]string
	built     map[string]int
}

func (c *collector) importInsomnia(ctx context.Context, config Config, name string, space insomniaSpace) {
	names := map[string]string{}
	var paths []requestPath
	collectInsomniaNames(space.nodes, names, &paths, 0)
	ids, targets := requestTargets(paths)
	session := &insomniaImport{c: c, space: space, templates: newInsomniaTemplates(names), ids: ids, targets: targets, names: names, built: map[string]int{}}
	switch {
	case len(space.nodes) > 0 || len(space.mocks) > 0:
		rootID := c.addScopedFolder(name, "", scope{description: session.specDescription(space.description)})
		session.nodes(space.nodes, rootID, 0)
		session.mocks(name, rootID)
	case space.spec != "":
		session.generate(ctx, config)
	}
	session.unitTests()
	session.attachLinks()
	session.environments()
	session.report(name)
	c.summarizeScripts(insomniaDialect, name)
}

func collectInsomniaNames(nodes []*insomniaNode, names map[string]string, paths *[]requestPath, depth int) {
	if depth > maxFolderDepth {
		return
	}
	for _, node := range nodes {
		if node.kind == insomniaGroup {
			collectInsomniaNames(node.children, names, paths, depth+1)
			continue
		}
		id := insomniaID(node.fields)
		names[id] = cleanName(text(node.fields["name"]), untitledRequest)
		*paths = append(*paths, requestPath{path: id, name: names[id]})
	}
}

func insomniaID(fields map[string]any) string {
	if id := text(fields["_id"]); id != "" {
		return id
	}
	return text(object(fields["meta"])["id"])
}

func (s *insomniaImport) specDescription(description string) string {
	if s.space.spec == "" {
		return description
	}
	s.c.Warnings = append(s.c.Warnings, fmt.Sprintf(messageInsomniaSpec, s.space.name))
	return joinScripts([]string{description, "```yaml\n" + strings.TrimRight(s.space.spec, "\n") + "\n```"})
}

func (s *insomniaImport) generate(ctx context.Context, config Config) {
	loaded, err := openapi.Load(ctx, openapi.Source{Text: s.space.spec}, config.OpenAPI)
	if err != nil {
		s.c.skip("%s: %v", s.space.name, err)
		return
	}
	s.c.addGenerated(loaded.Generate(openapi.Selection{}))
}

func (s *insomniaImport) nodes(nodes []*insomniaNode, folderID string, depth int) {
	c := s.c
	if depth >= maxFolderDepth {
		c.warnDepth()
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
		if node.kind == insomniaGroup {
			name := text(node.fields["name"])
			id := c.addScopedFolder(name, folderID, s.folderScope(node.fields, cleanName(name, untitledFolder)))
			s.nodes(node.children, id, depth+1)
			continue
		}
		s.request(node, folderID)
	}
}

func (s *insomniaImport) folderScope(fields map[string]any, name string) scope {
	s.templates.owner = name
	inherited := scope{description: insomniaDescription(fields)}
	inherited.headers = s.rows(fields["headers"])
	for _, variable := range s.flatten(object(fields["environment"])) {
		inherited.vars = append(inherited.vars, row{Key: variable.name, Value: variable.value, Enabled: true})
	}
	inherited.auth = s.auth(object(fields["authentication"]), name)
	inherited.pre, inherited.post = s.scripts(fields, fmt.Sprintf(labelFolder, name))
	return inherited
}

func insomniaDescription(fields map[string]any) string {
	if value := text(fields["description"]); value != "" {
		return value
	}
	return text(object(fields["meta"])["description"])
}

func (s *insomniaImport) scripts(fields map[string]any, label string) (string, string) {
	scripts := object(fields["scripts"])
	pre := text(fields["preRequestScript"]) + text(scripts["preRequest"])
	post := text(fields["afterResponseScript"]) + text(scripts["afterResponse"])
	return s.c.translateScript(insomniaDialect, label, stagePre, pre), s.c.translateScript(insomniaDialect, label, stageAfter, post)
}

func (s *insomniaImport) rows(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		rows = append(rows, row{Key: s.templates.convert(text(entry["name"])), Value: s.templates.convert(text(entry["value"])), Enabled: !flag(entry["disabled"])})
	}
	return keyedRows(rows)
}

func (s *insomniaImport) request(node *insomniaNode, folderID string) {
	fields := node.fields
	id := insomniaID(fields)
	name := s.names[id]
	s.templates.owner = name
	s.templates.takePrompts()
	request := parts{id: s.ids[id], name: name, description: insomniaDescription(fields), headers: s.rows(fields["headers"])}
	request.preScript, request.postScript = s.scripts(fields, fmt.Sprintf(labelRequest, name))
	request.auth = s.auth(object(fields["authentication"]), name)
	switch node.kind {
	case insomniaRequest:
		s.httpRequest(fields, &request)
	case insomniaGrpc:
		s.grpcRequest(fields, &request)
	case insomniaSocket:
		s.socketRequest(fields, node.payloads, &request)
	case insomniaSocketIO:
		s.socketIORequest(fields, node.payloads, &request)
	case insomniaMcp:
		s.mcpRequest(fields, &request)
	}
	for _, prompt := range s.templates.takePrompts() {
		request.vars = withRow(request.vars, prompt)
	}
	before := len(s.c.Requests)
	s.c.build(request, folderID)
	if len(s.c.Requests) > before {
		s.built[id] = before
	}
}

func (s *insomniaImport) address(fields map[string]any, request *parts) {
	params := s.rows(fields["parameters"])
	address, vars := pathParamVariables(s.templates.convert(text(fields["url"])), s.rows(fields["pathParameters"]))
	request.url, request.params, request.vars = address, params, vars
}

func (s *insomniaImport) httpRequest(fields map[string]any, request *parts) {
	request.method = text(fields["method"])
	s.address(fields, request)
	request.options = insomniaOptions(fields)
	s.body(object(fields["body"]), request)
}

func insomniaOptions(fields map[string]any) engine.Options {
	following := text(fields["settingFollowRedirects"])
	sending, storing := fields["settingSendCookies"], fields["settingStoreCookies"]
	if settings := object(fields["settings"]); settings != nil {
		cookies := object(settings["cookies"])
		following, sending, storing = text(settings["followRedirects"]), cookies["send"], cookies["store"]
	}
	return engine.Options{NoFollowRedirects: following == "off", SkipCookies: sending == false, DiscardCookies: storing == false}
}

func (s *insomniaImport) body(body map[string]any, request *parts) {
	if body == nil {
		return
	}
	content := s.templates.convert(text(body["text"]))
	mime := text(body["mimeType"])
	switch {
	case mime == "application/graphql":
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = splitGraphQL(content)
	case mime == "application/x-www-form-urlencoded":
		request.body, request.bodyType = jsonList(s.rows(body["params"])), bodyForm
	case mime == "multipart/form-data":
		rows := s.multipart(body["params"])
		request.body, request.bodyType, request.needsFiles = jsonList(rows), bodyMultipart, anyFile(rows)
	case mime == "application/octet-stream":
		request.bodyType, request.needsFiles = bodyBinary, true
	case content != "":
		request.body, request.bodyType = content, bodyTypeOfMime(mime)
	}
}

func (s *insomniaImport) multipart(value any) []row {
	var rows []row
	for _, entry := range objects(value) {
		candidate := row{Key: s.templates.convert(text(entry["name"])), Enabled: !flag(entry["disabled"]), Type: rowTypeText}
		if text(entry["type"]) == rowTypeFile {
			candidate.Type, candidate.FileName = rowTypeFile, baseName(text(entry["fileName"]))
		} else {
			candidate.Value = s.templates.convert(text(entry["value"]))
		}
		rows = append(rows, candidate)
	}
	return keyedRows(rows)
}

func splitGraphQL(content string) (string, string) {
	payload, err := decodeStructured(content)
	fields := object(payload)
	if err != nil || fields == nil {
		return content, ""
	}
	return text(fields["query"]), graphqlVariables(fields["variables"])
}

func (s *insomniaImport) grpcRequest(fields map[string]any, request *parts) {
	s.c.grpcParts("", grpcCall{
		url:      s.templates.convert(text(fields["url"])),
		method:   text(fields["protoMethodName"]),
		messages: []string{s.templates.convert(text(object(fields["body"])["text"]))},
	}, request)
	request.headers = s.rows(fields["metadata"])
	if reflection := object(fields["reflectionApi"]); flag(reflection["enabled"]) {
		s.c.flag(messageBufReflection, request.name)
	}
	protoID := text(fields["protoFileId"])
	if protoID == "" {
		return
	}
	files, found := s.space.protos[protoID]
	if !found {
		s.c.flag(messageProtoMissing, request.name)
		return
	}
	request.grpcProtos = jsonList(files)
}

func (s *insomniaImport) socketRequest(fields map[string]any, payloads []map[string]any, request *parts) {
	s.address(fields, request)
	var messages []socketMessage
	for index, payload := range payloads {
		messages = append(messages, socketMessage{Name: cleanName(text(payload["name"]), fmt.Sprintf(untitledMessage, index+1)), Body: s.templates.convert(text(payload["value"]))})
	}
	socketParts(request.url, messages, request)
}

func (s *insomniaImport) socketIORequest(fields map[string]any, payloads []map[string]any, request *parts) {
	s.address(fields, request)
	for prefix, replacement := range socketURLSchemes {
		if rest, found := strings.CutPrefix(request.url, prefix); found {
			request.url = replacement + rest
		}
	}
	socketPath := text(fields["settingPath"])
	if settings := object(fields["settings"]); settings != nil {
		socketPath = text(settings["path"])
	}
	if socketPath != "" && strings.TrimSuffix(socketPath, "/") != socketIOPath {
		request.options.SocketIOPath = socketPath
	}
	var messages []socketMessage
	for index, payload := range payloads {
		event := text(payload["eventName"])
		arguments := objects(payload["args"])
		if len(arguments) > 1 {
			s.c.flag(messageSocketIOArguments, request.name)
		}
		body := ""
		if len(arguments) > 0 {
			body = s.templates.convert(text(arguments[0]["value"]))
		}
		messages = append(messages, socketMessage{Name: cleanName(text(payload["name"]), cleanName(event, fmt.Sprintf(untitledMessage, index+1))), Body: body, Target: event})
	}
	socketParts(request.url, messages, request)
	request.socketProtocol = socketIOProtocol
}

func (s *insomniaImport) mcpRequest(fields map[string]any, request *parts) {
	request.method = methodMCP
	request.url = s.templates.convert(text(fields["url"]))
	if text(fields["transportType"]) == insomniaStdio {
		request.url = mcpCommandPrefix + request.url
		request.headers = s.rows(fields["env"])
	}
}

func (s *insomniaImport) auth(auth map[string]any, name string) *engine.Auth {
	kind := text(auth["type"])
	if auth == nil || kind == "" {
		return nil
	}
	converted, supported := s.convertAuth(auth, kind, name)
	return s.c.checkedAuth(name, converted, supported)
}

func (s *insomniaImport) convertAuth(auth map[string]any, kind, name string) (engine.Auth, bool) {
	if kind == authNone || flag(auth["disabled"]) {
		return engine.Auth{}, true
	}
	value := func(key string) string { return s.templates.convert(text(auth[key])) }
	switch kind {
	case authBasic, authDigest:
		return credentialsAuth(kind, value("username"), value("password")), true
	case authBearer:
		if prefix := value("prefix"); prefix != "" && !strings.EqualFold(prefix, "Bearer") {
			return apiKeyAuth("Authorization", prefix+" "+value("token"), false), true
		}
		return bearerAuth(value("token")), true
	case authNTLM:
		return ntlmAuth(value("username"), value("password"), value("domain")), true
	case authAPIKey:
		return apiKeyAuth(value("key"), value("value"), value("addTo") == "queryParams"), true
	case "iam":
		return awsAuth(value("accessKeyId"), value("secretAccessKey"), value("sessionToken"), value("region"), value("service")), true
	case authOAuth1:
		return insomniaOAuth1(value), true
	case authHawk:
		return hawkAuth(engine.HawkAuth{ID: value("id"), Key: value("key"), Algorithm: value("algorithm"), Ext: value("ext")}, flag(auth["validatePayload"])), true
	case authASAP:
		return asapAuth(engine.ASAPAuth{
			Issuer: value("issuer"), Subject: value("subject"), Audience: value("audience"),
			KeyID: value("keyId"), PrivateKey: value("privateKey"), Claims: value("additionalClaims"),
		}), true
	case authOAuth2:
		if value("audience") != "" {
			s.c.flag(messageOAuthAudience, name)
		}
		return oauth2Auth(oauth2Fields{
			Grant: value("grantType"), AuthURL: value("authorizationUrl"), TokenURL: value("accessTokenUrl"),
			ClientID: value("clientId"), ClientSecret: value("clientSecret"), Scope: value("scope"),
			Username: value("username"), Password: value("password"), CallbackURL: value("redirectUrl"),
			HeaderPrefix: value("tokenPrefix"), Resource: value("resource"),
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

func (s *insomniaImport) mocks(rootName, rootID string) {
	for _, server := range s.space.mocks {
		folderID := rootID
		if len(s.space.nodes) > 0 || cleanName(server.name, untitledFolder) != rootName {
			folderID = s.c.addFolder(server.name, rootID)
		}
		base := strings.TrimRight(server.url, "/")
		if base == "" {
			base = mockBaseVariable
		}
		for _, route := range server.routes {
			name := cleanName(text(route["name"]), "/")
			request := parts{name: name, method: text(route["method"]), url: base + "/" + strings.TrimPrefix(name, "/")}
			request.examples = s.c.savedExamples(name, []exampleDraft{{
				name:        text(route["statusText"]),
				status:      text(route["statusCode"]),
				headers:     s.rows(route["headers"]),
				body:        text(route["body"]),
				contentType: text(route["mimeType"]),
			}})
			s.c.build(request, folderID)
		}
		s.c.Warnings = append(s.c.Warnings, fmt.Sprintf(messageInsomniaMock, server.name))
	}
}

func (s *insomniaImport) unitTests() {
	translation := unitTestDialect(s.targets)
	for _, test := range s.space.tests {
		index, built := s.built[test.requestID]
		if !built {
			s.c.skip(messageUnitTestTarget, test.suite, test.name)
			continue
		}
		request := &s.c.Requests[index]
		label := fmt.Sprintf(labelRequest, request.Name)
		code := s.c.translateScript(translation, label, stagePost, test.code)
		block := "test(" + strconv.Quote(test.suite+" / "+test.name) + ", async () => {\n" + indent(code) + "\n});"
		request.PostScript = joinScripts([]string{request.PostScript, block})
		s.c.flagUnique(messageScripts, request.Name)
	}
}

func (s *insomniaImport) attachLinks() {
	rules := map[int][]extractor{}
	for _, link := range s.templates.links {
		index, built := s.built[link.requestID]
		if !built {
			continue
		}
		rules[index] = withRule(rules[index], link.rule)
		s.c.flagUnique(messageResponseTags, s.c.Requests[index].Name)
	}
	for index, added := range rules {
		s.c.Requests[index].Extractors = jsonList(added)
	}
}

func (s *insomniaImport) environments() {
	space := s.space
	if space.base == nil {
		return
	}
	baseName := cleanName(text(space.base["name"]), baseEnvironmentName)
	if baseName == baseEnvironmentName {
		baseName = cleanName(space.name, baseEnvironmentName)
	}
	base := s.environmentVariables(space.base, baseName)
	var drafts []environmentDraft
	if len(base) > 0 {
		drafts = append(drafts, environmentDraft{name: baseName, color: text(space.base["color"]), global: space.global, variables: base})
	}
	for _, sub := range space.subs {
		name := cleanName(text(sub["name"]), untitledEnvironment)
		draft := environmentDraft{name: name, color: text(sub["color"]), global: space.global, variables: s.environmentVariables(sub, name)}
		if len(base) > 0 && name != baseName {
			draft.extends = baseName
		}
		drafts = append(drafts, draft)
	}
	s.c.addDraftEnvironments(drafts)
}

func (s *insomniaImport) environmentVariables(environment map[string]any, name string) []envVariable {
	variables := s.readEnvironmentVariables(environment, name)
	for _, variable := range variables {
		if strings.HasPrefix(variable.name, insomniaVaultRoot) && variable.value == "" {
			s.c.flag(messageInsomniaVault, name+"/"+variable.name)
		}
	}
	return variables
}

func (s *insomniaImport) readEnvironmentVariables(environment map[string]any, name string) []envVariable {
	s.templates.owner = name
	private := flag(environment["isPrivate"]) || flag(object(environment["meta"])["isPrivate"])
	confidential := setOf(texts(environment["confidentialKeys"])...)
	var variables []envVariable
	if pairs := objects(environment["kvPairData"]); pairs != nil {
		for _, pair := range pairs {
			hidden := private || flag(pair["isConfidential"]) || confidential[text(pair["name"])]
			for _, variable := range s.pairVariables(pair) {
				variable.enabled, variable.secret = pair["enabled"] != false, variable.secret || hidden
				variables = append(variables, variable)
			}
		}
		return variables
	}
	for _, variable := range s.flatten(object(environment["data"])) {
		variable.secret = variable.secret || private || confidential[variable.name]
		variables = append(variables, variable)
	}
	return variables
}

func (s *insomniaImport) pairVariables(pair map[string]any) []envVariable {
	key, value := text(pair["name"]), text(pair["value"])
	switch text(pair["type"]) {
	case insomniaSecretType:
		return []envVariable{{name: insomniaVaultRoot + key, secret: true}}
	case insomniaJSONType:
		var parsed map[string]any
		if json.Unmarshal([]byte(value), &parsed) == nil && parsed != nil {
			return s.flatten(map[string]any{key: parsed})
		}
	}
	return []envVariable{{name: key, value: s.templates.convert(value)}}
}

func (s *insomniaImport) flatten(data map[string]any) []envVariable {
	var variables []envVariable
	var walk func(prefix string, value map[string]any, depth int)
	walk = func(prefix string, value map[string]any, depth int) {
		for _, key := range sortedKeys(value) {
			item := value[key]
			if key == insomniaVault && prefix == "" {
				for _, secret := range sortedKeys(object(item)) {
					variables = append(variables, envVariable{name: insomniaVaultRoot + secret, enabled: true, secret: true})
				}
				continue
			}
			if nested := object(item); nested != nil && depth < maxEnvironmentDepth {
				walk(prefix+key+".", nested, depth+1)
				continue
			}
			variables = append(variables, envVariable{name: prefix + key, value: s.templates.convert(text(item)), enabled: true})
		}
	}
	walk("", data, 0)
	return variables
}

func (s *insomniaImport) report(name string) {
	c := s.c
	for _, tag := range sortedKeys(s.templates.unmapped) {
		owners := listNames(s.templates.unmapped[tag])
		if tag == filterMark {
			c.Warnings = append(c.Warnings, fmt.Sprintf(messageLiquidFilters, owners))
			continue
		}
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageUnmappedTag, tag, owners))
	}
	if len(s.templates.files) > 0 {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageFileTags, listNames(s.templates.files)))
	}
	if s.space.cookies > 0 {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageInsomniaCookies, name))
	}
	if s.space.certificates > 0 {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageInsomniaCertificates, name, s.space.certificates))
	}
	if s.space.specFile != "" {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageInsomniaSpecFile, name, s.space.specFile))
	}
}
