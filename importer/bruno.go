package importer

import (
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	brunoCustomMethod     = "http"
	brunoGrpcBlock        = "grpc"
	brunoSocketBlock      = "ws"
	brunoEdgeGrid         = "akamai-edgegrid"
	grpcScriptPrefix      = "script:grpc:"
	externalSecretsPrefix = "vars:externalsecrets:"
	contentTypeMark       = "@contentType("
	untitledMessage       = "message %d"
	brunoCollectionName   = "Bruno collection"
)

var brunoMethods = map[string]bool{
	"get": true, "post": true, "put": true, "delete": true, "patch": true, "options": true, "head": true, "trace": true, "connect": true, brunoCustomMethod: true,
}

var brunoAssertOperators = map[string]string{
	"eq": "eq", "neq": "neq", "gt": "gt", "gte": "gte", "lt": "lt", "lte": "lte", "in": "in", "contains": "contains",
	"notContains": "notContains", "length": "length", "matches": "matches", "startsWith": "startsWith",
	"endsWith": "endsWith", "isEmpty": "isEmpty", "isNotEmpty": "isNotEmpty", "isNull": "isNull",
	"isUndefined": "isUndefined", "isDefined": "isDefined", "isNumber": "isNumber", "isString": "isString",
	"isBoolean": "isBoolean", "isArray": "isArray",
}

type brunoFile struct {
	path string
	dir  string
	bru  bruFile
}

type brunoSet struct {
	name         string
	root         string
	config       map[string]any
	files        []brunoFile
	environments []brunoFile
}

type assertion struct {
	Expression string `json:"expression"`
	Operator   string `json:"operator"`
	Value      string `json:"value"`
	Enabled    bool   `json:"enabled"`
}

type extractor struct {
	Name       string `json:"name"`
	Source     string `json:"source"`
	Expression string `json:"expression"`
	Enabled    bool   `json:"enabled"`
	Scope      string `json:"scope,omitempty"`
}

