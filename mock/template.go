package mock

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/krockxz/gostman/engine"
)

const (
	maxResponseBody = 10 << 20
	requestScope    = "request."
	jsonMarker      = "json"
)

var errResponseTooLarge = fmt.Errorf("the response is larger than %d MB once the request values are filled in", maxResponseBody>>20)

type renderer struct {
	exchange  *exchange
	variables string
	expansion *engine.Expansion
	written   int
}

func (a answer) render(e *exchange, variables string) (answer, error) {
	filler := &renderer{exchange: e, variables: variables}
	headers := make([]Header, len(a.headers))
	for i, header := range a.headers {
		value, err := filler.fill(header.Value, nil)
		if err != nil {
			return answer{}, err
		}
		headers[i] = Header{Key: header.Key, Value: value}
	}
	a.headers = headers
	if a.binary {
		return a, nil
	}
	body, err := filler.fill(string(a.body), escaperFor(a.headers))
	if err != nil {
		return answer{}, err
	}
	a.body = []byte(body)
	return a, nil
}

func (r *renderer) fill(text string, escape func(string) string) (string, error) {
	spans := engine.PlaceholderSpans(text)
	if len(spans) == 0 {
		return text, nil
	}
	var out strings.Builder
	last := 0
	for _, span := range spans {
		out.WriteString(text[last:span[0]])
		value, err := r.resolve(text[span[0]:span[1]], escape)
		if err != nil {
			return "", err
		}
		out.WriteString(value)
		last = span[1]
		if r.written+out.Len() > maxResponseBody {
			return "", errResponseTooLarge
		}
	}
	out.WriteString(text[last:])
	r.written += out.Len()
	if r.written > maxResponseBody {
		return "", errResponseTooLarge
	}
	return out.String(), nil
}

func (r *renderer) resolve(placeholder string, escape func(string) string) (string, error) {
	name := strings.TrimSpace(placeholder[len(placeholderOpen) : len(placeholder)-len(placeholderOpen)])
	if requested, ok := strings.CutPrefix(name, requestScope); ok {
		value := r.exchange.lookup(requested)
		if escape != nil {
			return escape(value), nil
		}
		return value, nil
	}
	if r.expansion == nil {
		expansion, err := engine.NewExpansion(r.variables)
		if err != nil {
			return "", err
		}
		r.expansion = expansion
	}
	value := r.expansion.Text(placeholder)
	return value, r.expansion.Err()
}

func escaperFor(headers []Header) func(string) string {
	for _, header := range headers {
		if header.Key == headerContentType && strings.Contains(strings.ToLower(header.Value), jsonMarker) {
			return escapeJSON
		}
	}
	return nil
}

func escapeJSON(value string) string {
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(encoded[1 : len(encoded)-1])
}
