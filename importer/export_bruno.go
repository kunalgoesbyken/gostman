package importer

import (
	"encoding/json"
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const brunoVersion = "1"

func rowsToEntries(rows []row) []bruEntry {
	entries := make([]bruEntry, len(rows))
	for index, candidate := range rows {
		entries[index] = bruEntry{Key: candidate.Key, Value: candidate.Value, Enabled: candidate.Enabled}
	}
	return entries
}

type brunoTop struct {
	name      string
	id        string
	settings  workspace.Settings
	variables map[string]string
}

func exportBruno(collection workspace.Collection, tests map[string]string) []File {
	tree := buildTree(collection)
	tree.tests = tests
	root := brunoRootOf(collection, tree)
	config, _ := json.MarshalIndent(map[string]any{"version": brunoVersion, "name": root.name, "type": "collection", "ignore": []string{"node_modules", ".git"}}, "", "  ")
	files := []File{{Name: "bruno.json", Text: string(config) + "\n"}}
	if text := brunoScopeText(nil, root.settings, authNone, root.variables, tests[root.id]); text != "" {
		files = append(files, File{Name: brunoCollectionFile, Text: text})
	}
	files = append(files, brunoFolder(tree, root.id)...)
	return append(files, brunoEnvironments(collection.Environments)...)
}

func brunoRootOf(collection workspace.Collection, tree exportTree) brunoTop {
	shared := variableValues(collection.Variables)
	top := tree.folders[""]
	if len(top) == 1 && len(tree.requests[""]) == 0 && blankSettings(collection.Settings) && strings.TrimSpace(tree.tests[""]) == "" {
		return brunoTop{name: top[0].Name, id: top[0].Id, settings: top[0].Settings, variables: mergedValues(shared, variableValues(top[0].Variables))}
	}
	return brunoTop{name: exportName, settings: collection.Settings, variables: shared}
}

func blankSettings(settings workspace.Settings) bool {
	for _, value := range []string{settings.Description, settings.PreScript, settings.PostScript} {
		if strings.TrimSpace(value) != "" {
			return false
		}
	}
	return len(readRows(settings.Headers)) == 0 && len(readRows(settings.Assertions)) == 0 && inherits(settings.Auth)
}

func inherits(auth engine.Auth) bool {
	return auth.Type == "" || auth.Type == authInherit
}

func brunoScopeText(meta []bruEntry, settings workspace.Settings, unset string, variables map[string]string, tests string) string {
	w := &bruWriter{}
	w.dict("meta", meta)
	w.dict("headers", rowsToEntries(readRows(settings.Headers)))
	mode := unset
	if !inherits(settings.Auth) {
		mode = brunoAuthMode(settings.Auth)
	}
	if meta != nil || mode != authNone {
		w.dict("auth", []bruEntry{{Key: "mode", Value: mode, Enabled: true}})
	}
	writeBrunoAuth(w, settings.Auth, mode)
	w.dict("vars:pre-request", stringRows(variables))
	w.block("script:pre-request", settings.PreScript)
	w.block("script:post-response", settings.PostScript)
	w.block("tests", tests)
	w.block("docs", settings.Description)
	if w.out.Len() == 0 {
		return ""
	}
	return w.String()
}

func stringRows(values map[string]string) []bruEntry {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	entries := make([]bruEntry, len(keys))
	for index, key := range keys {
		entries[index] = bruEntry{Key: key, Value: values[key], Enabled: true}
	}
	return entries
}

type brunoItem struct {
	folder   *workspace.Folder
	request  *workspace.Request
	location string
	sequence int
}

func brunoItems(tree exportTree, id, directory string, depth int) []brunoItem {
	var items []brunoItem
	used := map[string]bool{}
	if depth < maxFolderDepth {
		for index, folder := range tree.folders[id] {
			child := path.Join(directory, uniqueName(used, safeStem(folder.Name, folderFallback), ""))
			items = append(items, brunoItem{folder: &folder, location: child, sequence: index + 1})
			items = append(items, brunoItems(tree, folder.Id, child, depth+1)...)
		}
	}
	for index, request := range tree.requests[id] {
		location := path.Join(directory, uniqueName(used, safeStem(request.Name, fallbackStem), brunoExtension))
		items = append(items, brunoItem{request: &request, location: location, sequence: index + 1})
	}
	return items
}

func brunoFolder(tree exportTree, id string) []File {
	var files []File
	for _, item := range brunoItems(tree, id, "", 0) {
		if folder := item.folder; folder != nil {
			meta := []bruEntry{{Key: "name", Value: oneLine(folder.Name), Enabled: true}, {Key: "seq", Value: fmt.Sprint(item.sequence), Enabled: true}}
			text := brunoScopeText(meta, folder.Settings, authInherit, variableValues(folder.Variables), tree.tests[folder.Id])
			files = append(files, File{Name: path.Join(item.location, brunoFolderFile), Text: text})
			continue
		}
		files = append(files, File{Name: item.location, Text: brunoRequest(*item.request, item.sequence, tree.tests[item.request.Id])})
	}
	return files
}

func brunoOrderWarnings(collection workspace.Collection) []string {
	names := requestsAboveFolders(buildTree(collection), "", 0)
	return appendCounted(nil, messageExportBrunoOrder, len(names), listNames(names))
}

func requestsAboveFolders(tree exportTree, id string, depth int) []string {
	var names, pending []string
	for _, sibling := range tree.siblings[id] {
		if sibling.Request != nil {
			pending = append(pending, sibling.Request.Name)
			continue
		}
		names, pending = append(names, pending...), nil
		if depth < maxFolderDepth {
			names = append(names, requestsAboveFolders(tree, sibling.Folder.Id, depth+1)...)
		}
	}
	return names
}

func brunoRequestPaths(collection workspace.Collection, tests map[string]string) map[string]string {
	tree := buildTree(collection)
	tree.tests = tests
	paths := map[string]string{}
	for _, item := range brunoItems(tree, brunoRootOf(collection, tree).id, "", 0) {
		if item.request != nil {
			paths[item.request.Id] = strings.TrimSuffix(item.location, brunoExtension)
		}
	}
	for _, request := range collection.Requests {
		if _, named := paths[request.Name]; !named && paths[request.Id] != "" {
			paths[request.Name] = paths[request.Id]
		}
	}
	return paths
}

func brunoRequest(request workspace.Request, sequence int, tests string) string {
	w := &bruWriter{}
	kind := "http"
	if request.Method == methodGraphQL {
		kind = "graphql"
	}
	w.section("meta", dictLines([]bruEntry{
		{Key: "name", Value: oneLine(request.Name), Enabled: true},
		{Key: "type", Value: kind, Enabled: true},
		{Key: "seq", Value: fmt.Sprint(sequence), Enabled: true},
	})+listLines("tags", workspace.NormalizeTags(request.Tags)))
	method := strings.ToLower(request.Method)
	if request.Method == methodGraphQL || !brunoMethods[method] {
		method = "post"
	}
	mode := brunoAuthMode(request.Auth)
	body := brunoBodyMode(request)
	fields := []bruEntry{{Key: "url", Value: request.URL, Enabled: true}}
	if body != "" {
		fields = append(fields, bruEntry{Key: "body", Value: body, Enabled: true})
	}
	fields = append(fields, bruEntry{Key: "auth", Value: mode, Enabled: true})
	w.dict(method, fields)
	w.dict("params:query", rowsToEntries(disabledOnly(readRows(request.QueryParams))))
	w.dict("headers", rowsToEntries(readRows(request.Headers)))
	writeBrunoAuth(w, request.Auth, mode)
	writeBrunoBody(w, request, body)
	w.dict("vars:pre-request", rowsToEntries(readRows(request.Vars)))
	w.dict("vars:post-response", extractorEntries(request.Extractors))
	w.dict("assert", assertionEntries(request.Assertions))
	w.block("script:pre-request", request.PreScript)
	w.block("script:post-response", request.PostScript)
	w.block("tests", tests)
	w.block("docs", request.Description)
	return w.String()
}

func disabledOnly(rows []row) []row {
	var kept []row
	for _, candidate := range rows {
		if !candidate.Enabled {
			kept = append(kept, candidate)
		}
	}
	return kept
}

func brunoAuthMode(auth engine.Auth) string {
	switch auth.Type {
	case authBasic, authBearer, authDigest, authNTLM, authAWS, authAPIKey, authOAuth2, authInherit:
		return auth.Type
	}
	return authNone
}

func writeBrunoAuth(w *bruWriter, auth engine.Auth, mode string) {
	entry := func(key, value string) bruEntry { return bruEntry{Key: key, Value: value, Enabled: true} }
	switch mode {
	case authBasic, authDigest:
		w.dict("auth:"+mode, []bruEntry{entry("username", auth.Username), entry("password", auth.Password)})
	case authBearer:
		w.dict("auth:bearer", []bruEntry{entry("token", auth.Token)})
	case authNTLM:
		w.dict("auth:ntlm", []bruEntry{entry("username", auth.Username), entry("password", auth.Password), entry("domain", auth.Domain)})
	case authAWS:
		w.dict("auth:awsv4", []bruEntry{entry("accessKeyId", auth.AWS.AccessKey), entry("secretAccessKey", auth.AWS.SecretKey), entry("sessionToken", auth.AWS.SessionToken), entry("service", auth.AWS.Service), entry("region", auth.AWS.Region)})
	case authAPIKey:
		placement := "header"
		if auth.In == inQuery {
			placement = "queryparams"
		}
		w.dict("auth:apikey", []bruEntry{entry("key", auth.Key), entry("value", auth.Value), entry("placement", placement)})
	case authOAuth2:
		w.dict("auth:oauth2", oauth2Entries(auth.OAuth2))
	}
}

func oauth2Entries(config engine.OAuth2) []bruEntry {
	entry := func(key, value string) bruEntry { return bruEntry{Key: key, Value: value, Enabled: true} }
	placement := "basic_auth_header"
	if config.CredentialsIn == credentialsInBody {
		placement = "body"
	}
	return []bruEntry{
		entry("grant_type", config.Grant), entry("callback_url", config.CallbackURL), entry("authorization_url", config.AuthURL),
		entry("access_token_url", config.TokenURL), entry("client_id", config.ClientID), entry("client_secret", config.ClientSecret),
		entry("scope", config.Scope), entry("username", config.Username), entry("password", config.Password),
		entry("pkce", fmt.Sprint(config.PKCE)), entry("credentials_placement", placement),
	}
}

func brunoBodyMode(request workspace.Request) string {
	if request.Method == methodGraphQL {
		return "graphql"
	}
	switch request.BodyType {
	case bodyJSON:
		return "json"
	case bodyText:
		return "text"
	case bodyXML:
		return "xml"
	case bodyForm:
		return "formUrlEncoded"
	case bodyMultipart:
		return "multipartForm"
	}
	return ""
}

func writeBrunoBody(w *bruWriter, request workspace.Request, mode string) {
	switch mode {
	case "json", "text", "xml":
		w.block("body:"+mode, request.Body)
	case "graphql":
		w.block("body:graphql", request.GraphqlQuery)
		w.block("body:graphql:vars", request.GraphqlVariables)
	case "formUrlEncoded":
		w.dict("body:form-urlencoded", rowsToEntries(readRows(request.Body)))
	case "multipartForm":
		w.dict("body:multipart-form", multipartEntries(readRows(request.Body)))
	}
}

func multipartEntries(rows []row) []bruEntry {
	entries := make([]bruEntry, len(rows))
	for index, candidate := range rows {
		value := candidate.Value
		if candidate.Type == rowTypeFile {
			value = "@file(" + candidate.FileName + ")"
		}
		entries[index] = bruEntry{Key: candidate.Key, Value: value, Enabled: candidate.Enabled}
	}
	return entries
}

func readExtractors(source string) []extractor {
	var rules []extractor
	if json.Unmarshal([]byte(source), &rules) != nil {
		return nil
	}
	return rules
}

func extractorEntries(source string) []bruEntry {
	var entries []bruEntry
	for _, rule := range readExtractors(source) {
		if value, ok := brunoExtract.value(rule); ok {
			entries = append(entries, bruEntry{Key: rule.Name, Value: value, Enabled: rule.Enabled})
		}
	}
	return entries
}

func assertionEntries(source string) []bruEntry {
	var entries []bruEntry
	var rules []assertion
	if json.Unmarshal([]byte(source), &rules) != nil {
		return nil
	}
	for _, rule := range rules {
		if _, known := brunoAssertOperators[rule.Operator]; !known || rule.Expression == "" {
			continue
		}
		entries = append(entries, bruEntry{Key: rule.Expression, Value: strings.TrimSpace(rule.Operator + " " + rule.Value), Enabled: rule.Enabled})
	}
	return entries
}

func brunoEnvironments(environments []workspace.Environment) []File {
	var files []File
	used := map[string]bool{}
	for _, environment := range environments {
		variables, secrets := environmentVariables(environment)
		w := &bruWriter{}
		w.dict("vars", variables)
		w.names("vars:secret", secrets)
		name := uniqueName(used, safeStem(environment.Name, "environment"), brunoExtension)
		files = append(files, File{Name: path.Join(brunoEnvironmentsFolder, name), Text: w.String()})
	}
	return files
}

func environmentVariables(environment workspace.Environment) ([]bruEntry, []string) {
	var values map[string]any
	var meta map[string]map[string]any
	_ = json.Unmarshal([]byte(environment.Variables), &values)
	_ = json.Unmarshal([]byte(environment.Meta), &meta)
	secrets := workspace.SecretNames(environment.Meta)
	var entries []bruEntry
	for _, candidate := range objectRows(values) {
		if !secrets[candidate.Key] {
			entries = append(entries, bruEntry{Key: candidate.Key, Value: candidate.Value, Enabled: meta[candidate.Key]["enabled"] != false})
		}
	}
	return entries, sortedKeys(secrets)
}
