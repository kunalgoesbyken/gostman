package importer

import (
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/locales"
)

var hurlTemplates = map[string]string{"{{newUuid}}": "{{$guid}}", "{{newDate}}": "{{$isoTimestamp}}"}

var hurlOperators = map[string]string{
	"==": "eq", "!=": "neq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte", "startsWith": "startsWith", "endsWith": "endsWith",
	"contains": "contains", "includes": "contains", "matches": "matches", "exists": "isDefined", "isString": "isString",
	"isNumber": "isNumber", "isInteger": "isNumber", "isFloat": "isNumber", "isBoolean": "isBoolean", "isEmpty": "isEmpty",
}

var hurlNegated = map[string]string{"contains": "notContains", "includes": "notContains", "exists": "isUndefined", "isEmpty": "isNotEmpty", "==": "neq", "!=": "eq"}

var hurlUnary = setOf("exists", "isString", "isNumber", "isInteger", "isFloat", "isBoolean", "isEmpty")

func hurlText(source string) string {
	for from, to := range hurlTemplates {
		source = strings.ReplaceAll(source, from, to)
	}
	return source
}

func (c *collector) readHurl(docs []document) {
	folders := map[string]string{}
	for _, doc := range docs {
		clean, ok := safeRelativePath(doc.file.Name)
		if !ok {
			c.skip(locales.ImporterUnsafePath, locales.Params{"path": doc.file.Name})
			continue
		}
		stem := strings.TrimSuffix(clean, path.Ext(clean))
		c.read(path.Base(stem), FormatHurl, func() {
			folderID, ok := c.httpFolder(stem, folders)
			if !ok {
				c.warnDepth()
				return
			}
			for _, entry := range parseHurl(doc.file.Text) {
				c.hurlRequest(entry, folderID)
			}
		})
	}
}

func hurlRequestName(entry hurlEntry) string {
	target := entry.url
	if parsed, err := url.Parse(entry.url); err == nil && parsed.Host != "" && !strings.Contains(entry.url, "{{") {
		target = requestTarget(parsed.Host, parsed.Path)
	}
	return entry.method + " " + target
}

func (c *collector) hurlRequest(entry hurlEntry, folderID string) {
	name := cleanName(entry.comment, hurlRequestName(entry))
	request := parts{name: name, method: entry.method, url: hurlText(entry.url)}
	for _, header := range entry.headers {
		request.headers = append(request.headers, row{Key: header.key, Value: hurlText(header.value), Enabled: true})
	}
	for _, pair := range entry.sections["query"] {
		request.params = append(request.params, row{Key: pair.key, Value: hurlText(pair.value), Enabled: true})
	}
	if cookies := entry.sections["cookies"]; len(cookies) > 0 {
		request.headers = append(request.headers, row{Key: "Cookie", Value: hurlText(pairsHeader(cookies)), Enabled: true})
	}
	if basic := entry.sections["basicauth"]; len(basic) > 0 {
		auth := credentialsAuth(authBasic, basic[0].key, hurlText(basic[0].value))
		request.auth = &auth
	} else {
		request.auth = c.hurlAuthorization(&request)
	}
	c.hurlBody(&request, entry)
	request.options = c.hurlOptions(entry.sections["options"], name)
	request.assertions, request.extractors = c.hurlChecks(entry, name)
	c.build(request, folderID)
}

func pairsHeader(pairs []hurlPair) string {
	items := make([]string, len(pairs))
	for index, pair := range pairs {
		items[index] = pair.key + "=" + pair.value
	}
	return strings.Join(items, "; ")
}

func (c *collector) hurlAuthorization(request *parts) *engine.Auth {
	for index, header := range request.headers {
		if !strings.EqualFold(header.Key, authorizationHeader) {
			continue
		}
		if auth, ok := headerAuth(header.Value); ok {
			request.headers = append(request.headers[:index:index], request.headers[index+1:]...)
			return &auth
		}
	}
	return nil
}

