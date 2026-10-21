package runner

import (
	"fmt"

	"github.com/krockxz/gostman/engine"
)

const (
	captureBodyLimit = 64 * 1024
	encodingBase64   = "base64"
)

type CapturedRequest struct {
	Method  string `json:"method"`
	URL     string `json:"url"`
	Headers string `json:"headers"`
	Body    string `json:"body"`
}

type CapturedResponse struct {
	Headers     []engine.HeaderEntry `json:"headers"`
	Body        string               `json:"body"`
	ContentType string               `json:"contentType"`
	Size        int64                `json:"size"`
	Truncated   bool                 `json:"truncated"`
}

type Capture struct {
	Request  CapturedRequest  `json:"request"`
	Response CapturedResponse `json:"response"`
}

func capture(request Request, response engine.Response) *Capture {
	body, truncated := response.Body, response.Truncated
	switch {
	case response.BodyEncoding == encodingBase64:
		body, truncated = fmt.Sprintf("(binary body, %d bytes)", response.Size), false
	case len(body) > captureBodyLimit:
		body, truncated = body[:captureBodyLimit], true
	}
	headers := response.Headers
	if headers == nil {
		headers = []engine.HeaderEntry{}
	}
	return &Capture{
		Request: CapturedRequest{Method: request.Method, URL: request.URL, Headers: request.Headers, Body: request.Body},
		Response: CapturedResponse{
			Headers:     headers,
			Body:        body,
			ContentType: response.ContentType,
			Size:        response.Size,
			Truncated:   truncated,
		},
	}
}
