package importer

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	curlFormSyntax     = `=@<;"`
	curlGlobCharacters = "[]{}"
)

const tokenCharacters = "!#$%&'*+-.^_`|~"

const (
	curlHeaderLine = "#!/bin/sh\n"
	curlJoin       = " \\\n  "
)

type curlScript struct {
	redactor       *redactor
	includeSecrets bool
	variables      []string
	listed         map[string]bool
}

func exportCurl(collection workspace.Collection, options Options) []File {
	script := &curlScript{redactor: newRedactor(collection), includeSecrets: options.IncludeSecrets, listed: map[string]bool{}}
	var commands strings.Builder
	for _, request := range inheritedRequests(collection) {
		script.redactor.owner = request.Name
		commands.WriteString(script.command(request))
	}
	header := curlHeaderLine
	if len(script.variables) > 0 {
		header += "# Set these environment variables before running:\n# " + strings.Join(script.variables, "\n# ") + "\n"
	}
	return []File{{Name: "requests.sh", Text: header + "\n" + commands.String()}}
}

func orderedRequests(collection workspace.Collection) []workspace.Request {
	tree := buildTree(collection)
	return collectRequests(tree, "", 0)
}

func inheritedRequests(collection workspace.Collection) []workspace.Request {
	layersOf := folderLayers(collection)
	requests := orderedRequests(collection)
	for index, request := range requests {
		requests[index] = withInherited(request, layersOf(request.FolderId))
	}
	return requests
}

func folderLayers(collection workspace.Collection) func(folderID string) []engine.Layer {
	byID := make(map[string]workspace.Folder, len(collection.Folders))
	for _, folder := range collection.Folders {
		byID[folder.Id] = folder
	}
	return func(folderID string) []engine.Layer {
		var chain []engine.Layer
		visited := map[string]bool{}
		for id := folderID; id != "" && !visited[id] && len(chain) < maxFolderDepth; {
			folder, found := byID[id]
			if !found {
				break
			}
			visited[id] = true
			chain = append(chain, settingsLayer(folder.Settings))
			id = folder.ParentId
		}
		slices.Reverse(chain)
		return append([]engine.Layer{settingsLayer(collection.Settings)}, chain...)
	}
}

func settingsLayer(settings workspace.Settings) engine.Layer {
	return engine.Layer{Headers: settings.Headers, Auth: settings.Auth}
}

func withInherited(request workspace.Request, layers []engine.Layer) workspace.Request {
	headers, auth, err := engine.Inherit(request.Headers, request.Auth, layers)
	request.Auth = auth
	if err == nil {
		request.Headers = headers
	}
	return request
}

func collectRequests(tree exportTree, id string, depth int) []workspace.Request {
	var requests []workspace.Request
	for _, sibling := range tree.siblings[id] {
		switch {
		case sibling.Request != nil:
			requests = append(requests, *sibling.Request)
		case depth < maxFolderDepth:
			requests = append(requests, collectRequests(tree, sibling.Folder.Id, depth+1)...)
		}
	}
	return requests
}

func shellName(name string) string {
	var out strings.Builder
	for _, r := range name {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' {
			out.WriteRune(r)
		} else {
			out.WriteRune('_')
		}
	}
	if resolved := out.String(); resolved != "" && (resolved[0] < '0' || resolved[0] > '9') {
		return resolved
	}
	return "_" + out.String()
}

func (s *curlScript) quote(value string) string {
	return shellQuote(value, s.list)
}

func (s *curlScript) list(name string) {
	if !s.listed[name] {
		s.listed[name] = true
		s.variables = append(s.variables, name)
	}
}

func shellQuote(value string, onVariable func(string)) string {
	var out strings.Builder
	splitPlaceholders(value, func(text string) { out.WriteString(singleQuoted(text)) }, func(raw string) {
		name := shellName(raw)
		onVariable(name)
		out.WriteString(`"${` + name + `}"`)
	})
	if out.Len() == 0 {
		return "''"
	}
	return out.String()
}

