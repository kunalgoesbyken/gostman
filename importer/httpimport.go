package importer

import (
	"encoding/json"
	"mime"
	"net/url"
	"path"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	requestTypeHeader   = "X-Request-Type"
	contentTypeHeader   = "Content-Type"
	authorizationHeader = "Authorization"
	graphQLRequest      = "graphql"
	promptPrefix        = "?"
	multipartBoundary   = "boundary"
)

var (
	streamMethods       = map[string]bool{"WEBSOCKET": true, "GRPC": true}
	defaultContentTypes = map[string]string{bodyJSON: "application/json", bodyText: "text/plain", bodyXML: "application/xml", bodyForm: "application/x-www-form-urlencoded"}
)

func (c *collector) readHTTP(docs []document) {
	folders := map[string]string{}
	var environments []document
	for _, doc := range docs {
		if doc.kind == kindHTTPEnvironment {
			environments = append(environments, doc)
			continue
		}
		clean, ok := safeRelativePath(doc.file.Name)
		if !ok {
			c.skip(locales.ImporterUnsafePath, locales.Params{"path": doc.file.Name})
			continue
		}
		stem := strings.TrimSuffix(clean, path.Ext(clean))
		c.read(path.Base(stem), FormatHTTP, func() { c.importHTTPFile(parseHTTPFile(doc.file.Text), stem, folders) })
	}
	if len(environments) > 0 {
		c.readHTTPEnvironments(environments)
	}
}

func (c *collector) httpFolder(stem string, folders map[string]string) (string, bool) {
	if id, found := folders[stem]; found {
		return id, true
	}
	if strings.Count(stem, "/")+1 > maxFolderDepth {
		return "", false
	}
	parentID := ""
	if parent := path.Dir(stem); parent != "." {
		id, ok := c.httpFolder(parent, folders)
		if !ok {
			return "", false
		}
		parentID = id
	}
	folders[stem] = c.addFolder(path.Base(stem), parentID)
	return folders[stem], true
}

func (c *collector) importHTTPFile(doc httpDocument, stem string, folders map[string]string) {
	folderID, ok := c.httpFolder(stem, folders)
	if !ok {
		c.warnDepth()
		return
	}
	label := path.Base(stem)
	variables := c.fileVariables(doc.variables, label)
	c.setFolderVariables(folderID, variables)
	var requests []parts
	for _, section := range doc.sections {
		if request, ok := c.httpRequest(section, label, variables); ok {
			requests = append(requests, request)
		}
	}
	c.linkResponses(requests)
	for _, request := range requests {
		c.build(request, folderID)
	}
	c.summarizeScripts(jetbrainsDialect, label)
}

func (c *collector) fileVariables(variables []row, label string) map[string]string {
	values := map[string]string{}
	for _, variable := range variables {
		values[variable.Key] = c.httpPlaceholders(variable.Value, label, nil)
	}
	return values
}

func (c *collector) setFolderVariables(id string, values map[string]string) {
	if len(values) == 0 {
		return
	}
	for index := range c.Folders {
		if c.Folders[index].Id == id {
			c.Folders[index].Variables = objectJSON(values)
		}
	}
}

func (c *collector) httpRequest(section httpSection, label string, variables map[string]string) (parts, bool) {
	name := cleanName(section.name, section.method+" "+section.url)
	if streamMethods[section.method] {
		c.skip(locales.ImporterHttpStream, locales.Params{"name": name, "method": section.method})
		return parts{}, false
	}
	expand := func(text string) string { return c.httpPlaceholders(text, label, section.prompts) }
	request := parts{name: name, method: section.method, url: expand(section.url), description: strings.Join(section.description, "\n"), options: section.options}
	graphQL := section.method == methodGraphQL
	contentType := ""
	for _, header := range section.headers {
		header.Key, header.Value = expand(header.Key), expand(header.Value)
		switch {
		case strings.EqualFold(header.Key, requestTypeHeader):
			graphQL = graphQL || strings.EqualFold(header.Value, graphQLRequest)
			continue
		case strings.EqualFold(header.Key, authorizationHeader):
			if auth, ok := headerAuth(header.Value); ok {
				request.auth = &auth
				continue
			}
		case strings.EqualFold(header.Key, contentTypeHeader):
			contentType = resolveVariables(header.Value, variables)
		}
		request.headers = append(request.headers, header)
	}
	c.httpBody(&request, expand(strings.Join(section.body, "\n")), contentType, graphQL)
	scriptLabel := placeLabel(labelRequest, name)
	request.preScript = c.translateScript(jetbrainsDialect, scriptLabel, stagePre, section.preScript)
	request.postScript = c.translateScript(jetbrainsDialect, scriptLabel, stageAfter, section.postScript)
	if section.handlerFile {
		c.flag(locales.ImporterHttpHandlerFile, name)
	}
	if section.redirect {
		c.flag(locales.ImporterHttpRedirect, name)
	}
	return request, true
}

