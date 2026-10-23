package importer

import (
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

var brunoMethods = map[string]bool{
	"get": true, "post": true, "put": true, "delete": true, "patch": true, "options": true, "head": true, "trace": true, "connect": true,
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
	sets := c.brunoSets(docs)
	for _, set := range sets {
		c.read(set.name, FormatBruno, func() { c.importBrunoSet(set) })
	}
}

func (c *collector) brunoSets(docs []document) []*brunoSet {
	var sets []*brunoSet
	var loose []document
	for _, doc := range docs {
		clean, ok := safeRelativePath(doc.file.Name)
		if !ok {
			c.skip(messageUnsafePath, doc.file.Name)
			continue
		}
		doc.file.Name = clean
		if doc.kind == kindBrunoConfig {
			config := object(doc.data)
			sets = append(sets, &brunoSet{name: cleanName(text(config["name"]), "Bruno collection"), root: path.Dir(clean), config: config})
			continue
		}
		loose = append(loose, doc)
	}
	sort.SliceStable(sets, func(i, j int) bool { return len(sets[i].root) > len(sets[j].root) })
	roots := make([]string, len(sets))
	for index, set := range sets {
		roots[index] = set.root
	}
	var implicit *brunoSet
	for _, doc := range loose {
		var set *brunoSet
		if index := owner(roots, doc.file.Name); index >= 0 {
			set = sets[index]
		} else {
			implicit = c.implicitSet(implicit, loose)
			set = implicit
		}
		c.assignBruno(set, doc)
	}
	if implicit != nil {
		sets = append(sets, implicit)
	}
	return sets
}

func owner(roots []string, name string) int {
	for index, root := range roots {
		if root == "." || strings.HasPrefix(name, root+"/") {
			return index
		}
	}
	return -1
}

func (c *collector) implicitSet(existing *brunoSet, docs []document) *brunoSet {
	if existing != nil {
		return existing
	}
	root := commonDirectory(docs)
	name := path.Base(root)
	if root == "." || root == "/" {
		name = "Bruno collection"
	}
	return &brunoSet{name: name, root: root}
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
		c.skip("%s: %v", doc.file.Name, err)
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

func (c *collector) importBrunoSet(set *brunoSet) {
	rootID := c.addFolder(set.name, "")
	folders := map[string]string{".": rootID}
	scopes := map[string]scope{}
	meta := map[string]bruFile{}
	var requests []brunoFile
	var collectionScope scope
	for _, file := range set.files {
		switch path.Base(file.path) {
		case brunoCollectionFile:
			if file.dir == "." {
				collectionScope = c.brunoScope(file.bru, fmt.Sprintf(labelCollection, set.name))
			}
		case brunoFolderFile:
			meta[file.dir] = file.bru
		default:
			requests = append(requests, file)
		}
	}
	scopes["."] = collectionScope
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
		folders[dir] = c.addFolder(name, parentID)
		scopes[dir] = scopes[path.Dir(dir)].within(c.brunoScope(folder, fmt.Sprintf(labelFolder, name)))
		return folders[dir], true
	}
	for _, dir := range sortedFolderDirs(set, meta) {
		ensure(dir)
	}
	skippedDeep := 0
	for _, request := range requests {
		folderID, ok := ensure(request.dir)
		if !ok {
			skippedDeep++
			continue
		}
		c.importBrunoRequest(request, scopes[request.dir], folderID)
	}
	if skippedDeep > 0 {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageDepth, maxFolderDepth))
	}
	for _, environment := range set.environments {
		c.importBrunoEnvironment(environment)
	}
	c.summarizeScripts(brunoDialect, set.name)
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

func (c *collector) brunoScope(file bruFile, label string) scope {
	var inherited scope
	for _, entry := range file.entries("headers") {
		inherited.headers = append(inherited.headers, row{Key: entry.Key, Value: entry.Value, Enabled: entry.Enabled})
	}
	inherited.vars = bruRows(file.entries("vars:pre-request"))
	if mode := file.value("auth", "mode"); mode != "" {
		if auth, ok := c.brunoAuth(file, mode); ok {
			inherited.auth = &auth
		}
	}
	pre, post := c.brunoScripts(file, label)
	inherited.pre, inherited.post = nonEmpty(pre), nonEmpty(post)
	return inherited
}

func (c *collector) brunoScripts(file bruFile, label string) (string, string) {
	pre := c.translateScript(brunoDialect, label, stagePre, file.text("script:pre-request"))
	post := joinScripts([]string{
		c.translateScript(brunoDialect, label, stageAfter, file.text("script:post-response")),
		c.translateScript(brunoDialect, label, stagePost, file.text("tests")),
	})
	return pre, post
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
	case "none", "inherit":
		return engine.Auth{}, mode == "none"
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
	case authOAuth2:
		return oauth2Auth(oauth2Fields{
			Grant: value("grant_type"), AuthURL: value("authorization_url"), TokenURL: value("access_token_url"),
			ClientID: value("client_id"), ClientSecret: value("client_secret"), Scope: value("scope"),
			Username: value("username"), Password: value("password"), CallbackURL: value("callback_url"),
			PKCE: value("pkce") == "true", SecretInBody: value("credentials_placement") == "body",
		})
	}
	return engine.Auth{}, false
}

