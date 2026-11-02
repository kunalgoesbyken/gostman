package importer

import (
	"encoding/json"
	"fmt"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	ExportHurl         = "hurl"
	hurlRootStem       = "requests"
	hurlAnyStatus      = "HTTP *"
	hurlCommentMark    = "# "
	hurlJSONRoot       = "$"
	hurlBodyRoot       = "res.body"
	hurlHeaderPrefix   = "res.headers"
	hurlNoteBody       = "left out, the body has a ``` line that Hurl files cannot hold"
	hurlNoteAssertLeft = "left out, no Hurl form: %s %s %s"
	hurlNoteCapture    = "left out, no Hurl form: capture %s"
)

var hurlAssertOperators = map[string]string{
	"eq": "==", "neq": "!=", "gt": ">", "gte": ">=", "lt": "<", "lte": "<=", "contains": "contains",
	"startsWith": "startsWith", "endsWith": "endsWith", "matches": "matches", "notContains": "not contains",
}

var hurlUnaryOperators = map[string]string{
	"isDefined": "exists", "isUndefined": "not exists", "isEmpty": "isEmpty", "isNotEmpty": "not isEmpty",
	"isString": "isString", "isNumber": "isNumber", "isBoolean": "isBoolean", "isArray": "isCollection",
}

func exportHurl(collection workspace.Collection) []File {
	tree := buildTree(collection)
	var files []File
	if requests := tree.requests[""]; len(requests) > 0 {
		files = append(files, File{Name: hurlRootStem + hurlExtension, Text: hurlFileText(requests)})
	}
	used := map[string]bool{hurlRootStem: true}
	files = append(files, hurlFolderFiles(tree, "", "", used, 0)...)
	if len(files) == 0 {
		return []File{{Name: hurlRootStem + hurlExtension}}
	}
	return files
}

func hurlFolderFiles(tree exportTree, id, directory string, used map[string]bool, depth int) []File {
	if depth >= maxFolderDepth {
		return nil
	}
	var files []File
	for _, folder := range tree.folders[id] {
		stem := uniqueName(used, safeStem(folder.Name, folderFallback), "")
		if requests := tree.requests[folder.Id]; len(requests) > 0 {
			files = append(files, File{Name: path.Join(directory, stem+hurlExtension), Text: hurlFileText(requests)})
		}
		files = append(files, hurlFolderFiles(tree, folder.Id, path.Join(directory, stem), map[string]bool{}, depth+1)...)
	}
	return files
}

func hurlFileText(requests []workspace.Request) string {
	entries := make([]string, 0, len(requests))
	for _, request := range requests {
		entries = append(entries, hurlEntryText(request))
	}
	return strings.Join(entries, "\n")
}

func hurlPlaceholder(inner string) string {
	if inner == "$guid" || inner == "$uuid" {
		return variableOpen + "newUuid" + variableClose
	}
	return variableOpen + inner + variableClose
}

func hurlLine(text string) string {
	return mapPlaceholders(singleLine(text), hurlPlaceholder)
}

func hurlComment(text string) string {
	return hurlCommentMark + oneLine(text)
}

func hurlQuotedArg(text string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(singleLine(text)) + `"`
}

var hurlHeaderToken = regexp.MustCompile(`^[A-Za-z0-9!#$%&'*+.^_|~-]+$`)

