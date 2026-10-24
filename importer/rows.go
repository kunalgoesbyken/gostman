package importer

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

const (
	variableOpen  = "{{"
	variableClose = "}}"
	rowTypeFile   = "file"
	rowTypeText   = "text"
)

type row struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Enabled     bool   `json:"enabled"`
	Type        string `json:"type,omitempty"`
	FileName    string `json:"fileName,omitempty"`
	ContentType string `json:"contentType,omitempty"`
}

func jsonList[T any](items []T) string {
	if len(items) == 0 {
		return ""
	}
	encoded, err := json.Marshal(items)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func keyedRows(rows []row) []row {
	var kept []row
	for _, candidate := range rows {
		if strings.TrimSpace(candidate.Key) != "" {
			kept = append(kept, candidate)
		}
	}
	return kept
}

func mapOutsideVariables(text string, transform func(string) string) string {
	var out strings.Builder
	for {
		start := strings.Index(text, variableOpen)
		if start < 0 {
			break
		}
		end := strings.Index(text[start:], variableClose)
		if end < 0 {
			break
		}
		end += start + len(variableClose)
		out.WriteString(transform(text[:start]))
		out.WriteString(text[start:end])
		text = text[end:]
	}
	out.WriteString(transform(text))
	return out.String()
}

func encodeQueryPart(text string) string {
	return mapOutsideVariables(text, func(part string) string {
		return strings.ReplaceAll(url.QueryEscape(part), "+", "%20")
	})
}

func withQuery(base string, params []row) (string, string) {
	var enabled, disabled []row
	for _, param := range keyedRows(params) {
		if param.Enabled {
			enabled = append(enabled, param)
		} else {
			disabled = append(disabled, param)
		}
	}
	return appendQuery(base, enabled), jsonList(disabled)
}

func appendQuery(base string, params []row) string {
	if len(params) == 0 {
		return base
	}
	pairs := make([]string, len(params))
	for index, param := range params {
		pairs[index] = encodeQueryPart(param.Key) + "=" + encodeQueryPart(param.Value)
	}
	separator := "?"
	if strings.Contains(base, "?") {
		separator = "&"
	}
	return base + separator + strings.Join(pairs, "&")
}

func text(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case json.Number:
		return typed.String()
	case bool, int, int64, float64, uint64:
		return fmt.Sprint(typed)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func object(value any) map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return typed
	case map[any]any:
		converted := make(map[string]any, len(typed))
		for key, item := range typed {
			converted[fmt.Sprint(key)] = item
		}
		return converted
	}
	return nil
}

func describedText(value any) string {
	if described := object(value); described != nil {
		return text(described["content"])
	}
	return text(value)
}

func list(value any) []any {
	items, _ := value.([]any)
	return items
}

func objects(value any) []map[string]any {
	var found []map[string]any
	for _, item := range list(value) {
		if entry := object(item); entry != nil {
			found = append(found, entry)
		}
	}
	return found
}

func texts(value any) []string {
	var found []string
	for _, item := range list(value) {
		if object(item) == nil && list(item) == nil {
			found = append(found, text(item))
		}
	}
	return found
}

func flag(value any) bool {
	set, _ := value.(bool)
	return set
}
