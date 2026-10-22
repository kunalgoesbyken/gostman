package mock

import (
	"math"
	"net/url"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	pathSeparator   = "/"
	schemeSeparator = "://"
	pathEnd         = "?#"
	parameterPrefix = ":"
	templateOpen    = "{"
	templateClose   = "}"
	placeholderOpen = "{{"
	wildcardKey     = "\x00"
	literalRank     = '0'
	wildcardRank    = '1'
)

const (
	kindInteger = "integer"
	kindNumber  = "number"
	kindBoolean = "boolean"
)

type segment struct {
	text     string
	name     string
	kind     string
	wildcard bool
}

type pattern []segment

func routePattern(rawURL string) pattern {
	afterBase := withoutLeadingPlaceholder(strings.TrimSpace(rawURL))
	return parsePattern(withoutOrigin(afterBase))
}

func templatePattern(path string, kinds map[string]string) pattern {
	shape := parsePattern(path)
	for i, part := range shape {
		shape[i].kind = kinds[part.name]
	}
	return shape
}

func withoutLeadingPlaceholder(text string) string {
	spans := engine.PlaceholderSpans(text)
	if len(spans) == 0 || spans[0][0] != 0 {
		return text
	}
	return text[spans[0][1]:]
}

func withoutOrigin(text string) string {
	if strings.HasPrefix(text, pathSeparator) {
		return text
	}
	authority := text
	scheme := strings.Index(text, schemeSeparator)
	if scheme >= 0 && strings.IndexAny(text, pathSeparator+pathEnd) == scheme+1 {
		authority = text[scheme+len(schemeSeparator):]
	}
	start := strings.IndexAny(authority, pathSeparator+pathEnd)
	if start < 0 {
		return ""
	}
	return authority[start:]
}

func parsePattern(path string) pattern {
	if end := strings.IndexAny(path, pathEnd); end >= 0 {
		path = path[:end]
	}
	shape := pattern{}
	for _, part := range strings.Split(path, pathSeparator) {
		if part != "" {
			shape = append(shape, toSegment(part))
		}
	}
	return shape
}

func toSegment(part string) segment {
	if name, ok := parameterName(part); ok {
		return segment{text: part, name: name, wildcard: true}
	}
	if isTemplated(part) {
		return segment{text: part, wildcard: true}
	}
	return segment{text: unescaped(part)}
}

func parameterName(part string) (string, bool) {
	if name, ok := strings.CutPrefix(part, parameterPrefix); ok && name != "" {
		return name, true
	}
	if spans := engine.PlaceholderSpans(part); len(spans) == 1 && spans[0][0] == 0 && spans[0][1] == len(part) {
		return strings.TrimSpace(part[len(placeholderOpen) : len(part)-len(placeholderOpen)]), true
	}
	if inner, ok := strings.CutPrefix(part, templateOpen); ok {
		name, closed := strings.CutSuffix(inner, templateClose)
		return name, closed && name != "" && !strings.ContainsAny(name, templateOpen+templateClose)
	}
	return "", false
}

func isTemplated(part string) bool {
	if len(engine.PlaceholderSpans(part)) > 0 {
		return true
	}
	open := strings.Index(part, templateOpen)
	return open >= 0 && strings.Contains(part[open:], templateClose)
}

func unescaped(part string) string {
	decoded, err := url.PathUnescape(part)
	if err != nil {
		return part
	}
	return decoded
}

func requestParts(target *url.URL) []string {
	parts := []string{}
	for _, part := range strings.Split(target.EscapedPath(), pathSeparator) {
		if part != "" {
			parts = append(parts, unescaped(part))
		}
	}
	return parts
}

func (p pattern) String() string {
	texts := make([]string, len(p))
	for i, part := range p {
		texts[i] = part.text
	}
	return pathSeparator + strings.Join(texts, pathSeparator)
}

func (p pattern) key() string {
	keys := make([]string, len(p))
	for i, part := range p {
		keys[i] = url.PathEscape(part.text)
		if part.wildcard {
			keys[i] = wildcardKey
		}
	}
	return strings.Join(keys, pathSeparator)
}

func (p pattern) rank() string {
	rank := make([]byte, len(p))
	for i, part := range p {
		rank[i] = literalRank
		if part.wildcard {
			rank[i] = wildcardRank
		}
	}
	return string(rank)
}

func (p pattern) match(parts []string) (map[string]string, bool) {
	if len(p) != len(parts) {
		return nil, false
	}
	var params map[string]string
	for i, part := range p {
		if !part.accepts(parts[i]) {
			return nil, false
		}
		if part.name == "" {
			continue
		}
		if params == nil {
			params = map[string]string{}
		}
		params[part.name] = parts[i]
	}
	return params, true
}

func (s segment) accepts(text string) bool {
	if !s.wildcard {
		return s.text == text
	}
	switch s.kind {
	case kindInteger:
		_, err := strconv.ParseInt(text, 10, 64)
		return err == nil
	case kindNumber:
		number, err := strconv.ParseFloat(text, 64)
		return err == nil && !math.IsNaN(number) && !math.IsInf(number, 0)
	case kindBoolean:
		return text == "true" || text == "false"
	}
	return true
}
