package lint

import (
	"net/url"
	"strings"
)

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func asList(v any) []any {
	list, _ := v.([]any)
	return list
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func asBool(v any) bool {
	b, _ := v.(bool)
	return b
}

func blank(v any) bool {
	return strings.TrimSpace(asString(v)) == ""
}

func escapeToken(token string) string {
	return strings.ReplaceAll(strings.ReplaceAll(token, "~", "~0"), "/", "~1")
}

func unescapeToken(token string) string {
	if decoded, err := url.PathUnescape(token); err == nil {
		token = decoded
	}
	return strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
}

func pointer(tokens ...string) string {
	var out strings.Builder
	for _, token := range tokens {
		out.WriteByte('/')
		out.WriteString(escapeToken(token))
	}
	return out.String()
}
