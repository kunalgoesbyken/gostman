package importer

import (
	"regexp"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	blueprintFormat  = "FORMAT:"
	blueprintHost    = "HOST:"
	blueprintMethods = "GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT"
)

var (
	blueprintActionWithURI = regexp.MustCompile(`^#+\s*(.*?)\s*\[(` + blueprintMethods + `)\s+(/\S*)\]\s*$`)
	blueprintResource      = regexp.MustCompile(`^#+\s*(.*?)\s*\[(/\S*)\]\s*$`)
	blueprintActionHeading = regexp.MustCompile(`^#+\s*(.*?)\s*\[(` + blueprintMethods + `)\]\s*$`)
	blueprintShorthand     = regexp.MustCompile(`^#+\s*(` + blueprintMethods + `)\s+(/\S*)\s*$`)
	blueprintBareResource  = regexp.MustCompile(`^#+\s*(/\S*)\s*$`)
	blueprintGroup         = regexp.MustCompile(`^#+\s*Group\s+(.+?)\s*$`)
	blueprintHeading       = regexp.MustCompile(`^#+\s*(.+?)\s*$`)
	blueprintItem          = regexp.MustCompile(`^(\s*)[+*-]\s+(\w+)\b\s*(.*)$`)
	blueprintQuery         = regexp.MustCompile(`\{\?([^}]*)\}`)
	blueprintTypeOf        = regexp.MustCompile(`\(([^)]*)\)`)
)

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
			if match := blueprintGroup.FindStringSubmatch(trimmed); match != nil {
				finish()
				groups = append(groups, blueprintGroupItem{name: match[1]})
				resourcePath = ""
				continue
			}
			if match := blueprintActionWithURI.FindStringSubmatch(trimmed); match != nil {
				resourcePath = match[3]
				begin(match[1], match[2], match[3])
			} else if match := blueprintResource.FindStringSubmatch(trimmed); match != nil {
				finish()
				resourcePath = match[2]
			} else if match := blueprintActionHeading.FindStringSubmatch(trimmed); match != nil && resourcePath != "" {
				begin(match[1], match[2], resourcePath)
			} else if match := blueprintShorthand.FindStringSubmatch(trimmed); match != nil {
				resourcePath = match[2]
				begin("", match[1], match[2])
			} else if match := blueprintBareResource.FindStringSubmatch(trimmed); match != nil {
				finish()
				resourcePath = match[1]
			} else if match := blueprintHeading.FindStringSubmatch(trimmed); match != nil && title == "" && len(groups) == 1 && len(groups[0].actions) == 0 {
				title = match[1]
			}
		case current != nil:
			index = readBlueprintItems(lines, index, current)
		}
	}
	finish()
	return title, host, groups
}

func readBlueprintItems(lines []string, at int, action *blueprintAction) int {
	item := blueprintItem.FindStringSubmatch(lines[at])
	if item == nil || item[2] != "Request" {
		return at
	}
	request := blueprintRequest{}
	label := strings.TrimSpace(blueprintTypeOf.ReplaceAllStringFunc(item[3], func(found string) string {
		request.contentType = strings.Trim(found, "()")
		return ""
	}))
	request.name = label
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
		sub := blueprintItem.FindStringSubmatch(line)
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
	if match := blueprintQuery.FindStringSubmatch(address); match != nil {
		for _, name := range strings.Split(match[1], ",") {
			params = append(params, row{Key: strings.TrimSuffix(strings.TrimSpace(name), "*"), Enabled: false})
		}
	}
	address = blueprintQuery.ReplaceAllString(address, "")
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
