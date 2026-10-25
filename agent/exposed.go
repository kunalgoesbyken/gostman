package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	toolNameLimit        = 64
	toolDescriptionLimit = 1000
	unnamedTool          = "request"
	nameJoiner           = '_'
	dynamicPrefix        = "$"
	schemeSeparator      = "://"
	pathStarts           = "/?#"
	paragraphBreak       = "\n\n"
)

var (
	safeMethods       = []string{http.MethodGet, http.MethodHead, http.MethodOptions}
	idempotentMethods = []string{http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodPut, http.MethodDelete}
)

type exposure struct {
	requestID   string
	name        string
	method      string
	description string
	parameters  []string
	required    []string
}

type variableRow struct {
	Key     string `json:"key"`
	Value   any    `json:"value"`
	Enabled *bool  `json:"enabled,omitempty"`
}

func isParameterName(name string) bool {
	if name == "" || len(name) > toolNameLimit {
		return false
	}
	for _, r := range name {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '-' {
			return false
		}
	}
	return true
}

func placeholderNames(text string) []string {
	var names []string
	for _, span := range engine.PlaceholderSpans(text) {
		name := strings.TrimSpace(text[span[0]+2 : span[1]-2])
		if _, prompted := engine.PromptName(name); prompted || strings.HasPrefix(name, dynamicPrefix) {
			continue
		}
		if isParameterName(name) && !redact.IsSensitiveName(name) {
			names = append(names, name)
		}
	}
	return names
}

func headerTexts(raw string) []string {
	var texts []string
	for _, header := range headerList(raw) {
		if !isCredentialHeader(header.Key) && !redact.IsSensitiveName(header.Key) {
			texts = append(texts, header.Key, header.Value)
		}
	}
	return texts
}

func addressPath(address string) string {
	start := 0
	if scheme := strings.Index(address, schemeSeparator); scheme >= 0 {
		start = scheme + len(schemeSeparator)
	}
	if end := strings.IndexAny(address[start:], pathStarts); end >= 0 {
		return address[start+end:]
	}
	return ""
}

func parametersOf(request runner.Request) []string {
	texts := append([]string{addressPath(request.URL), request.Body, request.GraphqlQuery, request.GraphqlVariables, request.GrpcMessage, request.McpArguments}, headerTexts(request.Headers)...)
	var names []string
	for _, text := range texts {
		for _, name := range placeholderNames(text) {
			if !slices.Contains(names, name) {
				names = append(names, name)
			}
		}
	}
	return names
}

func toolName(name string) string {
	var built strings.Builder
	joined := true
	for _, r := range strings.ToLower(name) {
		if r < unicode.MaxASCII && (unicode.IsLetter(r) || unicode.IsDigit(r)) {
			built.WriteRune(r)
			joined = false
			continue
		}
		if !joined {
			built.WriteRune(nameJoiner)
			joined = true
		}
	}
	cleaned := strings.Trim(built.String(), string(nameJoiner))
	if len(cleaned) > toolNameLimit {
		cleaned = strings.TrimRight(cleaned[:toolNameLimit], string(nameJoiner))
	}
	if cleaned == "" {
		return unnamedTool
	}
	return cleaned
}

func freeName(wanted string, taken map[string]bool) string {
	name := wanted
	for count := 2; taken[name]; count++ {
		suffix := fmt.Sprintf("%c%d", nameJoiner, count)
		name = wanted[:min(len(wanted), toolNameLimit-len(suffix))] + suffix
	}
	taken[name] = true
	return name
}

func argumentsNote(parameters []string) string {
	if len(parameters) == 0 {
		return "Takes no arguments: any parameter named above keeps its saved value."
	}
	return "Arguments: " + strings.Join(parameters, ", ") + ". Any other parameter named above keeps its saved value."
}

func describeExposed(request runner.Request, stored workspace.Request, parameters []string) string {
	description := strings.TrimSpace(stored.Description)
	if description == "" {
		description = fmt.Sprintf("Send %s %s from the Gostman workspace.", request.Method, request.URL)
	}
	note := argumentsNote(parameters)
	room := max(0, toolDescriptionLimit-len([]rune(note))-len(paragraphBreak))
	if runes := []rune(description); len(runes) > room {
		description = string(runes[:room])
	}
	return description + paragraphBreak + note
}

