package diff

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/openapi"
)

type Severity string

const (
	Breaking      Severity = "breaking"
	NonBreaking   Severity = "non-breaking"
	Informational Severity = "informational"

	FailBreaking = "breaking"
	FailAny      = "any"
	FailNone     = "none"

	maxChanges = 5000
)

var methods = []string{"get", "put", "post", "delete", "options", "head", "patch", "trace"}

type Change struct {
	Severity Severity `json:"severity"`
	Method   string   `json:"method,omitempty"`
	Path     string   `json:"path,omitempty"`
	Where    string   `json:"where,omitempty"`
	Message  string   `json:"message"`
}

type Report struct {
	Changes       []Change `json:"changes"`
	Breaking      int      `json:"breaking"`
	NonBreaking   int      `json:"nonBreaking"`
	Informational int      `json:"informational"`
	Truncated     bool     `json:"truncated"`
}

type Query struct {
	Old openapi.Source `json:"old"`
	New openapi.Source `json:"new"`
}

type Reply struct {
	Error  string  `json:"error,omitempty"`
	Report *Report `json:"report,omitempty"`
}

func (r Report) Reaches(failOn string) bool {
	if r.Truncated && failOn != FailNone {
		return true
	}
	switch failOn {
	case FailBreaking:
		return r.Breaking > 0
	case FailAny:
		return len(r.Changes) > 0
	}
	return false
}

func Run(ctx context.Context, oldSource, newSource openapi.Source, opt openapi.Options) (Report, error) {
	oldRoot, err := openapi.ReadRoot(ctx, oldSource, opt)
	if err != nil {
		return Report{}, fmt.Errorf("old spec: %w", err)
	}
	newRoot, err := openapi.ReadRoot(ctx, newSource, opt)
	if err != nil {
		return Report{}, fmt.Errorf("new spec: %w", err)
	}
	if err := checkSpec(oldRoot); err != nil {
		return Report{}, fmt.Errorf("old spec: %w", err)
	}
	if err := checkSpec(newRoot); err != nil {
		return Report{}, fmt.Errorf("new spec: %w", err)
	}
	report := Compare(ctx, oldRoot, newRoot)
	if ctx.Err() != nil {
		return Report{}, errors.New("the comparison took too long and was stopped")
	}
	return report, nil
}

func Handle(ctx context.Context, query Query, opt openapi.Options) Reply {
	report, err := Run(ctx, query.Old, query.New, opt)
	if err != nil {
		return Reply{Error: err.Error()}
	}
	return Reply{Report: &report}
}

func checkSpec(root map[string]any) error {
	if root["openapi"] == nil && root["swagger"] == nil {
		return errors.New("the document is not an OpenAPI or Swagger spec")
	}
	return nil
}

type comparison struct {
	resolver
	report Report
	method string
	path   string
}

func (c *comparison) add(severity Severity, where, message string) {
	if len(c.report.Changes) < maxChanges {
		c.report.Changes = append(c.report.Changes, Change{Severity: severity, Method: c.method, Path: c.path, Where: where, Message: message})
	}
	switch severity {
	case Breaking:
		c.report.Breaking++
	case NonBreaking:
		c.report.NonBreaking++
	default:
		c.report.Informational++
	}
}

func Compare(ctx context.Context, oldRoot, newRoot map[string]any) Report {
	c := &comparison{resolver: resolver{old: oldRoot, new: newRoot, budget: newBudget(ctx)}, report: Report{Changes: []Change{}}}
	c.compareInfo()
	c.comparePaths()
	c.compareSecuritySchemes()
	c.sortChanges()
	c.report.Truncated = c.budget.incomplete() || c.report.Breaking+c.report.NonBreaking+c.report.Informational > len(c.report.Changes)
	return c.report
}

func (c *comparison) general(severity Severity, where, message string) {
	c.method, c.path = "", ""
	c.add(severity, where, message)
}

func (c *comparison) compareInfo() {
	oldVersion := textOf(objectOf(c.old["info"])["version"])
	newVersion := textOf(objectOf(c.new["info"])["version"])
	if oldVersion != newVersion {
		c.general(Informational, "info.version", fmt.Sprintf("version changed from %s to %s", oldVersion, newVersion))
	}
	if serversText(c.old) != serversText(c.new) {
		c.general(Informational, "servers", "server addresses changed")
	}
}

func serversText(root map[string]any) string {
	var urls []string
	for _, server := range listOf(root["servers"]) {
		urls = append(urls, textOf(objectOf(server)["url"]))
	}
	if host := textOf(root["host"]); host != "" {
		urls = append(urls, host+textOf(root["basePath"]))
	}
	sort.Strings(urls)
	return strings.Join(urls, ",")
}

