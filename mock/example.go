package mock

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const (
	encodingBase64    = "base64"
	headerContentType = "Content-Type"
	lowestStatus      = 200
	highestStatus     = 599
)

var recomputedHeaders = map[string]bool{
	"Connection":          true,
	"Content-Length":      true,
	"Date":                true,
	"Keep-Alive":          true,
	"Authorization":       true,
	"Proxy-Authenticate":  true,
	"Set-Cookie":          true,
	"Proxy-Authorization": true,
	"Proxy-Connection":    true,
	"Te":                  true,
	"Trailer":             true,
	"Transfer-Encoding":   true,
	"Upgrade":             true,
	"Www-Authenticate":    true,
}

type answer struct {
	status  int
	headers []Header
	body    []byte
}

func parseExamples(raw string) []Example {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var examples []Example
	if err := json.Unmarshal([]byte(raw), &examples); err != nil {
		return nil
	}
	return examples
}

func selectExample(examples []Example, selectedID string) (Example, bool) {
	if len(examples) == 0 {
		return Example{}, false
	}
	if selectedID != "" {
		for _, example := range examples {
			if example.ID == selectedID {
				return example, true
			}
		}
	}
	for _, example := range examples {
		if example.IsDefault {
			return example, true
		}
	}
	return examples[0], true
}

func answerFrom(example Example) (answer, error) {
	body, err := exampleBody(example)
	if err != nil {
		return answer{}, err
	}
	headers := servedHeaders(example.Headers)
	if example.ContentType != "" && !hasHeader(headers, headerContentType) {
		headers = append(headers, Header{Key: headerContentType, Value: example.ContentType})
	}
	return answer{status: servedStatus(example.Status), headers: headers, body: body}, nil
}

func exampleBody(example Example) ([]byte, error) {
	if example.BodyEncoding != encodingBase64 {
		return []byte(example.Body), nil
	}
	body, err := base64.StdEncoding.DecodeString(example.Body)
	if err != nil {
		return nil, fmt.Errorf("the body of example %q is not valid base64", example.Name)
	}
	return body, nil
}

func servedStatus(status int) int {
	if status < lowestStatus || status > highestStatus {
		return http.StatusOK
	}
	return status
}

func servedHeaders(stored []Header) []Header {
	kept := make([]Header, 0, len(stored))
	for _, header := range stored {
		name := http.CanonicalHeaderKey(strings.TrimSpace(header.Key))
		if name == "" || recomputedHeaders[name] {
			continue
		}
		kept = append(kept, Header{Key: name, Value: header.Value})
	}
	return kept
}

func hasHeader(headers []Header, name string) bool {
	for _, header := range headers {
		if header.Key == name {
			return true
		}
	}
	return false
}

func problem(status int, message string) answer {
	body, _ := json.Marshal(map[string]string{"error": message})
	return answer{
		status:  status,
		headers: []Header{{Key: headerContentType, Value: "application/json"}},
		body:    body,
	}
}
