package scan

import (
	"strings"
	"unicode/utf8"
)

type match struct {
	rule
	value string
}

type judge func(value string) []match

type delimiters struct {
	open  string
	close string
}

var referenceDelimiters = []delimiters{{"{{", "}}"}, {"${", "}"}}

func withoutReferences(text string) string {
	for _, pair := range referenceDelimiters {
		text = blank(text, pair)
	}
	return text
}

func blank(text string, pair delimiters) string {
	var out strings.Builder
	for {
		start := strings.Index(text, pair.open)
		if start < 0 {
			out.WriteString(text)
			return out.String()
		}
		end := strings.Index(text[start+len(pair.open):], pair.close)
		if end < 0 {
			out.WriteString(text)
			return out.String()
		}
		out.WriteString(text[:start])
		out.WriteByte(' ')
		text = text[start+len(pair.open)+end+len(pair.close):]
	}
}

func hasReference(text string) bool {
	return withoutReferences(text) != text
}

func isWordRune(r rune) bool {
	return r < utf8.RuneSelf && (alphanumeric.has(r) || r == '_' || r == '-' || r == '.')
}

func words(text string) []string {
	found := strings.FieldsFunc(text, func(r rune) bool { return !isWordRune(r) })
	for index, word := range found {
		found[index] = strings.TrimRight(word, ".-")
	}
	return found
}

func detect(text string) []match {
	stripped := withoutReferences(text)
	matches := blockMatches(stripped)
	tokens := words(stripped)
	for index := range tokens {
		if found, ok := tokenMatch(tokens, index); ok {
			matches = append(matches, found)
		}
	}
	return matches
}

func tokenMatch(tokens []string, index int) (match, bool) {
	token := tokens[index]
	if isPlaceholder(token) {
		return match{}, false
	}
	for _, candidate := range formats {
		if candidate.accepts(token) {
			return match{candidate.rule, token}, true
		}
	}
	if index == 0 {
		return match{}, false
	}
	for _, candidate := range schemes {
		if candidate.accepts(tokens[index-1], token) {
			return match{candidate.rule, token}, true
		}
	}
	return match{}, false
}

func blockMatches(text string) []match {
	var found []match
	for _, candidate := range blocks {
		found = append(found, candidate.find(text)...)
	}
	return found
}

func (b block) find(text string) []match {
	var found []match
	for rest := text; ; {
		start := strings.Index(rest, b.Opening)
		if start < 0 {
			return found
		}
		rest = rest[start:]
		header, ok := b.header(rest)
		if !ok {
			rest = rest[len(b.Opening):]
			continue
		}
		whole := b.extent(rest, header)
		if !isPlaceholder(whole) {
			found = append(found, match{b.rule, whole})
		}
		rest = rest[header:]
	}
}

func (b block) header(text string) (int, bool) {
	end := strings.Index(text, b.Closing)
	if end < len(b.Opening) {
		return 0, false
	}
	label := text[len(b.Opening):end]
	if strings.IndexFunc(label, func(r rune) bool { return r != ' ' && !upper.has(r) }) >= 0 {
		return 0, false
	}
	return end + len(b.Closing), true
}

func (b block) extent(text string, header int) string {
	trailer := strings.Index(text[header:], b.Trailer)
	if trailer < 0 {
		return text[:header]
	}
	return text[:header+trailer+len(b.Trailer)]
}
