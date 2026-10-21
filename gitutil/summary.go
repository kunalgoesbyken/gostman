package gitutil

import (
	"fmt"
	"path"
	"reflect"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

const (
	KindRequest     = "request"
	KindEnvironment = "environment"
	KindFolder      = "folder"
	KindWorkspace   = "workspace"
	KindOther       = "other"
	summaryLimit    = 200
	shortValue      = 60
)

var requestLabels = map[string]string{
	"description":      "description",
	"method":           "method",
	"url":              "URL",
	"queryParams":      "query parameters",
	"headers":          "headers",
	"auth":             "authentication",
	"bodyType":         "body type",
	"body":             "body",
	"graphqlQuery":     "GraphQL query",
	"graphqlVariables": "GraphQL variables",
	"grpcMethod":       "gRPC method",
	"grpcMessage":      "gRPC message",
	"grpcProtos":       "gRPC proto files",
	"mcpTool":          "MCP tool",
	"mcpArguments":     "MCP arguments",
	"options":          "options",
	"extractors":       "extractors",
	"assertions":       "assertions",
	"preScript":        "pre-request script",
	"postScript":       "post-response script",
	"examples":         "examples",
	"order":            "position",
}

var requestOrder = []string{"name", "method", "url", "queryParams", "headers", "auth", "bodyType", "body", "graphqlQuery", "graphqlVariables", "grpcMethod", "grpcMessage", "grpcProtos", "mcpTool", "mcpArguments", "options", "extractors", "assertions", "preScript", "postScript", "examples", "description", "order"}

var showsValues = map[string]bool{"url": true, "method": true}

func kindOf(file string) string {
	clean := path.Clean(strings.ReplaceAll(file, "\\", "/"))
	base := path.Base(clean)
	isYAML := strings.HasSuffix(base, ".yaml") || strings.HasSuffix(base, ".yml")
	switch {
	case !isYAML:
		return KindOther
	case clean == "gostman.yaml":
		return KindWorkspace
	case base == "folder.yaml":
		return KindFolder
	case strings.HasPrefix(clean, "environments/"):
		return KindEnvironment
	}
	return KindRequest
}

func parseDocument(content []byte) map[string]any {
	if len(strings.TrimSpace(string(content))) == 0 {
		return nil
	}
	var document map[string]any
	if err := yaml.Unmarshal(content, &document); err != nil {
		return nil
	}
	return document
}

func textOf(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

func titleOf(file string, before, after map[string]any) string {
	for _, document := range []map[string]any{after, before} {
		if name := textOf(document["name"]); name != "" {
			return name
		}
	}
	base := path.Base(file)
	return strings.TrimSuffix(strings.TrimSuffix(base, ".yaml"), ".yml")
}

func shortChange(before, after any) string {
	a, b := textOf(before), textOf(after)
	if len(a) > shortValue || len(b) > shortValue || strings.ContainsAny(a+b, "\n") {
		return ""
	}
	return fmt.Sprintf(" (%q to %q)", a, b)
}

func sameValue(a, b any) bool {
	return reflect.DeepEqual(a, b)
}

func variableChanges(before, after any) []string {
	first, firstOK := before.(map[string]any)
	second, secondOK := after.(map[string]any)
	if !firstOK && !secondOK {
		if sameValue(before, after) {
			return nil
		}
		return []string{"variables changed"}
	}
	var names []string
	seen := map[string]bool{}
	for name := range first {
		seen[name] = true
		names = append(names, name)
	}
	for name := range second {
		if !seen[name] {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	var lines []string
	for _, name := range names {
		old, hadOld := first[name]
		next, hasNew := second[name]
		switch {
		case !hadOld:
			lines = append(lines, fmt.Sprintf("variable %q added", name))
		case !hasNew:
			lines = append(lines, fmt.Sprintf("variable %q removed", name))
		case !sameValue(old, next):
			lines = append(lines, fmt.Sprintf("variable %q changed", name))
		}
	}
	return lines
}

func Summarize(file string, before, after []byte) []string {
	kind := kindOf(file)
	if kind == KindOther {
		return nil
	}
	old, next := parseDocument(before), parseDocument(after)
	title := fmt.Sprintf("%s %q", kind, titleOf(file, old, next))
	switch {
	case old == nil && next == nil:
		if string(before) == string(after) {
			return nil
		}
		return []string{fmt.Sprintf("%s: changed", title)}
	case old == nil:
		return []string{fmt.Sprintf("%s: added", title)}
	case next == nil:
		return []string{fmt.Sprintf("%s: deleted", title)}
	}
	var lines []string
	if oldName := textOf(old["name"]); oldName != textOf(next["name"]) {
		lines = append(lines, fmt.Sprintf("%s: renamed from %q", title, oldName))
	}
	if kind == KindEnvironment {
		for _, line := range variableChanges(old["variables"], next["variables"]) {
			lines = append(lines, fmt.Sprintf("%s: %s", title, line))
		}
		return lines
	}
	for _, key := range requestOrder {
		label, known := requestLabels[key]
		if !known || sameValue(old[key], next[key]) {
			continue
		}
		detail := ""
		if showsValues[key] {
			detail = shortChange(old[key], next[key])
		}
		lines = append(lines, fmt.Sprintf("%s: %s changed%s", title, label, detail))
	}
	if len(lines) == 0 && !sameValue(old, next) {
		lines = append(lines, fmt.Sprintf("%s: changed", title))
	}
	return lines
}

func (r Repo) headContent(file string) []byte {
	out, err := r.run("show", "HEAD:"+file)
	if err != nil {
		return nil
	}
	return []byte(out)
}

func (r Repo) Summaries(changes []Change) {
	for i := range changes {
		if i >= summaryLimit {
			return
		}
		change := &changes[i]
		if change.Kind == KindOther {
			continue
		}
		if change.Conflict {
			change.Summary = []string{"merge conflict"}
			continue
		}
		var before []byte
		if !change.Untracked && change.Index != "A" {
			before = r.headContent(firstNonEmpty(change.OrigPath, change.Path))
		}
		var after []byte
		if change.Worktree != "D" && change.Index != "D" {
			after = r.readWorktree(change.Path)
		}
		change.Summary = Summarize(change.Path, before, after)
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
