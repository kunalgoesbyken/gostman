package mock

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/openapi"
)

const (
	pathParameter   = "path"
	defaultExample  = "default"
	defaultStatus   = 200
	successClassMin = 200
	successClassMax = 299
)

func FromSpec(ctx context.Context, source openapi.Source, options openapi.Options) (Spec, error) {
	document, err := openapi.Load(ctx, source, options)
	if err != nil {
		return Spec{}, err
	}
	operations := document.Operations()
	if len(operations) > maxRoutes {
		return Spec{}, fmt.Errorf("the spec defines %d operations, but the mock server serves at most %d routes", len(operations), maxRoutes)
	}
	base := basePathOf(document.BaseURL())
	spec := Spec{Title: document.Info.Title, Sources: make([]Source, 0, len(operations))}
	for _, operation := range operations {
		spec.Sources = append(spec.Sources, specSource(document, operation, base))
	}
	return spec, nil
}

func basePathOf(address string) string {
	parsed, err := url.Parse(address)
	if err != nil {
		return ""
	}
	return strings.TrimRight(parsed.Path, pathSeparator)
}

func specSource(document *openapi.Document, operation *openapi.Operation, base string) Source {
	request := document.GenerateRequest(operation)
	source := Source{
		ID:       operation.Key,
		Name:     request.Name,
		Method:   operation.Method,
		Path:     base + operation.Path,
		Examples: request.Examples,
	}
	if !strings.Contains(operation.Path, templateOpen) && source.Examples != "" {
		return source
	}
	detail := document.Detail(operation)
	source.Types = pathKinds(detail)
	if source.Examples == "" {
		source.Examples = emptyExamples(detail)
	}
	return source
}

func pathKinds(detail openapi.Detail) map[string]string {
	kinds := map[string]string{}
	for _, parameter := range detail.Parameters {
		if parameter.In == pathParameter && parameter.Schema != nil {
			kinds[parameter.Name] = parameter.Schema.Type
		}
	}
	return kinds
}

func emptyExamples(detail openapi.Detail) string {
	status := defaultStatus
	for _, response := range detail.Responses {
		if code, err := strconv.Atoi(response.Status); err == nil && code >= successClassMin && code <= successClassMax {
			status = code
			break
		}
	}
	encoded, _ := json.Marshal([]Example{{ID: defaultExample, Name: strconv.Itoa(status), Status: status, IsDefault: true}})
	return string(encoded)
}