var hurlCaptureName = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func hurlEntryText(request workspace.Request) string {
	lines := []string{hurlComment(request.Name)}
	if protocol := unwrittenProtocol(request); protocol != "" {
		return strings.Join(append(lines, hurlComment(fmt.Sprintf(noteLeftOut, protocol))), "\n") + "\n"
	}
	method, address, headers, _, note := httpRequestText(request)
	if note != "" {
		lines = append(lines, hurlComment(note))
	}
	body, bodyNote := hurlBody(request)
	if bodyNote != "" {
		lines = append(lines, hurlComment(bodyNote))
	}
	if request.BodyType == bodyMultipart || request.BodyType == bodyForm {
		headers = withoutContentType(headers)
	}
	lines = append(lines, method+" "+hurlLine(address))
	for _, header := range headers {
		if !hurlHeaderToken.MatchString(header.Key) {
			continue
		}
		lines = append(lines, header.Key+": "+hurlLine(header.Value))
	}
	lines = append(lines, hurlOptionLines(request)...)
	lines = append(lines, body.sections...)
	if body.text != "" {
		lines = append(lines, body.text)
	}
	assertions, left := hurlAssertLines(request.Assertions)
	captures, skipped := hurlCaptureLines(request.Extractors)
	if len(assertions) > 0 || len(captures) > 0 {
		lines = append(lines, "", hurlAnyStatus)
	}
	if len(assertions) > 0 {
		lines = append(lines, "[Asserts]")
		lines = append(lines, assertions...)
	}
	if len(captures) > 0 {
		lines = append(lines, "[Captures]")
		lines = append(lines, captures...)
	}
	for _, comment := range append(left, skipped...) {
		lines = append(lines, hurlComment(comment))
	}
	return strings.Join(lines, "\n") + "\n"
}

func hurlOptionLines(request workspace.Request) []string {
	var lines []string
	if !request.Options.NoFollowRedirects {
		lines = append(lines, "location: true")
	}
	if request.Options.TimeoutMs > 0 {
		lines = append(lines, "max-time: "+strconv.Itoa((request.Options.TimeoutMs+999)/1000))
	}
	if len(lines) == 0 {
		return nil
	}
	return append([]string{"[Options]"}, lines...)
}

type hurlBodyParts struct {
	sections []string
	text     string
}

func hurlBody(request workspace.Request) (hurlBodyParts, string) {
	switch request.BodyType {
	case bodyForm:
		return hurlBodyParts{sections: hurlPairLines("[Form]", enabledRows(readRows(request.Body)), false)}, ""
	case bodyMultipart:
		return hurlBodyParts{sections: hurlPairLines("[MultipartFormData]", enabledRows(readRows(request.Body)), true)}, ""
	case bodyJSON, bodyText, bodyXML:
		text := strings.TrimSpace(normalizeNewlines(request.Body))
		if text == "" {
			return hurlBodyParts{}, ""
		}
		written, ok := hurlBodyText(text, request.BodyType)
		if !ok {
			return hurlBodyParts{}, hurlNoteBody
		}
		return hurlBodyParts{text: written}, ""
	}
	return hurlBodyParts{}, ""
}

func hurlBodyText(text, bodyType string) (string, bool) {
	text = mapPlaceholders(text, hurlPlaceholder)
	if bodyType == bodyJSON && json.Valid([]byte(text)) && (strings.HasPrefix(text, "{") || strings.HasPrefix(text, "[")) {
		return text, true
	}
	if strings.Contains(text, "```") {
		return "", false
	}
	return "```\n" + text + "\n```", true
}

func hurlPairLines(section string, rows []row, files bool) []string {
	if len(rows) == 0 {
		return nil
	}
	lines := []string{section}
	for _, candidate := range rows {
		value := hurlLine(candidate.Value)
		if files && candidate.Type == rowTypeFile {
			value = "file," + hurlLine(attachedName(candidate.FileName)) + ";"
		} else if strings.HasPrefix(strings.TrimSpace(value), "file,") || strings.HasPrefix(strings.TrimSpace(value), "base64,") {
			continue
		}
		lines = append(lines, hurlLine(candidate.Key)+": "+value)
	}
	return lines
}

func hurlAssertLines(source string) ([]string, []string) {
	var rows []assertion
	if source == "" || json.Unmarshal([]byte(source), &rows) != nil {
		return nil, nil
	}
	var lines, left []string
	for _, candidate := range rows {
		if !candidate.Enabled {
			continue
		}
		line, ok := hurlAssertLine(candidate)
		if !ok {
			left = append(left, fmt.Sprintf(hurlNoteAssertLeft, candidate.Expression, candidate.Operator, candidate.Value))
			continue
		}
		lines = append(lines, line)
	}
	return lines, left
}

