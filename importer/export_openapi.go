package importer

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	openAPIVersion = "3.0.3"
	exportVersion  = "1.0.0"
)

var openAPIMethods = map[string]bool{"get": true, "put": true, "post": true, "delete": true, "options": true, "head": true, "patch": true, "trace": true}

var reservedOpenAPIHeaders = map[string]bool{"accept": true, "content-type": true, "authorization": true}

func exportOpenAPI(collection workspace.Collection) ([]File, error) {
	paths := map[string]map[string]any{}
	schemes := map[string]any{}
	servers := []map[string]string{}
	knownServers := map[string]bool{}
	operationIDs := map[string]bool{}
	for _, request := range orderedRequests(collection) {
		method := strings.ToLower(request.Method)
		if request.Method == methodGraphQL {
			method = "post"
		}
		if !openAPIMethods[method] {
			continue
		}
		origin, route := splitOrigin(request.URL)
		if origin != "" && !knownServers[origin] {
			knownServers[origin] = true
			servers = append(servers, map[string]string{"url": origin})
		}
		if paths[route] == nil {
			paths[route] = map[string]any{}
		}
		if _, taken := paths[route][method]; taken {
			continue
		}
		paths[route][method] = openAPIOperation(request, route, schemes, operationIDs)
	}
	document := map[string]any{
		"openapi": openAPIVersion,
		"info":    map[string]string{"title": exportName + " export", "version": exportVersion},
		"paths":   paths,
	}
	if len(servers) > 0 {
		document["servers"] = servers
	}
	if len(schemes) > 0 {
		document["components"] = map[string]any{"securitySchemes": schemes}
	}
	encoded, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return nil, err
	}
	return []File{{Name: "openapi.json", Text: string(encoded) + "\n"}}, nil
}

func splitOrigin(address string) (string, string) {
	base, _, _ := strings.Cut(address, "?")
	base, _, _ = strings.Cut(base, "#")
	if strings.HasPrefix(base, variableOpen) {
		if end := strings.Index(base, variableClose); end >= 0 {
			end += len(variableClose)
			return base[:end], openAPIPath(base[end:])
		}
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Host == "" {
		return "", openAPIPath(base)
	}
	return parsed.Scheme + "://" + parsed.Host, openAPIPath(parsed.EscapedPath())
}

func openAPIPath(route string) string {
	converted := mapVariables(route, func(inner string) string { return "{" + strings.TrimSpace(inner) + "}" })
	if strings.HasPrefix(converted, "/") {
		return converted
	}
	return "/" + converted
}

func openAPIOperation(request workspace.Request, route string, schemes map[string]any, operationIDs map[string]bool) map[string]any {
	operation := map[string]any{
		"summary":     oneLine(request.Name),
		"operationId": uniqueOperationID(request.Name, operationIDs),
		"responses":   map[string]any{"default": map[string]string{"description": "Response"}},
	}
	if request.Description != "" {
		operation["description"] = request.Description
	}
	if tags := workspace.NormalizeTags(request.Tags); len(tags) > 0 {
		operation["tags"] = tags
	}
	if parameters := openAPIParameters(request, route); len(parameters) > 0 {
		operation["parameters"] = parameters
	}
	if body := openAPIBody(request); body != nil {
		operation["requestBody"] = body
	}
	if name, scheme := securityScheme(request.Auth); name != "" {
		schemes[name] = scheme
		operation["security"] = []map[string][]string{{name: {}}}
	}
	return operation
}

func uniqueOperationID(name string, used map[string]bool) string {
	base := variableName(strings.ReplaceAll(safeStem(name, fallbackStem), " ", "_"))
	for attempt := 1; ; attempt++ {
		candidate := base
		if attempt > 1 {
			candidate = fmt.Sprintf("%s_%d", base, attempt)
		}
		if !used[candidate] {
			used[candidate] = true
			return candidate
		}
	}
}

func openAPIParameters(request workspace.Request, route string) []map[string]any {
	var parameters []map[string]any
	add := func(location, name string, required bool, example string) {
		parameters = append(parameters, map[string]any{
			"name": name, "in": location, "required": required, "schema": map[string]string{"type": "string"}, "example": example,
		})
	}
	for _, candidate := range harQuery(request.URL) {
		add("query", candidate.Name, false, candidate.Value)
	}
	for _, candidate := range disabledOnly(readRows(request.QueryParams)) {
		add("query", candidate.Key, false, candidate.Value)
	}
	for _, candidate := range enabledRows(readRows(request.Headers)) {
		if !reservedOpenAPIHeaders[strings.ToLower(candidate.Key)] {
			add("header", candidate.Key, false, candidate.Value)
		}
	}
	mapVariables(route, func(inner string) string {
		add("path", strings.TrimSpace(inner), true, "")
		return inner
	})
	return parameters
}

func openAPIBody(request workspace.Request) map[string]any {
	mime := ""
	var example any
	switch {
	case request.Method == methodGraphQL:
		mime, example = "application/json", map[string]string{"query": request.GraphqlQuery}
	case request.BodyType == bodyJSON:
		mime, example = "application/json", jsonExample(request.Body)
	case request.BodyType == bodyXML || request.BodyType == bodyText:
		mime, example = bodyMime(request.BodyType), request.Body
	case request.BodyType == bodyForm || request.BodyType == bodyMultipart:
		mime = map[string]string{bodyForm: "application/x-www-form-urlencoded", bodyMultipart: "multipart/form-data"}[request.BodyType]
		return map[string]any{"content": map[string]any{mime: map[string]any{"schema": formSchema(readRows(request.Body))}}}
	default:
		return nil
	}
	return map[string]any{"content": map[string]any{mime: map[string]any{"example": example}}}
}

func jsonExample(body string) any {
	var decoded any
	if json.Unmarshal([]byte(body), &decoded) != nil {
		return body
	}
	return decoded
}

func formSchema(rows []row) map[string]any {
	properties := map[string]any{}
	for _, candidate := range enabledRows(rows) {
		property := map[string]string{"type": "string"}
		if candidate.Type == rowTypeFile {
			property["format"] = "binary"
		}
		properties[candidate.Key] = property
	}
	return map[string]any{"type": "object", "properties": properties}
}

func securityScheme(auth engine.Auth) (string, map[string]any) {
	switch auth.Type {
	case authBasic:
		return "basicAuth", map[string]any{"type": "http", "scheme": "basic"}
	case authBearer:
		return "bearerAuth", map[string]any{"type": "http", "scheme": "bearer"}
	case authDigest:
		return "digestAuth", map[string]any{"type": "http", "scheme": "digest"}
	case authAPIKey:
		location := "header"
		if auth.In == inQuery {
			location = "query"
		}
		return "apiKeyAuth", map[string]any{"type": "apiKey", "in": location, "name": auth.Key}
	}
	return "", nil
}