func headerAuth(value string) (engine.Auth, bool) {
	scheme, rest, _ := cutSpace(strings.TrimSpace(value))
	scheme = strings.ToLower(scheme)
	fields := strings.Fields(rest)
	switch {
	case (scheme == authBasic || scheme == authDigest) && len(fields) == 2:
		return credentialsAuth(scheme, fields[0], fields[1]), true
	case scheme == authBasic && len(fields) == 1 && strings.Contains(fields[0], ":"):
		username, password, _ := strings.Cut(fields[0], ":")
		return credentialsAuth(authBasic, username, password), true
	case scheme == authBearer && len(fields) == 1:
		return bearerAuth(fields[0]), true
	}
	return engine.Auth{}, false
}

func (c *collector) httpBody(request *parts, body, contentType string, graphQL bool) {
	if graphQL {
		request.method = methodGraphQL
		request.graphqlQuery, request.graphqlVars = splitGraphQLBody(body)
		request.headers = withoutContentType(request.headers)
		return
	}
	if body == "" {
		return
	}
	if reference, isFile := fileReferencePath(body); isFile {
		request.body = objectJSON(map[string]string{"fileName": baseName(reference)})
		request.bodyType, request.needsFiles = bodyBinary, true
		return
	}
	request.body, request.bodyType = body, httpBodyType(body, contentType)
	switch request.bodyType {
	case bodyForm:
		request.body = jsonList(formRows(body))
	case bodyMultipart:
		rows, ok := multipartBody(body, contentType)
		if !ok {
			request.bodyType = bodyText
			break
		}
		request.body, request.needsFiles = jsonList(rows), anyFile(rows)
	}
	if request.bodyType != bodyMultipart && mentionsFile(body) {
		c.flag(locales.ImporterHttpBodyFile, request.name)
	}
	if request.bodyType == bodyMultipart || strings.EqualFold(strings.TrimSpace(contentType), defaultContentTypes[request.bodyType]) {
		request.headers = withoutContentType(request.headers)
	}
}

func resolveVariables(text string, variables map[string]string) string {
	return mapPlaceholders(text, func(inner string) string {
		if value, found := variables[inner]; found {
			return value
		}
		return variableOpen + inner + variableClose
	})
}

func httpBodyType(body, contentType string) string {
	if contentType != "" && !strings.Contains(contentType, variableOpen) {
		if bodyType := bodyTypeOfMime(contentType); bodyType != bodyBinary {
			return bodyType
		}
		return bodyText
	}
	if json.Valid([]byte(placeholdersAsNumbers(body))) {
		return bodyJSON
	}
	return bodyText
}

func withoutContentType(headers []row) []row {
	var kept []row
	for _, header := range headers {
		if !strings.EqualFold(header.Key, contentTypeHeader) {
			kept = append(kept, header)
		}
	}
	return kept
}

func splitGraphQLBody(body string) (string, string) {
	index := strings.LastIndex(body, "\n\n")
	if index < 0 {
		return strings.TrimSpace(body), ""
	}
	variables := strings.TrimSpace(body[index:])
	if !strings.HasPrefix(variables, "{") || !json.Valid([]byte(placeholdersAsNumbers(variables))) {
		return strings.TrimSpace(body), ""
	}
	return strings.TrimSpace(body[:index]), variables
}

func placeholdersAsNumbers(text string) string {
	return mapPlaceholders(text, func(string) string { return "0" })
}

func formRows(body string) []row {
	var joined strings.Builder
	for _, line := range strings.Split(body, "\n") {
		joined.WriteString(strings.TrimSpace(line))
	}
	var rows []row
	for _, pair := range strings.Split(joined.String(), "&") {
		key, value, _ := strings.Cut(pair, "=")
		rows = append(rows, row{Key: unescapeForm(key), Value: unescapeForm(value), Enabled: true})
	}
	return keyedRows(rows)
}

