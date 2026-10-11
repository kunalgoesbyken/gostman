package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/runner"
	"github.com/krockxz/gostman/workspace"
)

type listArguments struct {
	Folder string `json:"folder"`
}

type requestLine struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Folder      string `json:"folder"`
	Method      string `json:"method"`
	URL         string `json:"url"`
	HasTests    bool   `json:"hasTests"`
	HasExamples bool   `json:"hasExamples"`
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
	BodyType         string               `json:"bodyType"`
	Body             string               `json:"body"`
	GraphqlQuery     string               `json:"graphqlQuery,omitempty"`
	GraphqlVariables any                  `json:"graphqlVariables,omitempty"`
	GrpcMethod       string               `json:"grpcMethod,omitempty"`
	GrpcMessage      any                  `json:"grpcMessage,omitempty"`
	McpTool          string               `json:"mcpTool,omitempty"`
	McpArguments     any                  `json:"mcpArguments,omitempty"`
	Auth             *engine.Auth         `json:"auth,omitempty"`
	Options          engine.Options       `json:"options"`
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
		HasTests:    entry.Checks > 0 || hasText(request.PostScript),
		HasExamples: len(examplesOf(storedRequest(files, request.ID))) > 0,
	}
}

func (d *Desk) listRequests(_ context.Context, current scene, arguments listArguments) (requestList, error) {
	listed, err := d.client.session.Catalog(current.stored, arguments.Folder)
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

func graphqlVariables(request runner.Request) any {
	if !hasText(request.GraphqlQuery) {
		return nil
	}
	return structured(request.GraphqlVariables)
}

func shownAuth(auth engine.Auth) *engine.Auth {
	if auth.Type == "" {
		return nil
	}
	masked := maskAuth(auth)
	return &masked
}

func (d *Desk) getRequest(_ context.Context, current scene, arguments getArguments) (definition, error) {
	if !hasText(arguments.Request) {
		return definition{}, errors.New("Name the request by id or name; list_requests shows both.")
	}
	entry, err := d.client.Find(current.stored, arguments.Request)
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
		BodyType:         request.BodyType,
		Body:             savedBody(request),
		GraphqlQuery:     request.GraphqlQuery,
		GraphqlVariables: graphqlVariables(request),
		GrpcMethod:       request.GrpcMethod,
		GrpcMessage:      structured(request.GrpcMessage),
		McpTool:          request.McpTool,
		McpArguments:     structured(request.McpArguments),
		Auth:             shownAuth(request.Auth),
		Options:          request.Options,
		Assertions:       structured(request.Assertions),
		Extractors:       structured(request.Extractors),
		PreScript:        request.PreScript,
		PostScript:       request.PostScript,
		Examples:         examplesOf(storedRequest(current.files, request.ID)),
	}, nil
}
