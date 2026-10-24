package importer

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const curlFormSyntax = `=@<;"`

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
	for _, request := range orderedRequests(collection) {
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

func collectRequests(tree exportTree, id string, depth int) []workspace.Request {
	requests := append([]workspace.Request{}, tree.requests[id]...)
	if depth >= maxFolderDepth {
		return requests
	}
	for _, folder := range tree.folders[id] {
		requests = append(requests, collectRequests(tree, folder.Id, depth+1)...)
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
	remaining := value
	for remaining != "" {
		start := strings.Index(remaining, variableOpen)
		end := -1
		if start >= 0 {
			end = strings.Index(remaining[start:], variableClose)
		}
		if start < 0 || end < 0 {
			out.WriteString(singleQuoted(remaining))
			break
		}
		end += start
		name := shellName(strings.TrimSpace(remaining[start+len(variableOpen) : end]))
		onVariable(name)
		out.WriteString(singleQuoted(remaining[:start]))
		out.WriteString(`"${` + name + `}"`)
		remaining = remaining[end+len(variableClose):]
	}
	if out.Len() == 0 {
		return "''"
	}
	return out.String()
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
	body := s.body(request)
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
	address, authArguments, headers := s.authorization(request)
	arguments = append(arguments, authArguments...)
	for _, header := range enabledRows(readRows(request.Headers)) {
		arguments = append(arguments, s.headerArgument(header.Key, s.headerValue(header)))
	}
	for _, header := range headers {
		arguments = append(arguments, s.headerArgument(header.Key, header.Value))
	}
	arguments = append(arguments, body...)
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

func (s *curlScript) body(request workspace.Request) []string {
	if request.Method == methodGraphQL {
		payload := `{"query":` + quoteJSON(request.GraphqlQuery)
		if strings.TrimSpace(request.GraphqlVariables) != "" {
			payload += `,"variables":` + s.json(request.GraphqlVariables)
		}
		return []string{"-H 'Content-Type: application/json'", "--data-raw " + s.quote(payload+"}")}
	}
	switch request.BodyType {
	case bodyJSON, bodyText, bodyXML:
		if strings.TrimSpace(request.Body) == "" {
			return nil
		}
		text := request.Body
		if request.BodyType == bodyJSON {
			text = s.json(text)
		}
		return []string{"--data-raw " + s.quote(text)}
	case bodyForm:
		return s.formArguments("--data-urlencode", s.sensitiveRows(readRows(request.Body)))
	case bodyMultipart:
		return s.multipartArguments(s.sensitiveRows(readRows(request.Body)))
	}
	return nil
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