func unescapeForm(text string) string {
	return mapOutsideVariables(text, func(part string) string {
		if decoded, err := url.QueryUnescape(part); err == nil {
			return decoded
		}
		return part
	})
}

func multipartBody(body, contentType string) ([]row, bool) {
	_, params, err := mime.ParseMediaType(contentType)
	if err != nil || params[multipartBoundary] == "" {
		return nil, false
	}
	delimiter := "--" + params[multipartBoundary]
	var rows []row
	var part []string
	inPart := false
	for _, line := range strings.Split(body, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == delimiter || trimmed == delimiter+"--" {
			if inPart {
				rows = append(rows, multipartRow(part))
			}
			part, inPart = nil, trimmed == delimiter
			continue
		}
		if inPart {
			part = append(part, line)
		}
	}
	rows = keyedRows(rows)
	return rows, len(rows) > 0
}

func multipartRow(lines []string) row {
	disposition, partType := "", ""
	index := 0
	for ; index < len(lines) && strings.TrimSpace(lines[index]) != ""; index++ {
		name, value, _ := strings.Cut(lines[index], ":")
		switch strings.ToLower(strings.TrimSpace(name)) {
		case "content-disposition":
			disposition = strings.TrimSpace(value)
		case "content-type":
			partType = strings.TrimSpace(value)
		}
	}
	content := strings.Join(trimBlankLines(lines[min(index+1, len(lines)):]), "\n")
	_, params, _ := mime.ParseMediaType(disposition)
	reference, isFile := fileReferencePath(content)
	if !isFile && params["filename"] == "" {
		return row{Key: params["name"], Value: content, Enabled: true, Type: rowTypeText}
	}
	fileName := params["filename"]
	if fileName == "" {
		fileName = reference
	}
	return row{Key: params["name"], Enabled: true, Type: rowTypeFile, FileName: baseName(fileName), ContentType: partType}
}

func fileReferencePath(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)
	if strings.Contains(trimmed, "\n") || !strings.HasPrefix(trimmed, "< ") && !strings.HasPrefix(trimmed, "<@") {
		return "", false
	}
	rest := strings.TrimSpace(trimmed[1:])
	if strings.HasPrefix(rest, directiveMark) {
		_, rest, _ = cutSpace(rest)
	}
	return strings.TrimSpace(rest), true
}

func mentionsFile(body string) bool {
	for _, line := range strings.Split(body, "\n") {
		if _, isFile := fileReferencePath(line); isFile {
			return true
		}
	}
	return false
}

func (c *collector) linkResponses(requests []parts) {
	positions := map[string]int{}
	for index, request := range requests {
		positions[request.name] = index
	}
	rules := make([][]extractor, len(requests))
	link := func(text string) string {
		return mapPlaceholders(text, func(inner string) string {
			reference, isReference := responseReference(inner)
			target, known := positions[reference.request]
			if !isReference || !known {
				return variableOpen + inner + variableClose
			}
			if !reference.supported {
				c.flagUnique(locales.ImporterHttpVariables, variableOpen+inner+variableClose)
				return variableOpen + inner + variableClose
			}
			rules[target] = withRule(rules[target], reference.rule)
			return variableOpen + reference.rule.Name + variableClose
		})
	}
	for index := range requests {
		linkParts(&requests[index], link)
	}
	for index := range requests {
		if len(rules[index]) > 0 {
			requests[index].extractors = jsonList(rules[index])
		}
	}
}

func linkParts(request *parts, link func(string) string) {
	request.url, request.body = link(request.url), link(request.body)
	request.graphqlQuery, request.graphqlVars = link(request.graphqlQuery), link(request.graphqlVars)
	for index := range request.headers {
		request.headers[index].Value = link(request.headers[index].Value)
	}
	if request.auth != nil {
		request.auth.Username, request.auth.Password, request.auth.Token = link(request.auth.Username), link(request.auth.Password), link(request.auth.Token)
	}
}

func withRule(rules []extractor, rule extractor) []extractor {
	for _, existing := range rules {
		if existing.Name == rule.Name {
			return rules
		}
	}
	return append(rules, rule)
}