func safeRelativePath(name string) (string, bool) {
	cleaned := strings.ReplaceAll(name, `\`, "/")
	if strings.HasPrefix(cleaned, "/") || strings.Contains(cleaned, ":") {
		return "", false
	}
	for _, segment := range strings.Split(cleaned, "/") {
		if segment == ".." {
			return "", false
		}
	}
	return path.Clean(cleaned), true
}

func (c *collector) readBruno(docs []document) {
	for _, set := range c.brunoSets(c.safeDocuments(docs)) {
		c.read(set.name, FormatBruno, func() { c.importBrunoSet(set) })
	}
}

func (c *collector) brunoSets(docs []document) []*brunoSet {
	var sets []*brunoSet
	for _, group := range groupByRoot(docs, kindBrunoConfig, brunoCollectionName) {
		set := &brunoSet{name: group.name, root: group.root, config: object(group.head.data)}
		if group.head.kind == kindBrunoConfig {
			set.name = cleanName(text(set.config["name"]), brunoCollectionName)
		}
		for _, doc := range group.docs {
			c.assignBruno(set, doc)
		}
		sets = append(sets, set)
	}
	return sets
}

func (c *collector) safeDocuments(docs []document) []document {
	kept := make([]document, 0, len(docs))
	for _, doc := range docs {
		clean, ok := safeRelativePath(doc.file.Name)
		if !ok {
			c.skip(locales.ImporterUnsafePath, locales.Params{"path": doc.file.Name})
			continue
		}
		doc.file.Name = clean
		kept = append(kept, doc)
	}
	return kept
}

func fileStem(name string) string {
	return strings.TrimSuffix(path.Base(name), path.Ext(name))
}

type documentGroup struct {
	root string
	name string
	head document
	docs []document
}

func groupByRoot(docs []document, headKind, fallback string) []documentGroup {
	var groups []documentGroup
	var loose, rest []document
	for _, doc := range docs {
		if doc.kind == headKind {
			groups = append(groups, documentGroup{root: path.Dir(doc.file.Name), head: doc})
			continue
		}
		loose = append(loose, doc)
	}
	sort.SliceStable(groups, func(i, j int) bool { return len(groups[i].root) > len(groups[j].root) })
	for _, doc := range loose {
		if index := owningGroup(groups, doc.file.Name); index >= 0 {
			groups[index].docs = append(groups[index].docs, doc)
			continue
		}
		rest = append(rest, doc)
	}
	if len(rest) == 0 {
		return groups
	}
	implicit := documentGroup{root: commonDirectory(loose), name: fallback, docs: rest}
	if implicit.root != "." && implicit.root != "/" {
		implicit.name = path.Base(implicit.root)
	}
	return append(groups, implicit)
}

func owningGroup(groups []documentGroup, name string) int {
	for index, group := range groups {
		if group.root == "." || strings.HasPrefix(name, group.root+"/") {
			return index
		}
	}
	return -1
}

func commonDirectory(docs []document) string {
	common := strings.Split(path.Dir(docs[0].file.Name), "/")
	for _, doc := range docs[1:] {
		segments := strings.Split(path.Dir(doc.file.Name), "/")
		shared := 0
		for shared < len(common) && shared < len(segments) && common[shared] == segments[shared] {
			shared++
		}
		common = common[:shared]
	}
	if len(common) == 0 {
		return "."
	}
	return strings.Join(common, "/")
}

func (c *collector) assignBruno(set *brunoSet, doc document) {
	relative := strings.TrimPrefix(strings.TrimPrefix(doc.file.Name, set.root), "/")
	if doc.kind != kindBruno || ignored(relative, set.config) {
		return
	}
	parsed, err := parseBru(doc.file.Text)
	if err != nil {
		c.skip(locales.ImporterSkipFileError, locales.Params{"file": doc.file.Name, "detail": err.Error()})
		return
	}
	file := brunoFile{path: relative, dir: path.Dir(relative), bru: parsed}
	if strings.HasPrefix(relative, brunoEnvironmentsFolder+"/") {
		set.environments = append(set.environments, file)
		return
	}
	set.files = append(set.files, file)
}

func ignored(relative string, config map[string]any) bool {
	skipped := map[string]bool{"node_modules": true, ".git": true}
	for _, entry := range list(config["ignore"]) {
		skipped[text(entry)] = true
	}
	for _, segment := range strings.Split(relative, "/") {
		if skipped[segment] {
			return true
		}
	}
	return false
}

type treeContext struct {
	root    string
	dialect *dialect
	ids     map[string]string
}

func (c *collector) importBrunoSet(set *brunoSet) {
	meta := map[string]bruFile{}
	var requests []brunoFile
	var collection bruFile
	for _, file := range set.files {
		switch path.Base(file.path) {
		case brunoCollectionFile:
			if file.dir == "." {
				collection = file.bru
			}
		case brunoFolderFile:
			meta[file.dir] = file.bru
		default:
			requests = append(requests, file)
		}
	}
	paths := make([]requestPath, len(requests))
	for index, request := range requests {
		paths[index] = requestPath{path: strings.TrimSuffix(request.path, brunoExtension), name: brunoName(request)}
	}
	ids, translation := runTargets(paths)
	ctx := treeContext{root: set.root, dialect: translation, ids: ids}
	since := c.mark()
	rootScope := c.collectionScope(c.brunoScope(ctx, collection, placeLabel(labelCollection, set.name)))
	folders := map[string]string{".": c.addScopedFolder(set.name, "", rootScope)}
	sort.SliceStable(requests, func(i, j int) bool { return brunoOrder(requests[i]) < brunoOrder(requests[j]) })
	var ensure func(dir string) (string, bool)
	ensure = func(dir string) (string, bool) {
		if id, found := folders[dir]; found {
			return id, true
		}
		if strings.Count(dir, "/")+1 > maxFolderDepth {
			return "", false
		}
		parentID, ok := ensure(path.Dir(dir))
		if !ok {
			return "", false
		}
		folder := meta[dir]
		name := cleanName(folder.value("meta", "name"), path.Base(dir))
		folders[dir] = c.addScopedFolder(name, parentID, c.brunoScope(ctx, folder, placeLabel(labelFolder, name)))
		return folders[dir], true
	}
	for _, dir := range sortedFolderDirs(set, meta) {
		ensure(dir)
	}
	for _, request := range requests {
		folderID, ok := ensure(request.dir)
		if !ok {
			c.warnDepth()
			continue
		}
		c.importBrunoRequest(ctx, request, folderID)
	}
	c.importBrunoEnvironments(set.environments, folders["."])
	c.noteDotEnv(set.name, since)
	c.summarizeScripts(brunoDialect, set.name)
}

func brunoName(file brunoFile) string {
	return cleanName(file.bru.value("meta", "name"), strings.TrimSuffix(path.Base(file.path), brunoExtension))
}

func sortedFolderDirs(set *brunoSet, meta map[string]bruFile) []string {
	seen := map[string]bool{}
	for _, file := range set.files {
		for dir := file.dir; dir != "."; dir = path.Dir(dir) {
			seen[dir] = true
		}
	}
	dirs := make([]string, 0, len(seen))
	for dir := range seen {
		dirs = append(dirs, dir)
	}
	sort.Slice(dirs, func(i, j int) bool {
		depthI, depthJ := strings.Count(dirs[i], "/"), strings.Count(dirs[j], "/")
		if depthI != depthJ {
			return depthI < depthJ
		}
		seqI, seqJ := sequence(meta[dirs[i]]), sequence(meta[dirs[j]])
		if seqI != seqJ {
			return seqI < seqJ
		}
		return dirs[i] < dirs[j]
	})
	return dirs
}

func sequence(file bruFile) int {
	number, err := strconv.Atoi(file.value("meta", "seq"))
	if err != nil {
		return 1 << 30
	}
	return number
}

func brunoOrder(file brunoFile) string {
	return fmt.Sprintf("%s/%09d/%s", file.dir, sequence(file.bru), file.path)
}

func (c *collector) brunoScope(ctx treeContext, file bruFile, label locales.Message) scope {
	inherited := scope{description: file.text("docs")}
	inherited.headers = bruRows(file.entries("headers"))
	inherited.vars = bruRows(file.entries("vars:pre-request"))
	if mode := file.value("auth", "mode"); mode != "" {
		if auth, ok := c.brunoAuth(file, mode); ok {
			inherited.auth = &auth
		}
	}
	inherited.pre, inherited.post = c.brunoScripts(ctx.dialect, file, label)
	return inherited
}

func (c *collector) brunoScripts(d *dialect, file bruFile, label locales.Message) (string, string) {
	pre := c.translateScript(d, label, stagePre, file.text("script:pre-request"))
	return pre, c.withTests(d, file, label, c.translateScript(d, label, stageAfter, file.text("script:post-response")))
}

func (c *collector) brunoRequestScripts(d *dialect, file bruFile, label locales.Message) (string, string, []extractor, []assertion) {
	pre := c.translateScript(d, label, stagePre, file.text("script:pre-request"))
	after, rules, rows := c.translateAfterScript(d, label, stageAfter, file.text("script:post-response"))
	tests, testRules, testRows := c.translateAfterScript(d, label, stagePost, file.text("tests"))
	return pre, joinScripts([]string{after, tests}), append(rules, testRules...), append(rows, testRows...)
}

func (c *collector) withTests(d *dialect, file bruFile, label locales.Message, after string) string {
	return joinScripts([]string{after, c.translateScript(d, label, stagePost, file.text("tests"))})
}

func bruRows(entries []bruEntry) []row {
	rows := make([]row, 0, len(entries))
	for _, entry := range entries {
		rows = append(rows, row{Key: entry.Key, Value: entry.Value, Enabled: entry.Enabled})
	}
	return rows
}

func (c *collector) brunoAuth(file bruFile, mode string) (engine.Auth, bool) {
	value := func(key string) string { return file.value("auth:"+mode, key) }
	switch mode {
	case authNone, authInherit:
		return engine.Auth{}, mode == authNone
	case authBasic, authDigest:
		return credentialsAuth(mode, value("username"), value("password")), true
	case authBearer:
		return bearerAuth(value("token")), true
	case authNTLM:
		return ntlmAuth(value("username"), value("password"), value("domain")), true
	case authAWS:
		return awsAuth(value("accessKeyId"), value("secretAccessKey"), value("sessionToken"), value("region"), value("service")), true
	case authAPIKey:
		return apiKeyAuth(value("key"), value("value"), value("placement") == "queryparams"), true
	case authOAuth1:
		return brunoOAuth1(value), true
	case brunoEdgeGrid:
		return engine.Auth{Type: authEdgeGrid, EdgeGrid: engine.EdgeGridAuth{
			ClientToken: value("clientToken"), ClientSecret: value("clientSecret"), AccessToken: value("accessToken"),
			Nonce: value("nonce"), Timestamp: value("timestamp"), HeadersToSign: value("headersToSign"), MaxBody: value("maxBodySize"),
		}}, true
	case authOAuth2:
		auth, ok := oauth2Auth(oauth2Fields{
			Grant: value("grant_type"), AuthURL: value("authorization_url"), TokenURL: value("access_token_url"),
			ClientID: value("client_id"), ClientSecret: value("client_secret"), Scope: value("scope"),
			Username: value("username"), Password: value("password"), CallbackURL: value("callback_url"),
			HeaderPrefix: value("token_header_prefix"), PKCE: value("pkce") == "true",
			SecretInBody: value("credentials_placement") != basicAuthHeader, SendIDToken: value("token_source") == idTokenSource,
		})
		return auth, ok
	}
	return engine.Auth{}, false
}

func brunoOAuth1(value func(string) string) engine.Auth {
	privateKey := value("private_key")
	if _, isFile := fileReference(privateKey); isFile {
		privateKey = ""
	}
	return engine.Auth{Type: authOAuth1, OAuth1: engine.OAuth1Auth{
		ConsumerKey: value("consumer_key"), ConsumerSecret: value("consumer_secret"), Token: value("access_token"),
		TokenSecret: value("token_secret"), SignatureMethod: value("signature_method"), PrivateKey: privateKey,
		Realm: value("realm"), Callback: value("callback_url"), Verifier: value("verifier"), Nonce: value("nonce"),
		Timestamp: value("timestamp"), In: value("placement"),
	}}
}

func (c *collector) importBrunoRequest(ctx treeContext, file brunoFile, folderID string) {
	bru := file.bru
	name := brunoName(file)
	request := parts{
		id:          ctx.ids[strings.TrimSuffix(file.path, brunoExtension)],
		name:        name,
		description: bru.text("docs"),
		tags:        bru.list("meta", "tags"),
		vars:        bruRows(bru.entries("vars:pre-request")),
	}
	label := placeLabel(labelRequest, name)
	var peeled []extractor
	var checks []assertion
	request.preScript, request.postScript, peeled, checks = c.brunoRequestScripts(ctx.dialect, bru, label)
	rows, tests := c.brunoChecks(ctx.dialect, label, brunoAssertChecks(bru.entries("assert")))
	request.postScript = joinScripts([]string{request.postScript, tests})
	request.assertions = jsonList(append(rows, checks...))
	var block string
	switch {
	case bru.has(brunoGrpcBlock):
		block = brunoGrpcBlock
		c.brunoGrpc(ctx, bru, label, &request)
	case bru.has(brunoSocketBlock):
		block = brunoSocketBlock
		socketParts(bru.value(block, "url"), brunoSocketMessages(bru), &request)
		request.headers = bruRows(bru.entries("headers"))
	default:
		block = brunoMethod(bru)
		if block == "" {
			c.skip(locales.ImporterSkipNoMethodBlock, locales.Params{"file": file.path})
			return
		}
		c.brunoHTTP(bru, block, &request)
	}
	if mode := bru.value(block, "auth"); mode != "" && mode != authInherit {
		auth, supported := c.brunoAuth(bru, mode)
		request.auth = c.checkedAuth(name, auth, supported)
	}
	if len(peeled) > 0 {
		request.extractors = encodeExtractors(append(readExtractors(request.extractors), peeled...))
	}
	c.build(request, folderID)
}

func (c *collector) brunoHTTP(bru bruFile, block string, request *parts) {
	method := block
	if block == brunoCustomMethod {
		method = bru.value(block, "method")
	}
	request.method = strings.ToUpper(method)
	address, pathVars := pathParamVariables(bru.value(block, "url"), bruRows(bru.entries("params:path")))
	request.url = address
	request.vars = append(request.vars, pathVars...)
	request.headers = bruRows(bru.entries("headers"))
	request.params = bruRows(append(bru.entries("params:query"), bru.entries("query")...))
	if strings.Contains(request.url, "?") {
		request.params = disabledOnly(request.params)
	}
	c.brunoBody(bru, block, request)
	request.extractors = c.brunoExtractors(bru, request.name)
	request.options = c.settingsOptions(request.name, requestSettings{
		timeout:         bru.value("settings", "timeout"),
		followRedirects: bru.value("settings", "followRedirects"),
		maxRedirects:    bru.value("settings", "maxRedirects"),
	})
	request.examples = c.savedExamples(request.name, brunoExamples(bru))
}

func (c *collector) brunoGrpc(ctx treeContext, bru bruFile, label locales.Message, request *parts) {
	call := grpcCall{
		url:        bru.value(brunoGrpcBlock, "url"),
		method:     bru.value(brunoGrpcBlock, "method"),
		methodType: bru.value(brunoGrpcBlock, "methodType"),
		protoPath:  bru.value(brunoGrpcBlock, "protoPath"),
	}
	for _, message := range bru.repeated["body:grpc"] {
		call.messages = append(call.messages, parseSection(message).value("content"))
	}
	c.grpcParts(ctx.root, call, request)
	request.headers = bruRows(bru.entries("metadata"))
	var hooks []string
	for name := range bru.blocks {
		if hook, found := strings.CutPrefix(name, grpcScriptPrefix); found {
			hooks = append(hooks, hook)
		}
	}
	if len(hooks) > 0 {
		sort.Strings(hooks)
		c.warn(RemarkScripts, droppedScripts(label, hooks))
	}
}

func brunoSocketMessages(bru bruFile) []socketMessage {
	var messages []socketMessage
	for index, lines := range bru.repeated["body:ws"] {
		message := parseSection(lines)
		name := cleanName(message.value("name"), fmt.Sprintf(untitledMessage, index+1))
		messages = append(messages, socketMessage{Name: name, Body: message.value("content")})
	}
	return messages
}

func brunoExamples(bru bruFile) []exampleDraft {
	var drafts []exampleDraft
	for _, lines := range bru.repeated["example"] {
		example := parseSection(lines)
		response := example.sections["response"]
		body := response.sections["body"]
		drafts = append(drafts, exampleDraft{
			name:        example.value("name"),
			status:      response.sections["status"].value("code"),
			headers:     bruRows(response.sections["headers"].entries),
			body:        body.value("content"),
			contentType: exampleContentType(body.value("type")),
		})
	}
	return drafts
}

func brunoMethod(file bruFile) string {
	for method := range brunoMethods {
		if file.has(method) {
			return method
		}
	}
	return ""
}

func (c *collector) brunoBody(file bruFile, method string, request *parts) {
	switch file.value(method, "body") {
	case "json":
		request.body, request.bodyType = file.text("body:json"), bodyJSON
	case "text", "sparql":
		request.body, request.bodyType = file.text("body:"+file.value(method, "body")), bodyText
	case "xml":
		request.body, request.bodyType = file.text("body:xml"), bodyXML
	case "graphql":
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = file.text("body:graphql"), file.text("body:graphql:vars")
	case "formUrlEncoded":
		request.body, request.bodyType = jsonList(keyedRows(bruRows(file.entries("body:form-urlencoded")))), bodyForm
	case "multipartForm":
		rows := multipartRows(file.entries("body:multipart-form"))
		request.body, request.bodyType, request.needsFiles = jsonList(rows), bodyMultipart, anyFile(rows)
	case "file":
		request.bodyType, request.needsFiles = bodyBinary, true
	}
}

func multipartRows(entries []bruEntry) []row {
	rows := make([]row, 0, len(entries))
	for _, entry := range entries {
		value, contentType := splitContentType(entry.Value)
		if name, isFile := fileReference(value); isFile {
			rows = append(rows, row{Key: entry.Key, Enabled: entry.Enabled, Type: rowTypeFile, FileName: name, ContentType: contentType})
			continue
		}
		rows = append(rows, row{Key: entry.Key, Value: value, Enabled: entry.Enabled, Type: rowTypeText, ContentType: contentType})
	}
	return keyedRows(rows)
}

func splitContentType(value string) (string, string) {
	at := strings.LastIndex(value, contentTypeMark)
	if at < 0 || !strings.HasSuffix(value, ")") {
		return value, ""
	}
	return strings.TrimSpace(value[:at]), strings.TrimSuffix(value[at+len(contentTypeMark):], ")")
}

func fileReference(value string) (string, bool) {
	inner, found := strings.CutPrefix(value, "@file(")
	if !found {
		return "", false
	}
	target, _, _ := strings.Cut(inner, ")")
	target, _, _ = strings.Cut(strings.ReplaceAll(target, `\`, "/"), "|")
	return path.Base(target), true
}

func brunoAssertChecks(entries []bruEntry) []brunoCheck {
	checks := make([]brunoCheck, len(entries))
	for index, entry := range entries {
		checks[index] = readBrunoCheck(entry.Key, entry.Value, entry.Enabled)
	}
	return checks
}

func (c *collector) brunoExtractors(file bruFile, name string) string {
	var extractors []extractor
	for _, entry := range file.entries("vars:post-response") {
		rule, ok := responseExtractor(entry.Key, entry.Value, entry.Enabled)
		if !ok {
			c.skip(locales.ImporterPostResponseVariable, locales.Params{"name": name, "variable": entry.Key, "expression": entry.Value})
			continue
		}
		extractors = append(extractors, rule)
	}
	return jsonList(extractors)
}

func (c *collector) importBrunoEnvironments(files []brunoFile, folderID string) {
	drafts := make([]environmentDraft, 0, len(files))
	for _, file := range files {
		drafts = append(drafts, brunoEnvironment(file))
	}
	c.addBrunoEnvironments(inFolder(drafts, folderID))
}

func (c *collector) addBrunoEnvironments(drafts []environmentDraft) {
	used := c.placeholderNames()
	for index, draft := range drafts {
		drafts[index].variables = withSecretFields(draft.variables, used)
		for _, variable := range drafts[index].variables {
			if variable.secret && variable.value == "" && variable.ref == nil {
				c.flag(locales.ImporterBrunoSecrets, draft.name+"/"+variable.name)
			}
		}
	}
	c.addDraftEnvironments(drafts)
}

func brunoEnvironment(file brunoFile) environmentDraft {
	draft := environmentDraft{
		name:    strings.TrimSuffix(path.Base(file.path), brunoExtension),
		color:   file.bru.top["color"],
		extends: file.bru.top["extends"],
	}
	if parents := file.bru.names("extends"); draft.extends == "" && len(parents) > 0 {
		draft.extends = parents[0]
	}
	for _, entry := range file.bru.entries("vars") {
		draft.variables = append(draft.variables, envVariable{name: entry.Key, value: entry.Value, enabled: entry.Enabled})
	}
	for _, secret := range file.bru.names("vars:secret") {
		name, disabled := strings.CutPrefix(secret, disabledMark)
		draft.variables = append(draft.variables, envVariable{name: name, enabled: !disabled, secret: true})
	}
	blocks := make([]string, 0, len(file.bru.blocks))
	for block := range file.bru.blocks {
		blocks = append(blocks, block)
	}
	sort.Strings(blocks)
	for _, block := range blocks {
		if provider, found := strings.CutPrefix(block, externalSecretsPrefix); found {
			for _, entry := range file.bru.entries(block) {
				draft.variables = append(draft.variables, envVariable{name: entry.Key, enabled: entry.Enabled, ref: &secretRef{Provider: provider, Path: entry.Value}})
			}
		}
	}
	return draft
}
