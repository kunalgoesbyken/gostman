package importer

import (
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	blueprintFormat = "FORMAT:"
	blueprintHost   = "HOST:"
)

const blueprintGroupWord = "Group"

var blueprintMethodSet = setOf("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE", "CONNECT")

type blueprintHeadingKind int

const (
	headingTitle blueprintHeadingKind = iota
	headingGroup
	headingResource
	headingAction
	headingActionWithPath
)

type blueprintHeadingParts struct {
	kind   blueprintHeadingKind
	name   string
	method string
	path   string
}

func parseBlueprintHeading(line string) blueprintHeadingParts {
	text := strings.TrimSpace(strings.TrimLeft(line, "#"))
	if group, found := strings.CutPrefix(text, blueprintGroupWord+" "); found {
		return blueprintHeadingParts{kind: headingGroup, name: strings.TrimSpace(group)}
	}
	name, bracket := text, ""
	if open := strings.LastIndex(text, "["); open >= 0 && strings.HasSuffix(text, "]") {
		name, bracket = strings.TrimSpace(text[:open]), text[open+1:len(text)-1]
	}
	fields := strings.Fields(firstOf(bracket, name))
	return classifyBlueprintHeading(text, name, bracket != "", fields)
}

func classifyBlueprintHeading(text, name string, bracketed bool, fields []string) blueprintHeadingParts {
	switch {
	case len(fields) == 2 && blueprintMethodSet[fields[0]] && strings.HasPrefix(fields[1], "/"):
		heading := blueprintHeadingParts{kind: headingActionWithPath, method: fields[0], path: fields[1]}
		if bracketed {
			heading.name = name
		}
		return heading
	case len(fields) == 1 && bracketed && blueprintMethodSet[fields[0]]:
		return blueprintHeadingParts{kind: headingAction, name: name, method: fields[0]}
	case len(fields) == 1 && strings.HasPrefix(fields[0], "/"):
		heading := blueprintHeadingParts{kind: headingResource, path: fields[0]}
		if bracketed {
			heading.name = name
		}
		return heading
	}
	return blueprintHeadingParts{kind: headingTitle, name: text}
}

func readBlueprintItem(line string) []string {
	trimmed := strings.TrimLeft(line, " \t")
	if len(trimmed) < 3 || !strings.ContainsRune("+*-", rune(trimmed[0])) || trimmed[1] != ' ' {
		return nil
	}
	rest := strings.TrimSpace(trimmed[2:])
	end := strings.IndexFunc(rest, func(char rune) bool { return !unicode.IsLetter(char) })
	if end < 0 {
		end = len(rest)
	}
	if end == 0 {
		return nil
	}
	return []string{line, line[:len(line)-len(trimmed)], rest[:end], strings.TrimSpace(rest[end:])}
}

func contentTypeOf(label string) (string, string) {
	open := strings.Index(label, "(")
	closing := strings.Index(label, ")")
	if open < 0 || closing < open {
		return strings.TrimSpace(label), ""
	}
	return strings.TrimSpace(label[:open] + label[closing+1:]), strings.TrimSpace(label[open+1 : closing])
}

type blueprintRequest struct {
	name        string
	contentType string
	headers     []row
	body        []string
}

type blueprintAction struct {
	name     string
	method   string
	path     string
	requests []blueprintRequest
}

type blueprintGroupItem struct {
	name    string
	actions []blueprintAction
}

func looksLikeBlueprint(name, source string) bool {
	if strings.HasSuffix(strings.ToLower(name), ".apib") {
		return true
	}
	for index, line := range strings.Split(source, "\n") {
		if index > 8 {
			return false
		}
		if strings.HasPrefix(strings.TrimSpace(line), blueprintFormat) {
			return true
		}
	}
	return false
}

func (c *collector) readBlueprint(doc document) {
	title, host, groups := parseBlueprint(doc.file.Text)
	name := cleanName(title, strings.TrimSuffix(doc.file.Name, ".apib"))
	c.read(name, FormatBlueprint, func() {
		c.lead(locales.New(locales.ImporterBlueprintScope, locales.Params{"name": name}))
		settings := c.collectionScope(scope{vars: []row{{Key: ramlBaseURL, Value: host, Enabled: true}}})
		rootID := c.addScopedFolder(name, "", settings)
		for _, group := range groups {
			folderID := rootID
			if group.name != "" {
				folderID = c.addFolder(group.name, rootID)
			}
			for _, action := range group.actions {
				c.blueprintRequests(action, folderID)
			}
		}
	})
}

