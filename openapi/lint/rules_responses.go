package lint

import (
	"net/http"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const defaultResponse = "default"

func responseRules() []Rule {
	return []Rule{
		{ID: "operation-success-response", Severity: SeverityError, Description: "every operation declares a 2xx response", Check: eachOperation(successResponse)},
		{ID: "operation-error-response", Severity: SeverityWarning, Description: "every operation declares a default or 4xx response", Check: eachOperation(errorResponse)},
		{ID: "response-schema", Severity: SeverityWarning, Description: "responses with a body declare a schema", Check: eachOperation(responseSchema)},
		{ID: "request-body-read-method", Severity: SeverityWarning, Description: "GET and DELETE operations have no request body", Check: eachOperation(requestBodyOnRead)},
		{ID: "request-body-example", Severity: SeverityInfo, Description: "request bodies have an example", Check: eachOperation(requestBodyExample)},
	}
}

func statusClass(status string, digit byte) bool {
	return len(status) == 3 && status[0] == digit
}

func hasResponse(op Operation, match func(string) bool) bool {
	for status := range asMap(op.Data["responses"]) {
		if match(status) {
			return true
		}
	}
	return false
}

func successResponse(_ *Spec, op Operation) []Issue {
	if hasResponse(op, func(status string) bool { return statusClass(status, '2') }) {
		return nil
	}
	return []Issue{issueAt(op.Pointer+"/responses", locales.LintResponsesNoSuccess, nil)}
}

func errorResponse(_ *Spec, op Operation) []Issue {
	if hasResponse(op, func(status string) bool { return status == defaultResponse || statusClass(status, '4') }) {
		return nil
	}
	return []Issue{issueAt(op.Pointer+"/responses", locales.LintResponsesNoError, nil)}
}

func responseSchema(s *Spec, op Operation) []Issue {
	responses := asMap(op.Data["responses"])
	var issues []Issue
	for _, status := range sortedKeys(responses) {
		response := s.resolve(responses[status])
		at := op.Pointer + pointer("responses", status)
		if s.V2 {
			issues = append(issues, swaggerResponseSchema(response, op, status, at)...)
			continue
		}
		issues = append(issues, mediaWithoutSchema(asMap(response["content"]), status, at)...)
	}
	return issues
}

func swaggerResponseSchema(response map[string]any, op Operation, status, at string) []Issue {
	if response == nil || response["schema"] != nil || op.Method == strings.ToUpper(http.MethodHead) {
		return nil
	}
	if !statusClass(status, '2') || status == "204" || status == "205" {
		return nil
	}
	return []Issue{issueAt(at, locales.LintResponsesNoSchema, locales.Params{"status": status})}
}

func mediaWithoutSchema(content map[string]any, status, at string) []Issue {
	var issues []Issue
	for _, media := range sortedKeys(content) {
		if item := asMap(content[media]); item != nil && item["schema"] == nil {
			issues = append(issues, issueAt(at+pointer("content", media), locales.LintResponsesMediaWithoutSchema, locales.Params{"status": status, "media": media}))
		}
	}
	return issues
}

func requestBodyOnRead(s *Spec, op Operation) []Issue {
	if op.Method != strings.ToUpper(http.MethodGet) && op.Method != strings.ToUpper(http.MethodDelete) {
		return nil
	}
	if s.V2 {
		return swaggerBodyParameters(s, op)
	}
	if op.Data["requestBody"] == nil {
		return nil
	}
	return []Issue{issueAt(op.Pointer+"/requestBody", locales.LintResponsesBodyOnRead, locales.Params{"method": op.Method})}
}

func swaggerBodyParameters(s *Spec, op Operation) []Issue {
	var issues []Issue
	for _, parameter := range s.Parameters(op) {
		if parameter.In == "body" || parameter.In == "formData" {
			issues = append(issues, issueAt(parameter.Pointer, locales.LintResponsesBodyOnRead, locales.Params{"method": op.Method}))
		}
	}
	return issues
}

func requestBodyExample(s *Spec, op Operation) []Issue {
	body := s.resolve(op.Data["requestBody"])
	content := asMap(body["content"])
	var issues []Issue
	for _, media := range sortedKeys(content) {
		item := asMap(content[media])
		if item != nil && !s.hasExample(item) {
			issues = append(issues, issueAt(op.Pointer+pointer("requestBody", "content", media), locales.LintResponsesNoBodyExample, locales.Params{"media": media}))
		}
	}
	return issues
}

func (s *Spec) hasExample(media map[string]any) bool {
	if media["example"] != nil || media["examples"] != nil {
		return true
	}
	return s.resolve(media["schema"])["example"] != nil
}
