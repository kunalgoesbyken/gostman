package mcpclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	statusOK            = "OK"
	statusToolError     = "Tool error"
	statusRefused       = "JSON-RPC error"
	statusInputRequired = "Input required"

	fieldIsError    = "isError"
	fieldStructured = "structuredContent"
	encodedNull     = "null"
	contentText  = "text"

	shownRejection  = 300
	credentialsHint = ". It needs credentials: select Sign in to get a token with OAuth, or set them on the Auth or Headers tab."
)

type envelope struct {
	ID     json.RawMessage `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
	Result json.RawMessage `json:"result"`
	Error  *mcp.Failure    `json:"error"`
}

type notice struct {
	method string
	params json.RawMessage
	at     time.Time
}

type answer struct {
	status  string
	code    int
	header  http.Header
	result  json.RawMessage
	pending bool
	notices []notice
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

func (e envelope) isNotification() bool {
	return e.Method != "" && !hasID(e.ID)
}

func (e envelope) answers(id json.RawMessage) bool {
	if e.Method != "" {
		return false
	}
	return bytes.Equal(e.ID, id) || (e.Error != nil && !hasID(e.ID))
}

func (e envelope) notice() notice {
	return notice{method: e.Method, params: e.Params, at: time.Now()}
}

func (a *answer) take(data []byte, id json.RawMessage, respond func(any) error) (envelope, bool, error) {
	var incoming envelope
	if json.Unmarshal(data, &incoming) != nil {
		return envelope{}, false, nil
	}
	switch {
	case incoming.answers(id):
		return incoming, true, nil
	case incoming.isNotification():
		a.notices = append(a.notices, incoming.notice())
	case incoming.isRequest():
		return envelope{}, false, respond(answerTo(incoming))
	}
	return envelope{}, false, nil
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

func (s *session) respond(a answer, status, contentType string, body []byte, failed bool) engine.Response {
	return engine.Response{
		Status:        status,
		StatusCode:    a.code,
		Headers:       flatten(a.header),
		Body:          string(body),
		BodyEncoding:  engine.EncodingUTF8,
		ContentType:   contentType,
		Size:          int64(len(body)),
		URL:           s.address,
		Protocol:      Protocol,
		Failed:        failed,
		Notifications: s.notices,
	}
}

func (r *rejection) Error() string {
	message := fmt.Sprintf("the server answered %s", r.status)
	shown := []rune(strings.TrimSpace(r.body))
	if len(shown) > shownRejection {
		shown = shown[:shownRejection]
	}
	if len(shown) > 0 && !strings.HasSuffix(strings.ToLower(r.status), strings.ToLower(string(shown))) {
		message += ": " + string(shown)
	}
	if r.code == http.StatusUnauthorized || r.code == http.StatusForbidden {
		message += credentialsHint
	}
	return message
}

func (r *refusal) Error() string {
	return fmt.Sprintf("the server answered %s with error %d: %s", r.method, r.reason.Code, r.reason.Message)
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

func ToolErrorText(body string) string {
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if json.Unmarshal([]byte(body), &result) != nil {
		return ""
	}
	var lines []string
	for _, item := range result.Content {
		if item.Type == contentText && strings.TrimSpace(item.Text) != "" {
			lines = append(lines, item.Text)
		}
	}
	return strings.Join(lines, "\n")
}

func (s *session) outcome(a answer, method string) engine.Response {
	if a.pending {
		return s.respond(a, statusInputRequired, typeJSON, a.result, true)
	}
	if method != MethodCallTool {
		return s.respond(a, statusOK, typeJSON, a.result, false)
	}
	body, failed := withErrorFlag(a.result)
	if failed {
		return s.respond(a, statusToolError, typeJSON, body, true)
	}
	return s.respond(a, statusOK, typeJSON, body, false)
}