func (c *collector) hurlBody(request *parts, entry hurlEntry) {
	contentType := ""
	for _, header := range request.headers {
		if strings.EqualFold(header.Key, contentTypeHeader) {
			contentType = header.Value
		}
	}
	switch {
	case len(entry.sections["form"]) > 0 || len(entry.sections["formparams"]) > 0:
		pairs := append(entry.sections["form"], entry.sections["formparams"]...)
		request.bodyType, request.body = bodyForm, jsonList(hurlRows(pairs))
	case len(entry.sections["multipartformdata"]) > 0 || len(entry.sections["multipart"]) > 0:
		rows := hurlMultipart(append(entry.sections["multipartformdata"], entry.sections["multipart"]...))
		request.bodyType, request.body, request.needsFiles = bodyMultipart, jsonList(rows), anyFile(rows)
	case entry.bodyFile:
		c.flag(locales.ImporterForeignFiles, request.name)
	case entry.body != "":
		body := hurlText(entry.body)
		request.body, request.bodyType = body, hurlBodyType(body, contentType)
		if request.bodyType == bodyForm {
			request.body = jsonList(formRows(body))
		}
	}
	if request.bodyType == bodyJSON || request.bodyType == bodyXML {
		request.headers = withoutContentType(request.headers)
	}
}

func hurlBodyType(body, contentType string) string {
	if contentType != "" {
		return bodyTypeOfMime(contentType)
	}
	trimmed := strings.TrimSpace(body)
	switch {
	case strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "["):
		return bodyJSON
	case strings.HasPrefix(trimmed, "<"):
		return bodyXML
	}
	return bodyText
}

func hurlRows(pairs []hurlPair) []row {
	rows := make([]row, 0, len(pairs))
	for _, pair := range pairs {
		rows = append(rows, row{Key: pair.key, Value: hurlText(pair.value), Enabled: true})
	}
	return keyedRows(rows)
}

func hurlMultipart(pairs []hurlPair) []row {
	rows := make([]row, 0, len(pairs))
	for _, pair := range pairs {
		entry := row{Key: pair.key, Value: hurlText(pair.value), Enabled: true}
		if location, isFile := strings.CutPrefix(pair.value, "file,"); isFile {
			location, _, _ = strings.Cut(location, ";")
			entry.Type, entry.Value, entry.FileName = rowTypeFile, "", baseName(strings.TrimSpace(location))
		}
		rows = append(rows, entry)
	}
	return keyedRows(rows)
}

func (c *collector) hurlOptions(pairs []hurlPair, name string) engine.Options {
	options := engine.Options{NoFollowRedirects: true}
	unsupported := false
	for _, pair := range pairs {
		switch pair.key {
		case "location", "location-trusted":
			options.NoFollowRedirects = pair.value != "true"
		case "max-time":
			if seconds, err := strconv.ParseFloat(strings.TrimSuffix(pair.value, "s"), 64); err == nil && seconds > 0 {
				options.TimeoutMs = int(seconds * 1000)
			}
		default:
			unsupported = true
		}
	}
	if unsupported {
		c.flag(locales.ImporterForeignOptions, name)
	}
	return options
}

func (c *collector) hurlChecks(entry hurlEntry, name string) (string, string) {
	var rows []assertion
	var rules []extractor
	left := false
	if entry.status != "" && entry.status != "*" {
		rows = append(rows, responseRow("res.status", "eq", entry.status))
	}
	for _, header := range entry.responseHeaders {
		rows = append(rows, responseRow(`res.headers["`+strings.ToLower(header.key)+`"]`, "eq", hurlText(header.value)))
	}
	for _, line := range entry.asserts {
		if row, ok := hurlAssert(line); ok {
			rows = append(rows, row)
			continue
		}
		left = true
	}
	for _, pair := range entry.captures {
		if rule, ok := hurlCapture(pair); ok {
			rules = append(rules, rule)
			continue
		}
		left = true
	}
	if entry.responseBody {
		left = true
	}
	if left {
		c.flag(locales.ImporterHurlFilters, name)
	}
	return jsonList(rows), jsonList(rules)
}

type hurlQuery struct {
	name string
	arg  string
	rest string
}

