package importer

import (
	"encoding/json"
	"fmt"
	"path"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/workspace"
)

const brunoVersion = "1"

func rowsToEntries(rows []row) []bruEntry {
	entries := make([]bruEntry, len(rows))
	for index, candidate := range rows {
		entries[index] = bruEntry{Key: candidate.Key, Value: candidate.Value, Enabled: candidate.Enabled}
	}
	return entries
}

func exportBruno(collection workspace.Collection) []File {
	tree := buildTree(collection)
	config, _ := json.MarshalIndent(map[string]any{"version": brunoVersion, "name": exportName, "type": "collection", "ignore": []string{"node_modules", ".git"}}, "", "  ")
	files := []File{{Name: "bruno.json", Text: string(config) + "\n"}}
	files = append(files, brunoFolder(tree, "", "", 0)...)
	return append(files, brunoEnvironments(collection.Environments)...)
}

func brunoFolder(tree exportTree, id, directory string, depth int) []File {
	var files []File
	used := map[string]bool{}
	sequence := 0
	if depth < maxFolderDepth {
		for _, folder := range tree.folders[id] {
			sequence++
			name := uniqueName(used, safeStem(folder.Name, folderFallback), "")
			child := path.Join(directory, name)
			meta := &bruWriter{}
			meta.dict("meta", []bruEntry{{Key: "name", Value: oneLine(folder.Name), Enabled: true}, {Key: "seq", Value: fmt.Sprint(sequence), Enabled: true}})
			files = append(files, File{Name: path.Join(child, brunoFolderFile), Text: meta.String()})
			files = append(files, brunoFolder(tree, folder.Id, child, depth+1)...)
		}
	}
	for index, request := range tree.requests[id] {
		name := uniqueName(used, safeStem(request.Name, fallbackStem), brunoExtension)
		files = append(files, File{Name: path.Join(directory, name), Text: brunoRequest(request, index+1)})
	}
	return files
}

func brunoRequest(request workspace.Request, sequence int) string {
	w := &bruWriter{}
	kind := "http"
	if request.Method == methodGraphQL {
		kind = "graphql"
	}
	w.dict("meta", []bruEntry{
		{Key: "name", Value: oneLine(request.Name), Enabled: true},
		{Key: "type", Value: kind, Enabled: true},
		{Key: "seq", Value: fmt.Sprint(sequence), Enabled: true},
	})
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
	case authBasic, authBearer, authDigest, authNTLM, authAWS, authAPIKey, authOAuth2:
		return auth.Type
	}
	return "none"
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

func extractorEntries(source string) []bruEntry {
	var entries []bruEntry
	var rules []extractor
	if json.Unmarshal([]byte(source), &rules) != nil {
		return nil
	}
	for _, rule := range rules {
		if expression, ok := strings.CutPrefix(rule.Expression, "$"); ok && rule.Source == "body" && rule.Name != "" {
			entries = append(entries, bruEntry{Key: rule.Name, Value: "res.body" + expression, Enabled: rule.Enabled})
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
	var entries []bruEntry
	var secrets []string
	for _, candidate := range objectRows(values) {
		if meta[candidate.Key]["secret"] == true {
			secrets = append(secrets, candidate.Key)
			continue
		}
		entries = append(entries, bruEntry{Key: candidate.Key, Value: candidate.Value, Enabled: meta[candidate.Key]["enabled"] != false})
	}
	return entries, secrets
}