func (c *collector) importBrunoRequest(file brunoFile, inherited scope, folderID string) {
	bru := file.bru
	name := cleanName(bru.value("meta", "name"), strings.TrimSuffix(path.Base(file.path), brunoExtension))
	method := brunoMethod(bru)
	if method == "" {
		c.skip("%s: no request method block", file.path)
		return
	}
	request := parts{
		name:        name,
		method:      strings.ToUpper(method),
		url:         bru.value(method, "url"),
		description: bru.text("docs"),
		tags:        bru.list("meta", "tags"),
		headers:     bruRows(bru.entries("headers")),
		params:      bruRows(bru.entries("params:query")),
		vars:        bruRows(bru.entries("vars:pre-request")),
	}
	request.preScript, request.postScript = c.brunoScripts(bru, fmt.Sprintf(labelRequest, name))
	request.url = applyPathParams(request.url, bruRows(bru.entries("params:path")))
	if strings.Contains(request.url, "?") {
		request.params = disabledOnly(request.params)
	}
	if mode := bru.value(method, "auth"); mode != "" && mode != "inherit" {
		auth, ok := c.brunoAuth(bru, mode)
		request.auth = &auth
		if !ok {
			c.flag(messageAuthDropped, name)
		}
	}
	c.brunoBody(bru, method, &request)
	request.assertions = c.brunoAssertions(bru, name)
	request.extractors = c.brunoExtractors(bru, name)
	c.build(request, inherited, folderID)
}

func brunoMethod(file bruFile) string {
	for method := range brunoMethods {
		if file.has(method) {
			return method
		}
	}
	return ""
}

func applyPathParams(url string, params []row) string {
	base, query, hasQuery := strings.Cut(url, "?")
	segments := strings.Split(base, "/")
	for index, segment := range segments {
		name, isParam := strings.CutPrefix(segment, ":")
		if !isParam || name == "" {
			continue
		}
		for _, param := range params {
			if param.Key == name && param.Value != "" {
				segments[index] = param.Value
			}
		}
	}
	rebuilt := strings.Join(segments, "/")
	if hasQuery {
		return rebuilt + "?" + query
	}
	return rebuilt
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
		request.body, request.bodyType = rowsJSON(keyedRows(bruRows(file.entries("body:form-urlencoded")))), bodyForm
	case "multipartForm":
		request.body, request.bodyType = rowsJSON(multipartRows(file.entries("body:multipart-form"))), bodyMultipart
		request.needsFiles = hasFileRow(file.entries("body:multipart-form"))
	case "file":
		request.bodyType, request.needsFiles = bodyBinary, true
	}
}

func multipartRows(entries []bruEntry) []row {
	rows := make([]row, 0, len(entries))
	for _, entry := range entries {
		if name, isFile := fileReference(entry.Value); isFile {
			rows = append(rows, row{Key: entry.Key, Enabled: entry.Enabled, Type: rowTypeFile, FileName: name})
			continue
		}
		rows = append(rows, row{Key: entry.Key, Value: entry.Value, Enabled: entry.Enabled, Type: rowTypeText})
	}
	return keyedRows(rows)
}

func hasFileRow(entries []bruEntry) bool {
	for _, entry := range entries {
		if _, isFile := fileReference(entry.Value); isFile {
			return true
		}
	}
	return false
}

func fileReference(value string) (string, bool) {
	inner, found := strings.CutPrefix(value, "@file(")
	if !found {
		return "", false
	}
	target, _, _ := strings.Cut(inner, ")")
	target = strings.ReplaceAll(target, `\`, "/")
	return path.Base(target), true
}

func (c *collector) brunoAssertions(file bruFile, name string) string {
	var assertions []assertion
	for _, entry := range file.entries("assert") {
		operator, value, _ := strings.Cut(entry.Value, " ")
		mapped, known := brunoAssertOperators[operator]
		if !known {
			c.skip("%s: assertion %q uses the operator %q, which Gostman does not have", name, entry.Key, operator)
			continue
		}
		assertions = append(assertions, assertion{Expression: entry.Key, Operator: mapped, Value: strings.TrimSpace(value), Enabled: entry.Enabled})
	}
	return jsonList(assertions)
}

func (c *collector) brunoExtractors(file bruFile, name string) string {
	var extractors []extractor
	for _, entry := range file.entries("vars:post-response") {
		expression, ok := bodyExpression(entry.Value)
		if !ok {
			c.skip("%s: the post-response variable %q reads %q, which cannot be converted", name, entry.Key, entry.Value)
			continue
		}
		extractors = append(extractors, extractor{Name: entry.Key, Source: "body", Expression: expression, Enabled: entry.Enabled})
	}
	return jsonList(extractors)
}

func bodyExpression(expression string) (string, bool) {
	rest, found := strings.CutPrefix(strings.TrimSpace(expression), "res.body")
	if !found || (rest != "" && rest[0] != '.' && rest[0] != '[') {
		return "", false
	}
	return "$" + rest, true
}

func jsonList[T any](items []T) string {
	if len(items) == 0 {
		return ""
	}
	encoded, err := json.Marshal(items)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func (c *collector) importBrunoEnvironment(file brunoFile) {
	name := strings.TrimSuffix(path.Base(file.path), brunoExtension)
	variables := map[string]string{}
	for _, entry := range file.bru.entries("vars") {
		if entry.Enabled {
			variables[entry.Key] = entry.Value
		}
	}
	for _, secret := range file.bru.names("vars:secret") {
		variables[secret] = ""
	}
	c.addEnvironment(name, variables)
}
