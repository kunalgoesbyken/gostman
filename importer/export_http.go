package importer

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"path"
	"slices"
	"strconv"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	httpRootStem       = "requests"
	httpBoundary       = "GostmanBoundary"
	httpBinaryFallback = "body.bin"
	graphQLHeaderValue = "GraphQL"
	webSocketLabel     = "WebSocket"
	noteLeftOut        = "This %s request has no .http form and was left out."
	noteAuth           = "The %s authentication of this request is not written to .http files."
	noteInstructions   = "The body of this request has lines that .http files read as file, script or output instructions, so it was left out."
	httpResponseLink   = "<>"
	dotenvReader       = "$dotenv"
	restClientRange    = "$randomInt %d %d"
)

var (
	unwrittenMethods  = setOf("GRPC", "MCP")
	restClientAliases = map[string]string{"$uuid": "$guid", "$isoTimestamp": "$datetime iso8601", "$randomInt": "$randomInt 0 1001"}
)

type exportedBody struct {
	text         string
	contentType  string
	instructions bool
}

func exportHTTP(collection workspace.Collection, options Options) []File {
	tree := buildTree(collection)
	shared := variableValues(collection.Variables)
	var files []File
	if requests := tree.requests[""]; len(requests) > 0 {
		files = append(files, File{Name: httpRootStem + httpExtension, Text: httpFileText(shared, requests)})
	}
	used := map[string]bool{httpRootStem: true}
	files = append(files, httpFolderFiles(tree, "", "", shared, used, 0)...)
	files = append(files, httpEnvironmentFiles(collection.Environments, options.IncludeSecrets)...)
	if len(files) == 0 {
		return []File{{Name: httpRootStem + httpExtension, Text: httpFileText(shared, nil)}}
	}
	return files
}

func httpFolderFiles(tree exportTree, id, directory string, inherited map[string]string, used map[string]bool, depth int) []File {
	if depth >= maxFolderDepth {
		return nil
	}
	var files []File
	for _, folder := range tree.folders[id] {
		stem := uniqueName(used, safeStem(folder.Name, folderFallback), "")
		variables := mergedValues(mergedValues(inherited, variableValues(folder.CollectionVariables)), variableValues(folder.Variables))
		if requests := tree.requests[folder.Id]; len(requests) > 0 {
			files = append(files, File{Name: path.Join(directory, stem+httpExtension), Text: httpFileText(variables, requests)})
		}
		files = append(files, httpFolderFiles(tree, folder.Id, path.Join(directory, stem), variables, map[string]bool{}, depth+1)...)
	}
	return files
}

func variableValues(source string) map[string]string {
	var values map[string]any
	if json.Unmarshal([]byte(source), &values) != nil {
		return nil
	}
	converted := make(map[string]string, len(values))
	for key, value := range values {
		converted[key] = text(value)
	}
	return converted
}

func mergedValues(outer, inner map[string]string) map[string]string {
	merged := make(map[string]string, len(outer)+len(inner))
	for key, value := range outer {
		merged[key] = value
	}
	for key, value := range inner {
		merged[key] = value
	}
	return merged
}

func httpFileText(variables map[string]string, requests []workspace.Request) string {
	var out strings.Builder
	for _, name := range sortedKeys(variables) {
		if line, ok := fileVariableLine(name, variables[name]); ok {
			out.WriteString(line + "\n")
		}
	}
	links := responseLinks(requests)
	for _, request := range requests {
		if out.Len() > 0 {
			out.WriteString("\n")
		}
		section := &sectionWriter{links: links}
		out.WriteString(section.text(request))
	}
	return out.String()
}

func fileVariableLine(name, value string) (string, bool) {
	if value == "" || redact.IsSensitiveName(name) || strings.ContainsAny(value, "\r\n") || !validVariableName(name) {
		return "", false
	}
	return directiveMark + name + " = " + mapPlaceholders(value, restClientPlaceholder), true
}

