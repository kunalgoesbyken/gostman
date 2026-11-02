package capture

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	harVersion     = "1.2"
	harCreator     = "Gostman"
	harHTTPVersion = "HTTP/1.1"
	harMasked      = "***"
	harNoSize      = -1
)

var harMaskedHeaders = []string{"authorization", "cookie", "proxy-authorization", "set-cookie"}

type harPair struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type harPost struct {
	MimeType string `json:"mimeType"`
	Text     string `json:"text"`
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
	BodySize    int64     `json:"bodySize"`
}

type harContent struct {
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
	Text     string `json:"text"`
	Encoding string `json:"encoding,omitempty"`
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
	BodySize    int64      `json:"bodySize"`
}

type harTimings struct {
	Send    int64 `json:"send"`
	Wait    int64 `json:"wait"`
	Receive int64 `json:"receive"`
}

type harEntry struct {
	StartedDateTime string      `json:"startedDateTime"`
	Time            int64       `json:"time"`
	Request         harRequest  `json:"request"`
	Response        harResponse `json:"response"`
	Cache           struct{}    `json:"cache"`
	Timings         harTimings  `json:"timings"`
	Comment         string      `json:"comment,omitempty"`
}

type harCreatorInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type harLog struct {
	Version string         `json:"version"`
	Creator harCreatorInfo `json:"creator"`
	Entries []harEntry     `json:"entries"`
}

func harPairs(headers []engine.HeaderEntry) []harPair {
	pairs := make([]harPair, 0, len(headers))
	for _, header := range headers {
		value := header.Value
		if isNamed(header, harMaskedHeaders) {
			value = harMasked
		}
		pairs = append(pairs, harPair{Name: header.Key, Value: value})
	}
	return pairs
}

func harQuery(address string) []harPair {
	pairs := []harPair{}
	parsed, err := url.Parse(address)
	if err != nil {
		return pairs
	}
	for name, values := range parsed.Query() {
		for _, value := range values {
			pairs = append(pairs, harPair{Name: name, Value: value})
		}
	}
	return pairs
}

func harRedirect(headers []engine.HeaderEntry) string {
	for _, header := range headers {
		if strings.EqualFold(header.Key, headerLocation) {
			return header.Value
		}
	}
	return ""
}

func (e Exchange) harRequest() harRequest {
	request := harRequest{
		Method:      e.Method,
		URL:         e.URL,
		HTTPVersion: harHTTPVersion,
		Cookies:     []harPair{},
		Headers:     harPairs(e.Request.Headers),
		QueryString: harQuery(e.URL),
		HeadersSize: harNoSize,
		BodySize:    e.Request.Size,
	}
	if e.Request.Body != "" && e.Request.BodyEncoding != engine.EncodingBase64 {
		request.PostData = &harPost{MimeType: e.Request.ContentType, Text: e.Request.Body}
	}
	return request
}

func (e Exchange) harResponse() harResponse {
	content := harContent{Size: e.Response.Size, MimeType: e.Response.ContentType, Text: e.Response.Body}
	if e.Response.BodyEncoding == engine.EncodingBase64 {
		content.Encoding = engine.EncodingBase64
	}
	return harResponse{
		Status:      e.Status,
		StatusText:  http.StatusText(e.Status),
		HTTPVersion: harHTTPVersion,
		Cookies:     []harPair{},
		Headers:     harPairs(e.Response.Headers),
		Content:     content,
		RedirectURL: harRedirect(e.Response.Headers),
		HeadersSize: harNoSize,
		BodySize:    e.Response.Size,
	}
}

func (e Exchange) harEntry() harEntry {
	entry := harEntry{
		StartedDateTime: e.Time.UTC().Format(time.RFC3339Nano),
		Time:            e.DurationMs,
		Request:         e.harRequest(),
		Response:        e.harResponse(),
		Timings:         harTimings{Wait: e.DurationMs},
		Comment:         e.harComment(),
	}
	return entry
}

func (e Exchange) harComment() string {
	var notes []string
	if len(e.Rules) > 0 {
		notes = append(notes, "rules: "+strings.Join(e.Rules, ", "))
	}
	if e.Error != "" {
		notes = append(notes, e.Error)
	}
	return strings.Join(notes, "; ")
}

func HAR(exchanges []Exchange, version string) ([]byte, error) {
	entries := make([]harEntry, 0, len(exchanges))
	for _, exchange := range exchanges {
		if exchange.URL == "" {
			continue
		}
		entries = append(entries, exchange.harEntry())
	}
	return json.MarshalIndent(map[string]harLog{"log": {
		Version: harVersion,
		Creator: harCreatorInfo{Name: harCreator, Version: version},
		Entries: entries,
	}}, "", "  ")
}
