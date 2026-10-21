package agent

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
)

type Draft struct {
	Method   string
	URL      string
	Headers  []engine.HeaderEntry
	Body     string
	BodyType string
}

type draftFields struct {
	Method   string `json:"method"`
	URL      string `json:"url"`
	Headers  string `json:"headers"`
	Body     string `json:"body"`
	BodyType string `json:"bodyType"`
}

func headerRows(headers []engine.HeaderEntry) (string, error) {
	if len(headers) == 0 {
		return "", nil
	}
	encoded, err := json.Marshal(headers)
	return string(encoded), err
}

func methodOrDefault(method string) string {
	method = strings.ToUpper(strings.TrimSpace(method))
	if method == "" {
		return http.MethodGet
	}
	return method
}

func (c *Client) Compose(draft Draft) (runner.Listed, error) {
	if strings.TrimSpace(draft.URL) == "" {
		return runner.Listed{}, errors.New("give the request a url")
	}
	rows, err := headerRows(draft.Headers)
	if err != nil {
		return runner.Listed{}, err
	}
	request, err := c.session.Normalize(draftFields{
		Method:   methodOrDefault(draft.Method),
		URL:      strings.TrimSpace(draft.URL),
		Headers:  rows,
		Body:     draft.Body,
		BodyType: draft.BodyType,
	})
	request.Name = ""
	return runner.Listed{Request: request}, err
}