func (c *comparison) comparePaths() {
	oldPaths, newPaths := objectOf(c.old["paths"]), objectOf(c.new["paths"])
	for _, path := range sortedKeys(oldPaths) {
		after, kept := newPaths[path]
		if !kept {
			c.removedPath(path, oldPaths[path])
			continue
		}
		c.comparePath(path, objectOf(resolve(c.old, oldPaths[path])), objectOf(resolve(c.new, after)))
	}
	for _, path := range sortedKeys(newPaths) {
		if _, existed := oldPaths[path]; existed {
			continue
		}
		for _, method := range methods {
			if objectOf(resolve(c.new, newPaths[path]))[method] != nil {
				c.method, c.path = strings.ToUpper(method), path
				c.add(NonBreaking, "", "operation added")
			}
		}
	}
}

func (c *comparison) removedPath(path string, item any) {
	found := false
	for _, method := range methods {
		if objectOf(resolve(c.old, item))[method] != nil {
			found = true
			c.method, c.path = strings.ToUpper(method), path
			c.add(Breaking, "", "operation removed")
		}
	}
	if !found {
		c.method, c.path = "", path
		c.add(Breaking, "", "path removed")
	}
}

func sortedKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (c *comparison) comparePath(path string, oldItem, newItem map[string]any) {
	for _, method := range methods {
		c.method, c.path = strings.ToUpper(method), path
		before, after := objectOf(resolve(c.old, oldItem[method])), objectOf(resolve(c.new, newItem[method]))
		switch {
		case before == nil && after == nil:
			continue
		case after == nil:
			c.add(Breaking, "", "operation removed")
		case before == nil:
			c.add(NonBreaking, "", "operation added")
		default:
			c.compareOperation(oldItem, newItem, before, after)
		}
	}
}

func (c *comparison) compareOperation(oldItem, newItem, before, after map[string]any) {
	if after["deprecated"] == true && before["deprecated"] != true {
		c.add(Informational, "", "operation deprecated")
	}
	oldParams := c.parameters(c.old, oldItem, before)
	newParams := c.parameters(c.new, newItem, after)
	c.compareParameters(oldParams, newParams)
	c.compareBody(before, after)
	c.compareResponses(before, after)
	c.compareSecurity(before, after)
}

func (c *comparison) parameters(root map[string]any, item, operation map[string]any) map[string]map[string]any {
	found := map[string]map[string]any{}
	for _, source := range [][]any{listOf(item["parameters"]), listOf(operation["parameters"])} {
		for _, entry := range source {
			parameter := objectOf(resolve(root, entry))
			if parameter != nil {
				found[textOf(parameter["in"])+" "+textOf(parameter["name"])] = parameter
			}
		}
	}
	return found
}

func (c *comparison) compareParameters(before, after map[string]map[string]any) {
	for _, key := range sortedParameterKeys(before) {
		now, kept := after[key]
		if !kept {
			c.add(NonBreaking, "parameter "+key, "parameter removed")
			continue
		}
		was := before[key]
		switch {
		case now["required"] == true && was["required"] != true:
			c.add(Breaking, "parameter "+key, "parameter is now required")
		case now["required"] != true && was["required"] == true:
			c.add(NonBreaking, "parameter "+key, "parameter is no longer required")
		}
		c.schemas(parameterSchema(was), parameterSchema(now), asRequest, "parameter "+key, c.add)
	}
	for _, key := range sortedParameterKeys(after) {
		if _, existed := before[key]; existed {
			continue
		}
		if after[key]["required"] == true {
			c.add(Breaking, "parameter "+key, "required parameter added")
		} else {
			c.add(NonBreaking, "parameter "+key, "optional parameter added")
		}
	}
}

func parameterSchema(parameter map[string]any) any {
	if parameter["schema"] != nil {
		return parameter["schema"]
	}
	return map[string]any{"type": parameter["type"], "enum": parameter["enum"], "format": parameter["format"]}
}

