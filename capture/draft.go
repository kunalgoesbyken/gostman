package capture

import (
	"crypto/rand"
	"encoding/json"
	"net/url"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mock"
)

const (
	exampleName   = "Captured"
	queryMark     = "?"
	fieldDivider  = "&"
	valueDivider  = "="
	formMediaType = "application/x-www-form-urlencoded"
	jsonMarker    = "json"
	xmlMarker     = "xml"
)

var (
	credentialHeaders = []string{"authorization", "cookie", "proxy-authorization"}
	derivedHeaders    = []string{"accept-encoding", "connection", "content-length"}
	privateHeaders    = []string{"authorization", "proxy-authenticate", "set-cookie", "www-authenticate"}
)

type Draft struct {
	Name       string
	Method     string
	URL        string
	Headers    string
	Body       string
	BodyType   string
	Examples   string
	Withheld   []string
	Incomplete bool
}

type attachment struct {
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	Data        string `json:"data"`
}

func headerName(header engine.HeaderEntry) string {
	return strings.ToLower(strings.TrimSpace(header.Key))
}

func isNamed(header engine.HeaderEntry, names []string) bool {
	return slices.Contains(names, headerName(header))
}

func isDecodedEncoding(header engine.HeaderEntry) bool {
	return headerName(header) == strings.ToLower(headerContentEncoding) && strings.EqualFold(strings.TrimSpace(header.Value), encodingGzip)
}

func withoutQuery(address string) string {
	base, _, _ := strings.Cut(address, queryMark)
	return base
}

func Endpoint(method, address string) string {
	return strings.ToUpper(method) + " " + withoutQuery(address)
}

func (e Exchange) IsSavable() bool {
	return e.Error == "" && !e.Upgraded
}

func (e Exchange) hasWholeResponse() bool {
	return e.IsSavable() && !e.Interrupted && !e.Response.Truncated
}

func (m Message) keptHeaders(unsaved []string) []engine.HeaderEntry {
	kept := []engine.HeaderEntry{}
	for _, header := range m.Headers {
		if !isNamed(header, unsaved) && !isDecodedEncoding(header) {
			kept = append(kept, header)
		}
	}
	return kept
}

func (m Message) withheld() []string {
	var names []string
	for _, header := range m.Headers {
		if isNamed(header, credentialHeaders) && !slices.Contains(names, header.Key) {
			names = append(names, header.Key)
		}
	}
	return names
}

func unescaped(text string) string {
	decoded, err := url.QueryUnescape(text)
	if err != nil {
		return text
	}
	return decoded
}

func formRows(body string) []engine.HeaderEntry {
	rows := []engine.HeaderEntry{}
	for _, field := range strings.Split(body, fieldDivider) {
		if field == "" {
			continue
		}
		key, value, _ := strings.Cut(field, valueDivider)
		rows = append(rows, engine.HeaderEntry{Key: unescaped(key), Value: unescaped(value)})
	}
	return rows
}

func encoded(value any) (string, error) {
	text, err := json.Marshal(value)
	return string(text), err
}

func (m Message) draftBody() (string, string, error) {
	switch {
	case m.Body == "":
		return "", engine.BodyNone, nil
	case m.BodyEncoding == engine.EncodingBase64:
		body, err := encoded(attachment{ContentType: m.ContentType, Data: m.Body})
		return body, engine.BodyBinary, err
	case m.ContentType == formMediaType:
		body, err := encoded(formRows(m.Body))
		return body, engine.BodyForm, err
	case strings.Contains(m.ContentType, jsonMarker):
		return m.Body, engine.BodyJSON, nil
	case strings.Contains(m.ContentType, xmlMarker):
		return m.Body, engine.BodyXML, nil
	default:
		return m.Body, engine.BodyText, nil
	}
}

func (e Exchange) examples() (string, error) {
	if !e.hasWholeResponse() {
		return "", nil
	}
	headers := []mock.Header{}
	for _, header := range e.Response.keptHeaders(privateHeaders) {
		headers = append(headers, mock.Header(header))
	}
	return encoded([]mock.Example{{
		ID:           rand.Text(),
		Name:         exampleName,
		Status:       e.Status,
		Headers:      headers,
		Body:         e.Response.Body,
		BodyEncoding: e.Response.BodyEncoding,
		ContentType:  e.Response.ContentType,
		IsDefault:    true,
	}})
}

func (e Exchange) Draft() (Draft, error) {
	headers, err := encoded(e.Request.keptHeaders(slices.Concat(credentialHeaders, derivedHeaders)))
	if err != nil {
		return Draft{}, err
	}
	body, bodyType, err := e.Request.draftBody()
	if err != nil {
		return Draft{}, err
	}
	examples, err := e.examples()
	if err != nil {
		return Draft{}, err
	}
	return Draft{
		Name:       e.Method + " " + withoutQuery(e.Path),
		Method:     e.Method,
		URL:        e.URL,
		Headers:    headers,
		Body:       body,
		BodyType:   bodyType,
		Examples:   examples,
		Withheld:   e.Request.withheld(),
		Incomplete: e.Request.Truncated,
	}, nil
}
