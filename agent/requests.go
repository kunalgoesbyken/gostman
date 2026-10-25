package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type listArguments struct {
	Folder string `json:"folder"`
}

type requestLine struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Folder      string   `json:"folder"`
	Method      string   `json:"method"`
	URL         string   `json:"url"`
	Tags        []string `json:"tags,omitempty"`
	HasTests    bool     `json:"hasTests"`
	HasExamples bool     `json:"hasExamples"`
}

type requestList struct {
	Environment string              `json:"environment"`
	Requests    []requestLine       `json:"requests"`
	Problems    []workspace.Problem `json:"problems,omitempty"`
}

type getArguments struct {
	Request string `json:"request"`
}

type exampleLine struct {
	Name   string `json:"name"`
	Status int    `json:"status"`
}

type definition struct {
	ID               string               `json:"id"`
	Name             string               `json:"name"`
	Folder           string               `json:"folder"`
	Method           string               `json:"method"`
	URL              string               `json:"url"`
	Headers          []engine.HeaderEntry `json:"headers"`
	BodyType         string               `json:"bodyType,omitempty"`
	Body             string               `json:"body,omitempty"`
	GraphqlQuery     string               `json:"graphqlQuery,omitempty"`
	GraphqlVariables any                  `json:"graphqlVariables,omitempty"`
	GrpcMethod       string               `json:"grpcMethod,omitempty"`
	GrpcMessage      any                  `json:"grpcMessage,omitempty"`
	McpMethod        string               `json:"mcpMethod,omitempty"`
	McpTool          string               `json:"mcpTool,omitempty"`
	McpArguments     any                  `json:"mcpArguments,omitempty"`
	Auth             map[string]any       `json:"auth,omitempty"`
	Vars             map[string]string    `json:"vars,omitempty"`
	Options          map[string]any       `json:"options,omitempty"`
	Assertions       any                  `json:"assertions,omitempty"`
	Extractors       any                  `json:"extractors,omitempty"`
	PreScript        string               `json:"preScript,omitempty"`
	PostScript       string               `json:"postScript,omitempty"`
	Examples         []exampleLine        `json:"examples,omitempty"`
}

func hasText(text string) bool {
	return strings.TrimSpace(text) != ""
}

func structured(text string) any {
	if !hasText(text) {
		return nil
	}
	if json.Valid([]byte(text)) {
		return json.RawMessage(text)
	}
	return text
}

func examplesOf(request workspace.Request) []exampleLine {
	var examples []exampleLine
	if json.Unmarshal([]byte(request.Examples), &examples) != nil {
		return nil
	}
	return examples
}

func storedRequest(files workspace.Collection, id string) workspace.Request {
	for _, request := range files.Requests {
		if request.Id == id {
			return request
		}
	}
	return workspace.Request{}
}

func describeLine(entry runner.Listed, files workspace.Collection) requestLine {
	request := entry.Request
	return requestLine{
		ID:          request.ID,
		Name:        request.Name,
		Folder:      entry.Folder,
		Method:      request.Method,
		URL:         request.URL,
		Tags:        request.Tags,
		HasTests:    entry.Checks > 0 || hasText(request.PostScript),
		HasExamples: len(examplesOf(storedRequest(files, request.ID))) > 0,
	}
}

func (d *Desk) listRequests(_ context.Context, current scene, arguments listArguments) (requestList, error) {
	listed, err := d.client.catalog.Catalog(current.stored, arguments.Folder)
	if err != nil {
		return requestList{}, err
	}
	list := requestList{
		Environment: d.client.session.Environment(),
		Requests:    make([]requestLine, 0, len(listed)),
		Problems:    d.files.Problems(),
	}
	for _, entry := range listed {
		list.Requests = append(list.Requests, describeLine(entry, current.files))
	}
	return list, nil
}