func splitPlaceholders(value string, literal, variable func(string)) {
	remaining := value
	for remaining != "" {
		start := strings.Index(remaining, variableOpen)
		end := -1
		if start >= 0 {
			end = strings.Index(remaining[start:], variableClose)
		}
		if start < 0 || end < 0 {
			literal(remaining)
			return
		}
		end += start
		literal(remaining[:start])
		variable(strings.TrimSpace(remaining[start+len(variableOpen) : end]))
		remaining = remaining[end+len(variableClose):]
	}
}

func needsGlobOff(address string) bool {
	globbed := false
	splitPlaceholders(address, func(text string) { globbed = globbed || strings.ContainsAny(text, curlGlobCharacters) }, func(string) {})
	return globbed
}

func singleQuoted(value string) string {
	value = strings.ReplaceAll(value, string(rune(0)), "")
	if value == "" {
		return ""
	}
	return "'" + strings.ReplaceAll(value, "'", `'\''`) + "'"
}

func (s *curlScript) secret(field, value string) string {
	if s.includeSecrets {
		return value
	}
	return s.redactor.value(field, value)
}

func (s *curlScript) json(source string) string {
	if s.includeSecrets {
		return source
	}
	return s.redactor.json(source)
}

func (s *curlScript) command(request workspace.Request) string {
	arguments := []string{"curl"}
	method := request.Method
	body, contentType := s.body(request)
	hasBody := len(body) > 0
	if method == methodGraphQL {
		method = "POST"
	}
	if !validMethod(method) {
		method = defaultMethod
	}
	if method != "GET" || hasBody {
		arguments = append(arguments, "-X "+s.quote(method))
	}
	if !request.Options.NoFollowRedirects {
		arguments = append(arguments, "-L")
	}
	if request.Options.TimeoutMs > 0 {
		arguments = append(arguments, fmt.Sprintf("--max-time %d", (request.Options.TimeoutMs+999)/1000))
	}
	address, authArguments, authHeaders := s.authorization(request)
	arguments = append(arguments, authArguments...)
	headers := enabledRows(readRows(request.Headers))
	for _, header := range headers {
		arguments = append(arguments, s.headerArgument(header.Key, s.headerValue(header)))
	}
	for _, header := range authHeaders {
		arguments = append(arguments, s.headerArgument(header.Key, header.Value))
	}
	if contentType != "" && !namesHeader(append(headers, authHeaders...), contentTypeHeader) {
		arguments = append(arguments, s.headerArgument(contentTypeHeader, contentType))
	}
	arguments = append(arguments, body...)
	if needsGlobOff(address) {
		arguments = append(arguments, "--globoff")
	}
	arguments = append(arguments, "--url "+s.quote(address))
	return "# " + oneLine(request.Name) + "\n" + strings.Join(arguments, curlJoin) + "\n\n"
}

func (s *curlScript) authorization(request workspace.Request) (string, []string, []row) {
	auth := request.Auth
	address := request.URL
	if !s.includeSecrets {
		address = s.redactor.query(address)
	}
	switch auth.Type {
	case authBasic, authDigest, authNTLM:
		flagName := map[string]string{authBasic: "-u", authDigest: "--digest -u", authNTLM: "--ntlm -u"}[auth.Type]
		credentials := auth.Username + ":" + s.secret("PASSWORD", auth.Password)
		return address, []string{flagName + " " + s.quote(credentials)}, nil
	case authBearer:
		return address, nil, []row{{Key: "Authorization", Value: "Bearer " + s.secret("TOKEN", auth.Token), Enabled: true}}
	case authAPIKey:
		value := s.secret("API_KEY", auth.Value)
		if auth.In == inQuery {
			return appendQuery(address, []row{{Key: auth.Key, Value: value, Enabled: true}}), nil, nil
		}
		return address, nil, []row{{Key: auth.Key, Value: value, Enabled: true}}
	case authAWS:
		argument := fmt.Sprintf("--aws-sigv4 %s --user %s", s.quote("aws:amz:"+auth.AWS.Region+":"+auth.AWS.Service), s.quote(auth.AWS.AccessKey+":"+s.secret("SECRET_KEY", auth.AWS.SecretKey)))
		return address, []string{argument}, nil
	}
	return address, nil, nil
}