func responseLinks(requests []workspace.Request) map[string]string {
	links := map[string]string{}
	for _, request := range requests {
		var rules []extractor
		if !isIdentifier(request.Name) || json.Unmarshal([]byte(request.Extractors), &rules) != nil {
			continue
		}
		for _, rule := range rules {
			switch {
			case !rule.Enabled || rule.Name == "":
			case rule.Source == sourceBody && strings.HasPrefix(rule.Expression, jsonPathRoot):
				links[rule.Name] = strings.Join([]string{request.Name, responseSegment, bodySegment, rule.Expression}, ".")
			case rule.Source == sourceHeader && rule.Expression != "":
				links[rule.Name] = strings.Join([]string{request.Name, responseSegment, headersSegment, rule.Expression}, ".")
			}
		}
	}
	return links
}

func restClientPlaceholder(inner string) string {
	return variableOpen + restClientVariable(inner) + variableClose
}

func restClientVariable(inner string) string {
	if replacement, found := restClientAliases[inner]; found {
		return replacement
	}
	if name, found := strings.CutPrefix(inner, processPrefix); found {
		return dotenvReader + " " + name
	}
	if low, high, found := randomBounds(inner); found {
		return fmt.Sprintf(restClientRange, low, high+1)
	}
	return inner
}

func randomBounds(inner string) (int, int, bool) {
	arguments, found := strings.CutPrefix(inner, "$randomInt(")
	arguments, closed := strings.CutSuffix(arguments, ")")
	low, high, paired := strings.Cut(arguments, ",")
	from, lowErr := strconv.Atoi(strings.TrimSpace(low))
	to, highErr := strconv.Atoi(strings.TrimSpace(high))
	return from, to, found && closed && paired && lowErr == nil && highErr == nil
}

type sectionWriter struct {
	links   map[string]string
	prompts []string
}

func (w *sectionWriter) placeholders(text string) string {
	return mapPlaceholders(text, func(inner string) string {
		if name, prompted := strings.CutPrefix(inner, promptPrefix); prompted {
			if !slices.Contains(w.prompts, name) {
				w.prompts = append(w.prompts, name)
			}
			return variableOpen + name + variableClose
		}
		if reference, linked := w.links[inner]; linked {
			return variableOpen + reference + variableClose
		}
		return restClientPlaceholder(inner)
	})
}

func (w *sectionWriter) text(request workspace.Request) string {
	lines := []string{strings.TrimSpace(httpSeparator + " " + oneLine(request.Name))}
	for _, line := range physicalLines(request.Description) {
		if trimmed := strings.TrimSpace(line); trimmed != "" {
			lines = append(lines, "# "+trimmed)
		}
	}
	if isIdentifier(request.Name) {
		lines = append(lines, "# @name "+request.Name)
	}
	if request.Options.NoFollowRedirects {
		lines = append(lines, "# @no-redirect")
	}
	if request.Options.TimeoutMs > 0 {
		lines = append(lines, fmt.Sprintf("# @timeout %d ms", request.Options.TimeoutMs))
	}
	if protocol := unwrittenProtocol(request); protocol != "" {
		lines = append(lines, "# "+fmt.Sprintf(noteLeftOut, protocol))
		return strings.Join(lines, "\n") + "\n"
	}
	method, address, headers, body, note := httpRequestText(request)
	if body.instructions {
		lines = append(lines, "# "+noteInstructions)
		return strings.Join(lines, "\n") + "\n"
	}
	message := []string{method + " " + w.placeholders(singleLine(address))}
	for _, header := range headers {
		message = append(message, w.placeholders(singleLine(header.Key))+": "+w.placeholders(singleLine(header.Value)))
	}
	if body.text != "" {
		message = append(message, "", w.placeholders(body.text))
	}
	for _, name := range w.prompts {
		lines = append(lines, "# @prompt "+name)
	}
	if note != "" {
		lines = append(lines, "# "+note)
	}
	return strings.Join(append(lines, message...), "\n") + "\n"
}

func isIdentifier(name string) bool {
	return name != "" && !strings.ContainsFunc(name, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-'
	})
}

func unwrittenProtocol(request workspace.Request) string {
	address := strings.ToLower(strings.TrimSpace(request.URL))
	switch {
	case strings.HasPrefix(address, "ws://") || strings.HasPrefix(address, "wss://"):
		return webSocketLabel
	case unwrittenMethods[request.Method]:
		return request.Method
	}
	return ""
}

