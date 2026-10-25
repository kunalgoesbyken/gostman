package agent

import (
	"context"
	"fmt"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	DefaultBodyBytes = 8 << 10
	HighestBodyBytes = 256 << 10

	noteBinary       = "The body is binary and is not shown."
	noteNoMatch      = "The select path matched nothing; the body is not shown. Check the path, or send again without select."
	noteCutAtEdge    = "The response was larger than Gostman reads, so the body is incomplete."
	hintUndefined    = "Placeholders listed in unresolved have no value, so they were left as written. Pass values in variables, or ask the developer to define them in the environment."
	hintRunUndefined = "Some requests were sent with placeholders that have no value, left as written; they are listed under unresolved, here or in failures. Give values in data, or ask the developer to define them in the environment."
	hintSignIn       = "This request needs an OAuth 2.0 sign-in in a browser, which an agent cannot do. Ask the developer to restart gostman mcp with --oauth-token-env NAME or --oauth-refresh-token-env NAME."
	hintRefused      = "Gostman refused the address before sending: this server reaches only localhost, the hosts of the developer's own requests and hosts allowed with --allow-host, and no private address when started with --block-private. Ask the developer to allow the host; do not reach it another way."
)

type View struct {
	Select         string
	MaxBodyBytes   int
	IncludeHeaders bool
	IncludeBinary  bool
}

type BodySummary struct {
	Bytes         int    `json:"bytes"`
	ReturnedBytes int    `json:"returnedBytes"`
	Truncated     bool   `json:"truncated"`
	Encoding      string `json:"encoding"`
	Select        string `json:"select,omitempty"`
	Note          string `json:"note,omitempty"`
	Text          string `json:"text,omitempty"`
}

type Outcome struct {
	Request      string               `json:"request,omitempty"`
	Method       string               `json:"method"`
	URL          string               `json:"url"`
	Status       string               `json:"status"`
	StatusCode   int                  `json:"statusCode"`
	DurationMs   int64                `json:"durationMs"`
	SizeBytes    int64                `json:"sizeBytes"`
	ContentType  string               `json:"contentType"`
	Failed       bool                 `json:"failed"`
	Error        string               `json:"error,omitempty"`
	Unresolved   []string             `json:"unresolved,omitempty"`
	Hint         string               `json:"hint,omitempty"`
	Skipped      string               `json:"skipped,omitempty"`
	Tests        []runner.Check       `json:"tests"`
	Logs         []runner.LogLine     `json:"logs"`
	Headers      []engine.HeaderEntry `json:"headers,omitempty"`
	CookiesSet   []string             `json:"cookiesSet,omitempty"`
	VariablesSet []string             `json:"variablesSet,omitempty"`
	Body         BodySummary          `json:"body"`
	Text         string               `json:"-"`
}

func (v View) limit() int {
	if v.MaxBodyBytes <= 0 {
		return DefaultBodyBytes
	}
	return min(v.MaxBodyBytes, HighestBodyBytes)
}

func changedNames(before, after map[string]string) []string {
	var changed []string
	for name, value := range after {
		if previous, existed := before[name]; !existed || previous != value {
			changed = append(changed, name)
		}
	}
	return sorted(changed)
}

func cookieNames(cookies []engine.CookieInfo) []string {
	names := make([]string, 0, len(cookies))
	for _, cookie := range cookies {
		names = append(names, cookie.Name)
	}
	return sorted(names)
}

func (c *Client) chosenText(response engine.Response, view View) (string, string) {
	if response.Error != "" {
		return "", ""
	}
	if response.BodyEncoding == engine.EncodingBase64 && !view.IncludeBinary {
		return "", noteBinary
	}
	if view.Select == "" {
		return response.Body, ""
	}
	selected, found, err := c.session.Select(response, view.Select)
	if err != nil {
		return "", fmt.Sprintf("The select path could not be applied: %s", err)
	}
	if !found {
		return "", noteNoMatch
	}
	return selected, ""
}

func (c *Client) shownBody(response engine.Response, view View) (BodySummary, string) {
	text, note := c.chosenText(response, view)
	if note == "" && response.Truncated {
		note = noteCutAtEdge
	}
	shown, truncated := c.guard.Excerpt(text, view.limit())
	summary := BodySummary{
		Bytes:         len(text),
		ReturnedBytes: len(shown),
		Truncated:     truncated,
		Encoding:      encodingOf(response, view),
		Select:        view.Select,
		Note:          note,
	}
	return summary, shown
}

func encodingOf(response engine.Response, view View) string {
	if response.BodyEncoding == engine.EncodingBase64 && view.Select == "" {
		return engine.EncodingBase64
	}
	return engine.EncodingUTF8
}

func (o Outcome) Embed(text string) any {
	o.Body.Text = text
	return o
}

func (c *Client) Send(ctx context.Context, listed runner.Listed, view View) (Outcome, error) {
	outcome, _, err := c.Exchange(ctx, listed, view)
	return outcome, err
}

func (c *Client) Exchange(ctx context.Context, listed runner.Listed, view View) (Outcome, engine.Response, error) {
	before := c.session.Variables()
	exchanged := c.session.Send(ctx, listed.Request, listed.Folder)
	c.absorb()
	result, response := exchanged.Result, exchanged.Response
	outcome := Outcome{
		Request:      listed.QualifiedName(),
		Method:       result.Method,
		URL:          result.URL,
		Status:       result.Status,
		StatusCode:   result.StatusCode,
		DurationMs:   result.DurationMs,
		SizeBytes:    response.Size,
		ContentType:  response.ContentType,
		Failed:       result.Failed,
		Error:        result.Error,
		Unresolved:   result.Unresolved,
		Skipped:      result.Skipped,
		Tests:        result.Tests,
		Logs:         result.Logs,
		CookiesSet:   cookieNames(response.Cookies),
		VariablesSet: changedNames(before, c.session.Variables()),
	}
	if view.IncludeHeaders {
		outcome.Headers = maskHeaders(response.Headers, always)
	}
	summary, text := c.shownBody(response, view)
	outcome.Body = summary
	cleaned, err := redact.Clean(c.guard, outcome)
	cleaned.Text = text
	return cleaned, response, err
}
