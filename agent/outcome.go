package agent

import (
	"context"
	"fmt"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/redact"
	"github.com/krockxz/gostman/runner"
)

const (
	DefaultBodyBytes = 8 << 10
	HighestBodyBytes = 256 << 10

	noteBinary    = "The body is binary and is not shown."
	noteNoMatch   = "The select path matched nothing; the body is not shown. Check the path, or send again without select."
	noteCutAtEdge = "The response was larger than Gostman reads, so the body is incomplete."
)

type View struct {
	Select         string
	MaxBodyBytes   int
	IncludeHeaders bool
}

type BodySummary struct {
	Bytes         int    `json:"bytes"`
	ReturnedBytes int    `json:"returnedBytes"`
	Truncated     bool   `json:"truncated"`
	Select        string `json:"select,omitempty"`
	Note          string `json:"note,omitempty"`
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
	if response.BodyEncoding == engine.EncodingBase64 {
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
		Select:        view.Select,
		Note:          note,
	}
	return summary, shown
}

func (c *Client) Send(ctx context.Context, listed runner.Listed, view View) (Outcome, error) {
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
	return cleaned, err
}