func httpRequestText(request workspace.Request) (string, string, []row, exportedBody, string) {
	headers, address, note := httpAuthorization(request.Auth, enabledRows(readRows(request.Headers)), request.URL)
	if request.Method == methodGraphQL {
		headers = append(headers, row{Key: requestTypeHeader, Value: graphQLHeaderValue, Enabled: true})
		query := graphQLText(request)
		return "POST", address, withContentType(headers, defaultContentTypes[bodyJSON], false), exportedBody{text: query, instructions: readsAsInstructions(query)}, note
	}
	method := request.Method
	if !validMethod(method) {
		method = defaultMethod
	}
	body := httpBodyText(request)
	if body.contentType != "" {
		headers = withContentType(headers, body.contentType, request.BodyType == bodyMultipart)
	}
	return method, address, headers, body, note
}

func isLineBreak(r rune) bool {
	return r == '\n' || r == '\r' || r == '\v' || r == '\f' || r == '\u0085' || r == lineSeparator || r == paragraphSep
}

func physicalLines(text string) []string {
	return strings.FieldsFunc(text, isLineBreak)
}

func readsAsInstructions(text string) bool {
	for _, line := range physicalLines(text) {
		if isInstructionLine(strings.TrimLeftFunc(line, unicode.IsSpace)) {
			return true
		}
	}
	return false
}

func isInstructionLine(line string) bool {
	_, isFile := fileReferencePath(line)
	return isFile ||
		strings.HasPrefix(line, httpSeparator) ||
		strings.HasPrefix(line, httpRedirect) ||
		strings.HasPrefix(line, httpResponseLink) ||
		isScriptLine(line, httpPreScript) ||
		isScriptLine(line, httpPostScript) ||
		isHandlerFile(line)
}

func attachedName(location string) string {
	name := strings.TrimSpace(singleLine(baseName(location)))
	if name == "" || strings.HasPrefix(name, ".") || strings.Contains(name, variableOpen) || strings.Contains(name, variableClose) {
		return httpBinaryFallback
	}
	return name
}

func graphQLText(request workspace.Request) string {
	query := strings.TrimSpace(request.GraphqlQuery)
	if variables := strings.TrimSpace(request.GraphqlVariables); variables != "" && variables != "{}" {
		return query + "\n\n" + variables
	}
	return query
}

func withContentType(headers []row, contentType string, replace bool) []row {
	for _, header := range headers {
		if strings.EqualFold(header.Key, contentTypeHeader) && !replace {
			return headers
		}
	}
	return append(withoutContentType(headers), row{Key: contentTypeHeader, Value: contentType, Enabled: true})
}

func httpAuthorization(auth engine.Auth, headers []row, address string) ([]row, string, string) {
	header := func(value string) []row {
		return append(headers, row{Key: authorizationHeader, Value: value, Enabled: true})
	}
	switch auth.Type {
	case "", authNone, authInherit:
		return headers, address, ""
	case authBasic:
		return header("Basic " + basicCredentials(auth.Username, auth.Password)), address, ""
	case authDigest:
		return header("Digest " + auth.Username + " " + auth.Password), address, ""
	case authBearer:
		return header("Bearer " + auth.Token), address, ""
	case authAPIKey:
		key := row{Key: auth.Key, Value: auth.Value, Enabled: true}
		if auth.In == inQuery {
			return headers, appendQuery(address, []row{key}), ""
		}
		return append(headers, key), address, ""
	}
	return headers, address, fmt.Sprintf(noteAuth, auth.Type)
}

func basicCredentials(username, password string) string {
	plain := username != "" && password != "" && !strings.ContainsFunc(username+password, unicode.IsSpace)
	switch {
	case plain:
		return username + " " + password
	case strings.Contains(username+password, variableOpen):
		return username + ":" + password
	}
	return base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
}