func savedHeaders(request runner.Request) []engine.HeaderEntry {
	expansion, err := engine.NewExpansion("")
	if err != nil {
		return []engine.HeaderEntry{}
	}
	headers, err := expansion.Headers(request.Headers, engine.Auth{})
	if err != nil {
		return []engine.HeaderEntry{}
	}
	return maskHeaders(headers, isLiteral)
}

func savedBody(request runner.Request) string {
	if request.BodyType == engine.BodyMultipart || request.BodyType == engine.BodyBinary {
		return fmt.Sprintf("(a file body of %d bytes, not shown)", len(request.Body))
	}
	return request.Body
}

func bodyTypeOf(request runner.Request) string {
	if !hasText(request.Body) {
		return ""
	}
	return request.BodyType
}

func graphqlVariables(request runner.Request) any {
	if !hasText(request.GraphqlQuery) {
		return nil
	}
	return structured(request.GraphqlVariables)
}

func withoutEmpty(fields map[string]any) map[string]any {
	for name, value := range fields {
		if nested, isObject := value.(map[string]any); isObject {
			value = withoutEmpty(nested)
			fields[name] = value
		}
		if isEmptySetting(value) {
			delete(fields, name)
		}
	}
	return fields
}

func isEmptySetting(value any) bool {
	nested, isObject := value.(map[string]any)
	return value == false || value == float64(0) || value == "" || value == nil || (isObject && len(nested) == 0)
}

func setFields(value any) map[string]any {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var fields map[string]any
	if json.Unmarshal(encoded, &fields) != nil {
		return nil
	}
	fields = withoutEmpty(fields)
	if len(fields) == 0 {
		return nil
	}
	return fields
}

func changedOptions(options engine.Options) map[string]any {
	return setFields(options)
}

var authSections = map[string]string{
	"oauth2": "oauth2", "awsv4": "aws", "oauth1": "oauth1", "edgegrid": "edgegrid", "jwt": "jwt", "asap": "asap", "hawk": "hawk",
}

func shownAuth(auth engine.Auth) map[string]any {
	if auth.Type == "" {
		return nil
	}
	fields := setFields(maskAuth(auth))
	for _, section := range authSections {
		if section != authSections[auth.Type] {
			delete(fields, section)
		}
	}
	return fields
}

func (d *Desk) find(stored runner.Collection, reference string) (runner.Listed, error) {
	found, err := d.client.Find(stored, reference)
	if err != nil {
		return found, fmt.Errorf("%w. list_requests shows the saved requests with their ids and folders.", err)
	}
	return found, nil
}

func (d *Desk) getRequest(_ context.Context, current scene, arguments getArguments) (definition, error) {
	if !hasText(arguments.Request) {
		return definition{}, errors.New("Name the request by id or name; list_requests shows both.")
	}
	entry, err := d.find(current.stored, arguments.Request)
	if err != nil {
		return definition{}, err
	}
	request := entry.Request
	return definition{
		ID:               request.ID,
		Name:             request.Name,
		Folder:           entry.Folder,
		Method:           request.Method,
		URL:              request.URL,
		Headers:          savedHeaders(request),
		BodyType:         bodyTypeOf(request),
		Body:             savedBody(request),
		GraphqlQuery:     request.GraphqlQuery,
		GraphqlVariables: graphqlVariables(request),
		GrpcMethod:       request.GrpcMethod,
		GrpcMessage:      structured(request.GrpcMessage),
		McpMethod:        request.McpMethod,
		McpTool:          request.McpTool,
		McpArguments:     structured(request.McpArguments),
		Auth:             shownAuth(request.Auth),
		Vars:             request.OwnVariables(),
		Options:          changedOptions(request.Options),
		Assertions:       structured(request.Assertions),
		Extractors:       structured(request.Extractors),
		PreScript:        request.PreScript,
		PostScript:       request.PostScript,
		Examples:         examplesOf(storedRequest(current.files, request.ID)),
	}, nil
}