func sortedParameterKeys(values map[string]map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (c *comparison) bodyOf(root map[string]any, operation map[string]any) (map[string]any, bool, bool) {
	body := objectOf(resolve(root, operation["requestBody"]))
	if body != nil {
		return objectOf(body["content"]), body["required"] == true, true
	}
	for _, entry := range listOf(operation["parameters"]) {
		parameter := objectOf(resolve(root, entry))
		if textOf(parameter["in"]) == "body" {
			return map[string]any{"*": map[string]any{"schema": parameter["schema"]}}, parameter["required"] == true, true
		}
	}
	return nil, false, false
}

func (c *comparison) compareBody(before, after map[string]any) {
	oldContent, oldRequired, hadOld := c.bodyOf(c.old, before)
	newContent, newRequired, hasNew := c.bodyOf(c.new, after)
	switch {
	case !hadOld && !hasNew:
		return
	case !hadOld && newRequired:
		c.add(Breaking, "request body", "required request body added")
		return
	case !hadOld:
		c.add(NonBreaking, "request body", "optional request body added")
		return
	case !hasNew:
		c.add(NonBreaking, "request body", "request body removed")
		return
	case newRequired && !oldRequired:
		c.add(Breaking, "request body", "request body is now required")
	}
	for _, media := range sortedKeys(oldContent) {
		next, kept := newContent[media]
		if !kept {
			c.add(Breaking, "request body "+media, "content type no longer accepted")
			continue
		}
		c.schemas(objectOf(oldContent[media])["schema"], objectOf(next)["schema"], asRequest, "request body", c.add)
	}
	for _, media := range sortedKeys(newContent) {
		if _, existed := oldContent[media]; !existed {
			c.add(NonBreaking, "request body "+media, "content type added")
		}
	}
}

func (c *comparison) responseContent(root map[string]any, response any) map[string]any {
	resolved := objectOf(resolve(root, response))
	content := objectOf(resolved["content"])
	if content == nil && resolved["schema"] != nil {
		return map[string]any{"*": map[string]any{"schema": resolved["schema"]}}
	}
	return content
}

func (c *comparison) compareResponses(before, after map[string]any) {
	oldResponses, newResponses := objectOf(before["responses"]), objectOf(after["responses"])
	for _, code := range sortedKeys(oldResponses) {
		next, kept := newResponses[code]
		where := "response " + code
		if !kept {
			severity := NonBreaking
			if strings.HasPrefix(code, "2") {
				severity = Breaking
			}
			c.add(severity, where, "response removed")
			continue
		}
		oldContent, newContent := c.responseContent(c.old, oldResponses[code]), c.responseContent(c.new, next)
		for _, media := range sortedKeys(oldContent) {
			nextMedia, present := newContent[media]
			if !present {
				c.add(Breaking, where+" "+media, "content type no longer returned")
				continue
			}
			c.schemas(objectOf(oldContent[media])["schema"], objectOf(nextMedia)["schema"], asResponse, where, c.add)
		}
	}
	for _, code := range sortedKeys(newResponses) {
		if _, existed := oldResponses[code]; !existed {
			c.add(Informational, "response "+code, "response added")
		}
	}
}

func (c *comparison) requirements(root, operation map[string]any) []string {
	source, defined := operation["security"]
	if !defined {
		source = root["security"]
	}
	var sets []string
	for _, entry := range listOf(source) {
		names := sortedKeys(objectOf(entry))
		sets = append(sets, strings.Join(names, "+"))
	}
	sort.Strings(sets)
	return sets
}

func (c *comparison) compareSecurity(before, after map[string]any) {
	oldSets, newSets := c.requirements(c.old, before), c.requirements(c.new, after)
	switch {
	case strings.Join(oldSets, "|") == strings.Join(newSets, "|"):
		return
	case len(newSets) == 0:
		c.add(NonBreaking, "security", "authentication is no longer required")
	case len(oldSets) == 0:
		c.add(Breaking, "security", "authentication is now required: "+strings.Join(newSets, " or "))
	case containsAll(newSets, oldSets):
		c.add(NonBreaking, "security", "authentication alternative added: "+strings.Join(missing(newSets, oldSets), " or "))
	default:
		c.add(Breaking, "security", fmt.Sprintf("authentication changed from %s to %s", strings.Join(oldSets, " or "), strings.Join(newSets, " or ")))
	}
}

func containsAll(set, subset []string) bool {
	return len(missing(subset, set)) == 0
}

func missing(set, known []string) []string {
	var absent []string
	for _, item := range set {
		found := false
		for _, other := range known {
			found = found || other == item
		}
		if !found {
			absent = append(absent, item)
		}
	}
	return absent
}

func (c *comparison) schemesOf(root map[string]any) map[string]any {
	if components := objectOf(root["components"]); components != nil {
		return objectOf(components["securitySchemes"])
	}
	return objectOf(root["securityDefinitions"])
}

func (c *comparison) compareSecuritySchemes() {
	oldSchemes, newSchemes := c.schemesOf(c.old), c.schemesOf(c.new)
	for _, name := range sortedKeys(oldSchemes) {
		next, kept := newSchemes[name]
		switch {
		case !kept:
			c.general(Breaking, "security scheme "+name, "security scheme removed")
		case textOf(objectOf(oldSchemes[name])["type"]) != textOf(objectOf(next)["type"]):
			c.general(Breaking, "security scheme "+name, "security scheme type changed")
		}
	}
	for _, name := range sortedKeys(newSchemes) {
		if _, existed := oldSchemes[name]; !existed {
			c.general(Informational, "security scheme "+name, "security scheme added")
		}
	}
}

var severityOrder = map[Severity]int{Breaking: 0, NonBreaking: 1, Informational: 2}

func (c *comparison) sortChanges() {
	sort.SliceStable(c.report.Changes, func(first, second int) bool {
		a, b := c.report.Changes[first], c.report.Changes[second]
		if severityOrder[a.Severity] != severityOrder[b.Severity] {
			return severityOrder[a.Severity] < severityOrder[b.Severity]
		}
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		return a.Method < b.Method
	})
}