func (d *Desk) expose(current scene, tags []string) ([]exposure, error) {
	wanted := workspace.NormalizeTags(tags)
	if len(wanted) == 0 {
		return nil, nil
	}
	listed, err := d.client.catalog.Catalog(current.stored, "")
	if err != nil {
		return nil, err
	}
	known := d.client.session.Variables()
	var exposed []exposure
	for _, entry := range listed {
		request := entry.Request
		if !workspace.SharesTag(request.Tags, wanted) {
			continue
		}
		parameters := parametersOf(request)
		item := exposure{
			requestID:   request.ID,
			name:        request.Name,
			method:      request.Method,
			description: describeExposed(request, storedRequest(current.files, request.ID), parameters),
			parameters:  parameters,
		}
		for _, name := range item.parameters {
			if _, defined := known[name]; !defined {
				item.required = append(item.required, name)
			}
		}
		exposed = append(exposed, item)
	}
	if len(exposed) == 0 {
		return nil, fmt.Errorf("--expose-tag: no request has the tag %s", strings.Join(wanted, " or "))
	}
	return exposed, nil
}

func (e exposure) hints() mcp.Hints {
	method := strings.ToUpper(e.method)
	safe := slices.Contains(safeMethods, method)
	return mcp.Hints{
		ReadOnly:    safe,
		Destructive: !safe && method != http.MethodPost,
		Idempotent:  slices.Contains(idempotentMethods, method),
		OpenWorld:   true,
	}
}

func (e exposure) input() schema {
	properties := map[string]schema{}
	for _, name := range e.parameters {
		hint := "Fills {{" + name + "}}. Defaults to the environment's value."
		if slices.Contains(e.required, name) {
			hint = "Fills {{" + name + "}}."
		}
		properties[name] = text(hint)
	}
	return object(properties, e.required...)
}

func argumentText(raw json.RawMessage) string {
	if text, isText := plainValue(raw); isText {
		return text
	}
	return string(raw)
}

func withArguments(existing string, values map[string]string) (string, error) {
	var rows []variableRow
	json.Unmarshal([]byte(existing), &rows)
	rows = slices.DeleteFunc(rows, func(row variableRow) bool { _, replaced := values[row.Key]; return replaced })
	for _, name := range sortedKeys(values) {
		rows = append(rows, variableRow{Key: name, Value: values[name]})
	}
	encoded, err := json.Marshal(rows)
	return string(encoded), err
}

func (d *Desk) checkArgument(name, value string, marked map[string]bool) error {
	label, isCredential := d.credentialIn([]string{value}, marked)
	switch {
	case engine.ReadsFiles(value):
		return fmt.Errorf("Not sent: %s uses {{$file(...)}}, which reads files on this computer; a tool argument cannot.", name)
	case hasPlaceholder(value):
		return fmt.Errorf("Not sent: %s contains {{...}}. Give a plain value; a tool argument cannot refer to variables.", name)
	case isCredential:
		return fmt.Errorf("Not sent: %s contains %s. Give a plain value.", name, labelled(label))
	}
	return nil
}

func (d *Desk) checkArguments(values map[string]string, marked map[string]bool) error {
	for _, name := range sortedKeys(values) {
		if err := d.checkArgument(name, values[name], marked); err != nil {
			return err
		}
	}
	return nil
}

func (d *Desk) sendExposed(ctx context.Context, current scene, item exposure, arguments map[string]json.RawMessage) (Outcome, error) {
	values := map[string]string{}
	for name, raw := range arguments {
		if !slices.Contains(item.parameters, name) {
			return Outcome{}, fmt.Errorf("%q is not a parameter of this tool; it takes %s.", name, strings.Join(item.parameters, ", "))
		}
		values[name] = argumentText(raw)
	}
	if err := d.checkArguments(values, secretNames(current.files.Environments)); err != nil {
		return Outcome{}, err
	}
	target, err := d.client.Find(current.stored, item.requestID)
	if err != nil {
		return Outcome{}, fmt.Errorf("%s is no longer in the workspace: %w", item.name, err)
	}
	if target.Request.Vars, err = withArguments(target.Request.Vars, values); err != nil {
		return Outcome{}, err
	}
	return d.deliver(ctx, target, View{})
}

func (d *Desk) exposedTools(builtIn []mcp.Tool) []mcp.Tool {
	taken := map[string]bool{}
	for _, existing := range builtIn {
		taken[existing.Name] = true
	}
	tools := make([]mcp.Tool, 0, len(d.exposed))
	for _, item := range d.exposed {
		tools = append(tools, tool(d, mcp.Tool{
			Name:        freeName(toolName(item.name), taken),
			Title:       item.name,
			Description: item.description,
			InputSchema: item.input(),
			Hints:       item.hints(),
		}, withSession, func(d *Desk, ctx context.Context, current scene, arguments map[string]json.RawMessage) (Outcome, error) {
			return d.sendExposed(ctx, current, item, arguments)
		}))
	}
	return tools
}