func parseBlueprint(source string) (string, string, []blueprintGroupItem) {
	lines := strings.Split(strings.ReplaceAll(source, "\r\n", "\n"), "\n")
	var title, host string
	groups := []blueprintGroupItem{{}}
	var resourcePath string
	var current *blueprintAction
	finish := func() {
		if current != nil {
			last := &groups[len(groups)-1]
			last.actions = append(last.actions, *current)
			current = nil
		}
	}
	begin := func(name, method, address string) {
		finish()
		current = &blueprintAction{name: name, method: method, path: address}
	}
	for index := 0; index < len(lines); index++ {
		line := lines[index]
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, blueprintHost):
			host = strings.TrimSpace(strings.TrimPrefix(trimmed, blueprintHost))
		case strings.HasPrefix(trimmed, "#") && !strings.HasPrefix(line, " "):
			heading := parseBlueprintHeading(trimmed)
			switch heading.kind {
			case headingGroup:
				finish()
				groups = append(groups, blueprintGroupItem{name: heading.name})
				resourcePath = ""
			case headingActionWithPath:
				resourcePath = heading.path
				begin(heading.name, heading.method, heading.path)
			case headingResource:
				finish()
				resourcePath = heading.path
			case headingAction:
				if resourcePath != "" {
					begin(heading.name, heading.method, resourcePath)
				}
			case headingTitle:
				if title == "" && len(groups) == 1 && len(groups[0].actions) == 0 {
					title = heading.name
				}
			}
		case current != nil:
			index = readBlueprintItems(lines, index, current)
		}
	}
	finish()
	return title, host, groups
}

func readBlueprintItems(lines []string, at int, action *blueprintAction) int {
	item := readBlueprintItem(lines[at])
	if item == nil || item[2] != "Request" {
		return at
	}
	request := blueprintRequest{}
	request.name, request.contentType = contentTypeOf(item[3])
	indent := len(item[1])
	next := at
	var section string
	var sectionIndent int
	var inline []string
	for next+1 < len(lines) {
		line := lines[next+1]
		if strings.TrimSpace(line) != "" && leadingSpaces(line) <= indent {
			break
		}
		next++
		sub := readBlueprintItem(line)
		switch {
		case sub != nil && (sub[2] == "Headers" || sub[2] == "Body"):
			section, sectionIndent = sub[2], len(sub[1])
		case sub != nil && sub[2] == "Parameters":
			section, sectionIndent = "Parameters", len(sub[1])
		case section != "" && (strings.TrimSpace(line) == "" || leadingSpaces(line) > sectionIndent):
			request.collect(section, line)
		case section == "" && strings.TrimSpace(line) != "":
			inline = append(inline, line)
		}
	}
	if len(request.body) == 0 {
		request.body = inline
	}
	action.requests = append(action.requests, request)
	return next
}

func (r *blueprintRequest) collect(section, line string) {
	switch section {
	case "Headers":
		if key, value, found := strings.Cut(strings.TrimSpace(line), ":"); found {
			r.headers = append(r.headers, row{Key: strings.TrimSpace(key), Value: strings.TrimSpace(value), Enabled: true})
		}
	case "Body":
		r.body = append(r.body, line)
	}
}

func leadingSpaces(line string) int {
	return len(line) - len(strings.TrimLeft(line, " \t"))
}

func blueprintAddress(address string) (string, []row) {
	var params []row
	if open := strings.Index(address, "{?"); open >= 0 {
		if closing := strings.Index(address[open:], "}"); closing >= 0 {
			for _, name := range strings.Split(address[open+2:open+closing], ",") {
				params = append(params, row{Key: strings.TrimSuffix(strings.TrimSpace(name), "*"), Enabled: false})
			}
			address = address[:open] + address[open+closing+1:]
		}
	}
	address = strings.NewReplacer("{", "{{", "}", "}}").Replace(address)
	return "{{" + ramlBaseURL + "}}" + address, keyedRows(params)
}

func (c *collector) blueprintRequests(action blueprintAction, folderID string) {
	address, params := blueprintAddress(action.path)
	base := cleanName(action.name, action.method+" "+action.path)
	requests := action.requests
	if len(requests) == 0 {
		requests = []blueprintRequest{{}}
	}
	for _, source := range requests {
		name := base
		if len(action.requests) > 1 && source.name != "" {
			name = base + " (" + source.name + ")"
		}
		request := parts{name: name, method: action.method, url: address, params: params, headers: source.headers}
		if body := strings.TrimSpace(dedent(source.body)); body != "" {
			request.body = body
			request.bodyType = bodyTypeOfMime(source.contentType)
			if source.contentType == "" {
				request.bodyType = bodyText
			}
			if request.bodyType == bodyForm || request.bodyType == bodyMultipart || request.bodyType == bodyBinary {
				request.bodyType = bodyText
			}
		}
		c.build(request, folderID)
	}
}