func readHurlQuery(text string) (hurlQuery, bool) {
	text = strings.TrimSpace(text)
	name, rest, _ := strings.Cut(text, " ")
	query := hurlQuery{name: name, rest: strings.TrimSpace(rest)}
	switch name {
	case "jsonpath", "header", "cookie", "xpath", "regex", "variable":
		argument, remainder, ok := hurlQuoted(query.rest)
		if !ok {
			return query, false
		}
		query.arg, query.rest = argument, remainder
	}
	return query, true
}

func hurlQuoted(source string) (string, string, bool) {
	if !strings.HasPrefix(source, `"`) {
		return "", source, false
	}
	var value strings.Builder
	escaped := false
	for index := 1; index < len(source); index++ {
		char := source[index]
		switch {
		case escaped:
			value.WriteByte(char)
			escaped = false
		case char == '\\':
			escaped = true
		case char == '"':
			return value.String(), strings.TrimSpace(source[index+1:]), true
		default:
			value.WriteByte(char)
		}
	}
	return "", source, false
}

func hurlExpression(query hurlQuery) (string, bool) {
	switch query.name {
	case "status":
		return "res.status", true
	case "duration":
		return "res.responseTime", true
	case "url":
		return "res.url", true
	case "body":
		return "res.body", true
	case "header":
		return `res.headers["` + strings.ToLower(query.arg) + `"]`, true
	case "jsonpath":
		if !strings.HasPrefix(query.arg, "$") {
			return "", false
		}
		return "res.body" + strings.TrimPrefix(query.arg, "$"), true
	}
	return "", false
}

func hurlAssert(line string) (assertion, bool) {
	query, ok := readHurlQuery(line)
	if !ok {
		return assertion{}, false
	}
	expression, ok := hurlExpression(query)
	if !ok {
		return assertion{}, false
	}
	words := strings.Fields(query.rest)
	operatorAt := -1
	for index, word := range words {
		if _, known := hurlOperators[word]; known || word == "not" {
			operatorAt = index
			break
		}
	}
	if operatorAt < 0 {
		return assertion{}, false
	}
	filters := words[:operatorAt]
	negated := words[operatorAt] == "not"
	if negated {
		operatorAt++
	}
	if operatorAt >= len(words) {
		return assertion{}, false
	}
	word := words[operatorAt]
	operator := hurlOperators[word]
	if negated {
		operator = hurlNegated[word]
	}
	if operator == "" {
		return assertion{}, false
	}
	if len(filters) == 1 && filters[0] == "count" {
		if operator != "eq" {
			return assertion{}, false
		}
		operator = "length"
	} else if len(filters) > 0 {
		return assertion{}, false
	}
	value := ""
	if !hurlUnary[word] {
		_, after, _ := strings.Cut(query.rest, word+" ")
		value = hurlValue(after)
	}
	return responseRow(expression, operator, value), true
}

func hurlValue(source string) string {
	source = strings.TrimSpace(source)
	if quoted, remainder, ok := hurlQuoted(source); ok && remainder == "" {
		return hurlText(quoted)
	}
	if strings.HasPrefix(source, "`") && strings.HasSuffix(source, "`") && len(source) > 1 {
		return hurlText(source[1 : len(source)-1])
	}
	if strings.HasPrefix(source, "/") && strings.HasSuffix(source, "/") && len(source) > 1 {
		return source[1 : len(source)-1]
	}
	return hurlText(source)
}

func hurlCapture(pair hurlPair) (extractor, bool) {
	query, ok := readHurlQuery(pair.value)
	if !ok || query.rest != "" || pair.key == "" {
		return extractor{}, false
	}
	rule := extractor{Name: pair.key, Enabled: true, Scope: scopeSession}
	switch query.name {
	case "jsonpath":
		rule.Source, rule.Expression = sourceBody, query.arg
	case "header":
		rule.Source, rule.Expression = sourceHeader, query.arg
	case "cookie":
		rule.Source, rule.Expression = sourceCookie, query.arg
	case "status":
		rule.Source = sourceStatus
	default:
		return extractor{}, false
	}
	return rule, rule.Source == sourceStatus || rule.Expression != ""
}
