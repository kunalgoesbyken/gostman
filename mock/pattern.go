package mock

import (
	"net/url"
	"strings"

	"github.com/krockxz/gostman/engine"
)

const (
	pathSeparator   = "/"
	schemeSeparator = "://"
	pathEnd         = "?#"
	parameterPrefix = ":"
	wildcardKey     = "\x00"
	literalRank     = '0'
	wildcardRank    = '1'
)

type segment struct {
	text     string
	wildcard bool
}

type pattern []segment

func routePattern(rawURL string, expand func(string) string) pattern {
	afterBase := withoutLeadingPlaceholder(strings.TrimSpace(rawURL))
	return parsePattern(withoutOrigin(expand(afterBase)))
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
	if isParameter(part) || len(engine.PlaceholderSpans(part)) > 0 {
		return segment{text: part, wildcard: true}
	}
	return segment{text: unescaped(part)}
}

func isParameter(part string) bool {
	return len(part) > len(parameterPrefix) && strings.HasPrefix(part, parameterPrefix)
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

func (p pattern) matches(parts []string) bool {
	if len(p) != len(parts) {
		return false
	}
	for i, part := range p {
		if !part.wildcard && part.text != parts[i] {
			return false
		}
	}
	return true
}