func (s *curlScript) headerArgument(key, value string) string {
	return "-H " + s.quote(strings.TrimLeft(key, "@")+": "+value)
}

func validMethod(method string) bool {
	if method == "" || method != strings.ToUpper(method) {
		return false
	}
	for _, r := range method {
		if !strings.ContainsRune(tokenCharacters, r) && (r < 'A' || r > 'Z') && (r < '0' || r > '9') {
			return false
		}
	}
	return true
}

func (s *curlScript) headerValue(header row) string {
	if !redact.IsSensitiveName(header.Key) {
		return header.Value
	}
	return s.secret(header.Key, header.Value)
}

func namesHeader(headers []row, name string) bool {
	return slices.ContainsFunc(headers, func(header row) bool { return strings.EqualFold(header.Key, name) })
}

func (s *curlScript) body(request workspace.Request) ([]string, string) {
	if request.Method == methodGraphQL {
		payload := `{"query":` + quoteJSON(request.GraphqlQuery)
		if strings.TrimSpace(request.GraphqlVariables) != "" {
			payload += `,"variables":` + s.json(request.GraphqlVariables)
		}
		return []string{"--data-raw " + s.quote(payload+"}")}, defaultContentTypes[bodyJSON]
	}
	switch request.BodyType {
	case bodyJSON, bodyText, bodyXML:
		if strings.TrimSpace(request.Body) == "" {
			return nil, ""
		}
		text := request.Body
		if request.BodyType == bodyJSON {
			text = s.json(text)
		}
		return []string{"--data-raw " + s.quote(text)}, defaultContentTypes[request.BodyType]
	case bodyForm:
		return s.formArguments("--data-urlencode", s.sensitiveRows(readRows(request.Body))), ""
	case bodyMultipart:
		return s.multipartArguments(s.sensitiveRows(readRows(request.Body))), ""
	}
	return nil, ""
}

func (s *curlScript) sensitiveRows(rows []row) []row {
	redacted := append([]row(nil), rows...)
	for index, candidate := range redacted {
		if candidate.Type != rowTypeFile && redact.IsSensitiveName(candidate.Key) {
			redacted[index].Value = s.secret(candidate.Key, candidate.Value)
		}
	}
	return redacted
}

func (s *curlScript) formArguments(option string, rows []row) []string {
	var arguments []string
	for _, candidate := range enabledRows(rows) {
		arguments = append(arguments, option+" "+s.quote(candidate.Key+"="+candidate.Value))
	}
	return arguments
}

func (s *curlScript) multipartArguments(rows []row) []string {
	var arguments []string
	for _, candidate := range enabledRows(rows) {
		if candidate.Type == rowTypeFile {
			if field, ok := fileField(candidate); ok {
				arguments = append(arguments, "-F "+s.quote(field))
			}
			continue
		}
		arguments = append(arguments, "--form-string "+s.quote(candidate.Key+"="+candidate.Value))
	}
	return arguments
}

func carriesFormSyntax(value string) bool {
	return strings.ContainsAny(value, curlFormSyntax) || strings.Contains(value, variableOpen) || strings.Contains(value, variableClose)
}

func fileField(candidate row) (string, bool) {
	name := baseName(candidate.FileName)
	if name == "" || carriesFormSyntax(candidate.Key) || carriesFormSyntax(name) {
		return "", false
	}
	return candidate.Key + "=@" + name, true
}

func quoteJSON(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return `""`
	}
	return string(encoded)
}