func httpBodyText(request workspace.Request) exportedBody {
	switch request.BodyType {
	case bodyJSON, bodyText, bodyXML:
		text := strings.Join(trimBlankLines(strings.Split(normalizeNewlines(request.Body), "\n")), "\n")
		if text == "" {
			return exportedBody{}
		}
		return exportedBody{text: text, contentType: defaultContentTypes[request.BodyType], instructions: readsAsInstructions(text)}
	case bodyForm:
		return formText(enabledRows(readRows(request.Body)))
	case bodyMultipart:
		return multipartText(enabledRows(readRows(request.Body)))
	case bodyBinary:
		return binaryText(request.Body)
	}
	return exportedBody{}
}

func formText(rows []row) exportedBody {
	if len(rows) == 0 {
		return exportedBody{}
	}
	pairs := make([]string, len(rows))
	for index, candidate := range rows {
		pairs[index] = encodeQueryPart(candidate.Key) + "=" + encodeQueryPart(candidate.Value)
	}
	return exportedBody{text: strings.Join(pairs, "\n&"), contentType: defaultContentTypes[bodyForm]}
}

func multipartText(rows []row) exportedBody {
	if len(rows) == 0 {
		return exportedBody{}
	}
	delimiter := "--" + httpBoundary
	var lines []string
	instructions := false
	for _, candidate := range rows {
		lines = append(lines, delimiter)
		disposition := "Content-Disposition: form-data; name=" + quotedParameter(candidate.Key)
		if candidate.Type != rowTypeFile {
			lines = append(lines, disposition, "", candidate.Value)
			instructions = instructions || readsAsInstructions(candidate.Value)
			continue
		}
		name := attachedName(candidate.FileName)
		lines = append(lines, disposition+"; filename="+quotedParameter(name))
		if candidate.ContentType != "" {
			lines = append(lines, contentTypeHeader+": "+singleLine(candidate.ContentType))
		}
		lines = append(lines, "", "< ./"+name)
	}
	lines = append(lines, delimiter+"--")
	return exportedBody{text: strings.Join(lines, "\n"), contentType: "multipart/form-data; boundary=" + httpBoundary, instructions: instructions}
}

func quotedParameter(value string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(singleLine(value)) + `"`
}

func binaryText(source string) exportedBody {
	var file struct {
		FileName    string `json:"fileName"`
		ContentType string `json:"contentType"`
	}
	if json.Unmarshal([]byte(source), &file) != nil {
		return exportedBody{}
	}
	name := attachedName(file.FileName)
	contentType := file.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	return exportedBody{text: "< ./" + name, contentType: contentType}
}

func httpEnvironmentFiles(environments []workspace.Environment, includeSecrets bool) []File {
	public, private := map[string]map[string]json.RawMessage{}, map[string]map[string]json.RawMessage{}
	for _, environment := range environments {
		var values map[string]json.RawMessage
		var meta map[string]map[string]any
		_ = json.Unmarshal([]byte(environment.Variables), &values)
		_ = json.Unmarshal([]byte(environment.Meta), &meta)
		for key := range workspace.SecretNames(environment.Meta) {
			if _, present := values[key]; !present && meta[key]["enabled"] != false {
				values[key] = json.RawMessage(`""`)
			}
		}
		name := oneLine(environment.Name)
		if public[name] == nil {
			public[name] = map[string]json.RawMessage{}
		}
		for key, value := range values {
			switch {
			case meta[key]["enabled"] == false:
			case meta[key]["secret"] == true || redact.IsSensitiveName(key):
				if !includeSecrets {
					value = json.RawMessage(`""`)
				}
				if private[name] == nil {
					private[name] = map[string]json.RawMessage{}
				}
				private[name][key] = value
			default:
				public[name][key] = value
			}
		}
	}
	var files []File
	for _, file := range []struct {
		name   string
		values map[string]map[string]json.RawMessage
	}{{httpPublicEnvironment, public}, {httpPrivateEnvironment, private}} {
		if len(file.values) == 0 {
			continue
		}
		encoded, err := json.MarshalIndent(file.values, "", "  ")
		if err == nil {
			files = append(files, File{Name: file.name, Text: string(encoded) + "\n"})
		}
	}
	return files
}
