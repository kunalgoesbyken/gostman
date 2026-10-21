package importer

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/krockxz/gostman/workspace"
)

const (
	harVersion  = "1.2"
	httpVersion = "HTTP/1.1"
	unknownMime = "x-unknown"
)

type harPair struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type harParam struct {
	Name        string `json:"name"`
	Value       string `json:"value,omitempty"`
	FileName    string `json:"fileName,omitempty"`
	ContentType string `json:"contentType,omitempty"`
}

type harPost struct {
	MimeType string     `json:"mimeType"`
	Text     string     `json:"text,omitempty"`
	Params   []harParam `json:"params,omitempty"`
}

type harRequest struct {
	Method      string    `json:"method"`
	URL         string    `json:"url"`
	HTTPVersion string    `json:"httpVersion"`
	Cookies     []harPair `json:"cookies"`
	Headers     []harPair `json:"headers"`
	QueryString []harPair `json:"queryString"`
	PostData    *harPost  `json:"postData,omitempty"`
	HeadersSize int       `json:"headersSize"`
	BodySize    int       `json:"bodySize"`
}

type harContent struct {
	Size     int    `json:"size"`
	MimeType string `json:"mimeType"`
}

type harResponse struct {
	Status      int        `json:"status"`
	StatusText  string     `json:"statusText"`
	HTTPVersion string     `json:"httpVersion"`
	Cookies     []harPair  `json:"cookies"`
	Headers     []harPair  `json:"headers"`
	Content     harContent `json:"content"`
	RedirectURL string     `json:"redirectURL"`
	HeadersSize int        `json:"headersSize"`
	BodySize    int        `json:"bodySize"`
}

type harTimings struct {
	Send    int `json:"send"`
	Wait    int `json:"wait"`
	Receive int `json:"receive"`
}

type harEntry struct {
	Started  string      `json:"startedDateTime"`
	Time     int         `json:"time"`
	Request  harRequest  `json:"request"`
	Response harResponse `json:"response"`
	Cache    struct{}    `json:"cache"`
	Timings  harTimings  `json:"timings"`
}

func exportHAR(collection workspace.Collection) ([]File, error) {
	started := time.Now().UTC().Format(time.RFC3339)
	entries := []harEntry{}
	for _, request := range orderedRequests(collection) {
		entries = append(entries, harEntryOf(request, started))
	}
	document := map[string]any{"log": map[string]any{
		"version": harVersion,
		"creator": map[string]string{"name": exportName, "version": "1"},
		"entries": entries,
	}}
	encoded, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return nil, err
	}
	return []File{{Name: "requests.har", Text: string(encoded) + "\n"}}, nil
}

func harEntryOf(request workspace.Request, started string) harEntry {
	method := request.Method
	if method == methodGraphQL {
		method = "POST"
	}
	headers := harPairs(enabledRows(readRows(request.Headers)))
	post := harPostOf(request)
	if post != nil && !hasHeader(headers, "content-type") {
		headers = append(headers, harPair{Name: "Content-Type", Value: post.MimeType})
	}
	return harEntry{
		Started: started,
		Request: harRequest{
			Method: method, URL: request.URL, HTTPVersion: httpVersion, Cookies: []harPair{}, Headers: headers,
			QueryString: harQuery(request.URL), PostData: post, HeadersSize: -1, BodySize: -1,
		},
		Response: harResponse{
			HTTPVersion: httpVersion, Cookies: []harPair{}, Headers: []harPair{},
			Content: harContent{MimeType: unknownMime}, HeadersSize: -1, BodySize: -1,
		},
	}
}

func hasHeader(headers []harPair, name string) bool {
	for _, header := range headers {
		if strings.EqualFold(header.Name, name) {
			return true
		}
	}
	return false
}

func harPairs(rows []row) []harPair {
	pairs := make([]harPair, len(rows))
	for index, candidate := range rows {
		pairs[index] = harPair{Name: candidate.Key, Value: candidate.Value}
	}
	return pairs
}

func harQuery(address string) []harPair {
	_, query, found := strings.Cut(address, "?")
	pairs := []harPair{}
	if !found {
		return pairs
	}
	query, _, _ = strings.Cut(query, "#")
	for _, part := range strings.Split(query, "&") {
		if part == "" {
			continue
		}
		name, value, _ := strings.Cut(part, "=")
		pairs = append(pairs, harPair{Name: name, Value: value})
	}
	return pairs
}

func harPostOf(request workspace.Request) *harPost {
	if request.Method == methodGraphQL {
		payload := `{"query":` + quoteJSON(request.GraphqlQuery)
		if strings.TrimSpace(request.GraphqlVariables) != "" {
			payload += `,"variables":` + request.GraphqlVariables
		}
		return &harPost{MimeType: "application/json", Text: payload + "}"}
	}
	switch request.BodyType {
	case bodyJSON, bodyText, bodyXML:
		return &harPost{MimeType: bodyMime(request.BodyType), Text: request.Body}
	case bodyForm:
		return &harPost{MimeType: "application/x-www-form-urlencoded", Params: harParamsOf(readRows(request.Body))}
	case bodyMultipart:
		return &harPost{MimeType: "multipart/form-data", Params: harParamsOf(readRows(request.Body))}
	}
	return nil
}

func harParamsOf(rows []row) []harParam {
	params := []harParam{}
	for _, candidate := range enabledRows(rows) {
		param := harParam{Name: candidate.Key, Value: candidate.Value}
		if candidate.Type == rowTypeFile {
			param = harParam{Name: candidate.Key, FileName: candidate.FileName, ContentType: candidate.ContentType}
		}
		params = append(params, param)
	}
	return params
}