func hurlQueryOf(expression string) (string, bool, bool) {
	expression = strings.TrimSpace(expression)
	switch {
	case expression == "res.status":
		return "status", true, true
	case expression == "res.responseTime":
		return "duration", true, true
	case expression == "res.url":
		return "url", false, true
	case expression == hurlBodyRoot:
		return "body", false, true
	case strings.HasPrefix(expression, hurlHeaderPrefix):
		return hurlHeaderQuery(strings.TrimPrefix(expression, hurlHeaderPrefix))
	case strings.HasPrefix(expression, hurlBodyRoot+".") || strings.HasPrefix(expression, hurlBodyRoot+"["):
		return "jsonpath " + hurlQuotedArg(hurlJSONRoot+strings.TrimPrefix(expression, hurlBodyRoot)), false, true
	}
	return "", false, false
}

func hurlHeaderQuery(rest string) (string, bool, bool) {
	name := ""
	switch {
	case strings.HasPrefix(rest, `["`) && strings.HasSuffix(rest, `"]`):
		name = rest[2 : len(rest)-2]
	case strings.HasPrefix(rest, "['") && strings.HasSuffix(rest, "']"):
		name = rest[2 : len(rest)-2]
	case strings.HasPrefix(rest, "."):
		name = rest[1:]
	}
	return "header " + hurlQuotedArg(name), false, name != ""
}

func hurlAssertLine(candidate assertion) (string, bool) {
	query, numeric, ok := hurlQueryOf(candidate.Expression)
	if !ok {
		return "", false
	}
	if word, unary := hurlUnaryOperators[candidate.Operator]; unary {
		return query + " " + word, true
	}
	if candidate.Operator == "length" && strings.HasPrefix(query, "jsonpath") {
		return query + " count == " + hurlLiteral(candidate.Value, true), true
	}
	word, known := hurlAssertOperators[candidate.Operator]
	if !known {
		return "", false
	}
	isNumber := numeric || candidate.Operator != "contains" && candidate.Operator != "notContains" && candidate.Operator != "startsWith" && candidate.Operator != "endsWith" && candidate.Operator != "matches"
	return query + " " + word + " " + hurlLiteral(candidate.Value, isNumber), true
}

func hurlLiteral(value string, bare bool) string {
	trimmed := strings.TrimSpace(value)
	if _, err := strconv.ParseFloat(trimmed, 64); err == nil && bare {
		return trimmed
	}
	if bare && (trimmed == "true" || trimmed == "false" || trimmed == "null") {
		return trimmed
	}
	var out strings.Builder
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	if encoder.Encode(mapPlaceholders(singleLine(value), hurlPlaceholder)) != nil {
		return `""`
	}
	return strings.TrimSpace(out.String())
}

func hurlCaptureLines(source string) ([]string, []string) {
	var rules []extractor
	if source == "" || json.Unmarshal([]byte(source), &rules) != nil {
		return nil, nil
	}
	var lines, skipped []string
	for _, rule := range rules {
		if !rule.Enabled || !hurlCaptureName.MatchString(rule.Name) {
			continue
		}
		var query string
		switch {
		case rule.Source == sourceBody && strings.HasPrefix(rule.Expression, hurlJSONRoot):
			query = "jsonpath " + hurlQuotedArg(rule.Expression)
		case rule.Source == sourceHeader && rule.Expression != "":
			query = "header " + hurlQuotedArg(rule.Expression)
		case rule.Source == sourceCookie && rule.Expression != "":
			query = "cookie " + hurlQuotedArg(rule.Expression)
		case rule.Source == sourceStatus:
			query = "status"
		default:
			skipped = append(skipped, fmt.Sprintf(hurlNoteCapture, rule.Name))
			continue
		}
		lines = append(lines, rule.Name+": "+query)
	}
	return lines, skipped
}
