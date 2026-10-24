package importer

import (
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/openapi"
)

const (
	maxExamples        = 20
	maxExampleName     = 120
	exampleEncoding    = "utf8"
	lowestExampleCode  = 100
	highestExampleCode = 599
)

var (
	unsavedExampleHeaders = map[string]bool{"set-cookie": true, "authorization": true, "proxy-authenticate": true, "www-authenticate": true}
	previewContentTypes   = map[string]string{"json": "application/json", "xml": "application/xml", "html": "text/html", "text": "text/plain"}
)

type exampleDraft struct {
	name        string
	status      string
	headers     []row
	body        string
	contentType string
}

func (c *collector) savedExamples(requestName string, drafts []exampleDraft) string {
	var examples []openapi.Example
	for _, draft := range drafts {
		if len(examples) == maxExamples {
			c.flag(messageTooManyExamples, requestName)
			break
		}
		examples = append(examples, savedExample(draft, len(examples) == 0))
	}
	return jsonList(examples)
}

func savedExample(draft exampleDraft, isDefault bool) openapi.Example {
	status, err := strconv.Atoi(strings.TrimSpace(draft.status))
	if err != nil || status < lowestExampleCode || status > highestExampleCode {
		status = 200
	}
	contentType := draft.contentType
	headers := []openapi.Header{}
	for _, header := range draft.headers {
		if !header.Enabled || unsavedExampleHeaders[strings.ToLower(header.Key)] {
			continue
		}
		if strings.EqualFold(header.Key, "content-type") {
			contentType = strings.TrimSpace(strings.SplitN(header.Value, ";", 2)[0])
		}
		headers = append(headers, openapi.Header{Key: header.Key, Value: header.Value})
	}
	return openapi.Example{
		ID:           newID(),
		Name:         clip(cleanName(draft.name, strconv.Itoa(status)), maxExampleName),
		Status:       status,
		Headers:      headers,
		Body:         draft.body,
		BodyEncoding: exampleEncoding,
		ContentType:  contentType,
		IsDefault:    isDefault,
	}
}

func exampleContentType(kind string) string {
	if contentType, known := previewContentTypes[kind]; known {
		return contentType
	}
	return ""
}
