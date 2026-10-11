package mcpclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"sort"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/mcp"
)

const (
	statusOK        = "OK"
	statusToolError = "Tool error"
	statusRefused   = "JSON-RPC error"

	fieldIsError = "isError"

	shownRejection = 300
)

type envelope struct {
	ID     json.RawMessage `json:"id"`
	Method string          `json:"method"`
	Result json.RawMessage `json:"result"`
	Error  *mcp.Failure    `json:"error"`
}

type answer struct {
	status string
	code   int
	header http.Header
	result json.RawMessage
}

type rejection struct {
	answer
	body string
}

type refusal struct {
	answer
	method string
	reason mcp.Failure
}

type refusalBody struct {
	Error mcp.Failure `json:"error"`
}

func hasID(id json.RawMessage) bool {
	return len(id) > 0 && !bytes.Equal(id, []byte("null"))
}

func (e envelope) isRequest() bool {
	return e.Method != "" && hasID(e.ID)
}

func (e envelope) answers(id json.RawMessage) bool {
	if e.Method != "" {
		return false
	}
	return bytes.Equal(e.ID, id) || (e.Error != nil && !hasID(e.ID))
}

func mediaType(header http.Header) string {
	parsed, _, _ := mime.ParseMediaType(header.Get(headerContentType))
	return parsed
}

func flatten(header http.Header) []engine.HeaderEntry {
	names := make([]string, 0, len(header))
	for name := range header {
		names = append(names, name)
	}
	sort.Strings(names)

	entries := []engine.HeaderEntry{}
	for _, name := range names {
		for _, value := range header[name] {
			entries = append(entries, engine.HeaderEntry{Key: name, Value: value})
		}
	}
	return entries
}

func (a answer) response(address, status, contentType string, body []byte) engine.Response {
	return engine.Response{
		Status:       status,
		StatusCode:   a.code,
		Headers:      flatten(a.header),
		Body:         string(body),
		BodyEncoding: engine.EncodingUTF8,
		ContentType:  contentType,
		Size:         int64(len(body)),
		URL:          address,
		Protocol:     Protocol,
	}
}

func (r *rejection) Error() string {
	shown := []rune(strings.TrimSpace(r.body))
	if len(shown) > shownRejection {
		shown = shown[:shownRejection]
	}
	if len(shown) == 0 {
		return fmt.Sprintf("the server answered %s", r.status)
	}
	return fmt.Sprintf("the server answered %s: %s", r.status, string(shown))
}

func (r *rejection) response(address string) engine.Response {
	return r.answer.response(address, r.status, mediaType(r.header), []byte(r.body))
}

func (r *refusal) Error() string {
	return fmt.Sprintf("the server answered %s with error %d: %s", r.method, r.reason.Code, r.reason.Message)
}

func (r *refusal) response(address string) engine.Response {
	body, err := json.Marshal(refusalBody{r.reason})
	if err != nil {
		return engine.Failure(engine.ErrorNetwork, r.Error())
	}
	return r.answer.response(address, statusRefused, typeJSON, body)
}

func withErrorFlag(result json.RawMessage) ([]byte, bool) {
	var fields map[string]json.RawMessage
	if json.Unmarshal(result, &fields) != nil || fields == nil {
		return result, false
	}
	if flag, present := fields[fieldIsError]; present {
		var failed bool
		return result, json.Unmarshal(flag, &failed) == nil && failed
	}
	fields[fieldIsError] = json.RawMessage("false")
	encoded, err := json.Marshal(fields)
	if err != nil {
		return result, false
	}
	return encoded, false
}

func (a answer) outcome(address string) engine.Response {
	body, failed := withErrorFlag(a.result)
	status := statusOK
	if failed {
		status = statusToolError
	}
	return a.response(address, status, typeJSON, body)
}
