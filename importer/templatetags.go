package importer

import "strings"

type tagArgument struct {
	text   string
	quoted bool
}

type templateTag struct {
	name string
	args []tagArgument
}

func (t templateTag) arg(index int) string {
	if index < len(t.args) {
		return t.args[index].text
	}
	return ""
}

type tagScanner struct {
	source string
	at     int
}

func parseTemplateTag(inner string) (templateTag, bool) {
	scanner := &tagScanner{source: strings.TrimSpace(inner)}
	tag := templateTag{name: scanner.word()}
	if tag.name == "" {
		return templateTag{}, false
	}
	for scanner.skipSpace(); !scanner.done(); scanner.skipSpace() {
		argument, ok := scanner.argument()
		if !ok {
			return templateTag{}, false
		}
		tag.args = append(tag.args, argument)
		scanner.skipSpace()
		if !scanner.done() && !scanner.consume(',') {
			return templateTag{}, false
		}
	}
	return tag, true
}

func (s *tagScanner) done() bool {
	return s.at >= len(s.source)
}

func (s *tagScanner) skipSpace() {
	for !s.done() && isSpaceByte(s.source[s.at]) {
		s.at++
	}
}

func isSpaceByte(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\r'
}

func (s *tagScanner) consume(expected byte) bool {
	if s.done() || s.source[s.at] != expected {
		return false
	}
	s.at++
	return true
}

func (s *tagScanner) word() string {
	start := s.at
	for !s.done() && (isIdentifierByte(s.source[s.at]) || s.source[s.at] == '-') {
		s.at++
	}
	return s.source[start:s.at]
}

func (s *tagScanner) argument() (tagArgument, bool) {
	if quote := s.source[s.at]; quote == '\'' || quote == '"' {
		return s.quoted(quote)
	}
	start := s.at
	for !s.done() && s.source[s.at] != ',' && !isSpaceByte(s.source[s.at]) {
		s.at++
	}
	return tagArgument{text: s.source[start:s.at]}, s.at > start
}

func (s *tagScanner) quoted(quote byte) (tagArgument, bool) {
	var out strings.Builder
	for s.at++; !s.done(); s.at++ {
		current := s.source[s.at]
		switch {
		case current == '\\' && s.at+1 < len(s.source):
			s.at++
			out.WriteByte(s.source[s.at])
		case current == quote:
			s.at++
			return tagArgument{text: out.String(), quoted: true}, true
		default:
			out.WriteByte(current)
		}
	}
	return tagArgument{}, false
}

func quotedReference(source string) (string, bool) {
	inner, ok := enclosed(strings.TrimSpace(source), "_[", "]")
	if !ok {
		return "", false
	}
	return quotedText(inner)
}
