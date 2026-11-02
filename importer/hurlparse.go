package importer

import (
	"strings"
	"unicode"
)

const hurlExtension = ".hurl"

const hurlTokenPunctuation = "!#$%&'*+.^_|~-"

func isHurlToken(text string) bool {
	return text != "" && strings.IndexFunc(text, func(char rune) bool {
		return !unicode.IsLetter(char) && !unicode.IsDigit(char) && !strings.ContainsRune(hurlTokenPunctuation, char)
	}) < 0
}

func hurlRequestParts(line string) (string, string, bool) {
	method, address, found := strings.Cut(line, " ")
	address = strings.TrimSpace(address)
	isMethod := method != "" && strings.IndexFunc(method, func(char rune) bool { return char < 'A' || char > 'Z' }) < 0
	return method, address, found && isMethod && address != ""
}

func hurlResponseStatus(line string) (string, bool) {
	word, rest, _ := strings.Cut(strings.TrimSpace(line), " ")
	if word != "HTTP" && !strings.HasPrefix(word, "HTTP/") {
		return "", false
	}
	fields := strings.Fields(rest)
	return firstOf(fields...), len(fields) > 0
}

func hurlHeaderParts(line string) (string, string, bool) {
	name, value, found := strings.Cut(line, ":")
	name = strings.TrimSpace(name)
	return name, strings.TrimSpace(value), found && isHurlToken(name)
}

func hurlSectionName(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	inner, opened := strings.CutPrefix(trimmed, "[")
	inner, closed := strings.CutSuffix(inner, "]")
	return strings.ToLower(inner), opened && closed && isHurlToken(inner)
}

func isHurlResponseLine(line string) bool {
	_, found := hurlResponseStatus(line)
	return found
}

func isHurlSectionLine(line string) bool {
	_, found := hurlSectionName(line)
	return found
}

type hurlPair struct {
	key   string
	value string
}

type hurlEntry struct {
	comment         string
	method          string
	url             string
	headers         []hurlPair
	sections        map[string][]hurlPair
	body            string
	bodyFile        bool
	status          string
	responseHeaders []hurlPair
	asserts         []string
	captures        []hurlPair
	responseBody    bool
}

type hurlReader struct {
	lines []string
	at    int
}

func parseHurl(source string) []hurlEntry {
	reader := &hurlReader{lines: strings.Split(strings.ReplaceAll(source, "\r\n", "\n"), "\n")}
	var entries []hurlEntry
	for reader.skipBlank(); reader.at < len(reader.lines); reader.skipBlank() {
		entry, ok := reader.entry()
		if ok {
			entries = append(entries, entry)
		}
	}
	return entries
}

func (r *hurlReader) done() bool { return r.at >= len(r.lines) }

func (r *hurlReader) line() string { return strings.TrimRight(r.lines[r.at], " \t") }

func (r *hurlReader) skipBlank() {
	for !r.done() && strings.TrimSpace(r.lines[r.at]) == "" {
		r.at++
	}
}

func isHurlComment(line string) bool { return strings.HasPrefix(strings.TrimSpace(line), "#") }

func (r *hurlReader) entry() (hurlEntry, bool) {
	entry := hurlEntry{sections: map[string][]hurlPair{}}
	for !r.done() && isHurlComment(r.line()) {
		if entry.comment == "" {
			entry.comment = strings.TrimSpace(strings.TrimLeft(strings.TrimSpace(r.line()), "#"))
		}
		r.at++
		r.skipBlank()
	}
	if r.done() {
		return entry, false
	}
	method, address, found := hurlRequestParts(r.line())
	if !found || isHurlResponseLine(r.line()) {
		r.at++
		return entry, false
	}
	entry.method, entry.url = method, address
	r.at++
	r.requestHeaders(&entry)
	r.requestSections(&entry)
	r.requestBody(&entry)
	r.skipBlank()
	r.response(&entry)
	return entry, true
}

func (r *hurlReader) requestHeaders(entry *hurlEntry) {
	for !r.done() {
		line := r.line()
		if isHurlComment(line) {
			r.at++
			continue
		}
		name, value, found := hurlHeaderParts(line)
		if !found {
			return
		}
		entry.headers = append(entry.headers, hurlPair{name, value})
		r.at++
	}
}

func (r *hurlReader) requestSections(entry *hurlEntry) {
	for !r.done() {
		name, found := hurlSectionName(r.line())
		if !found {
			if isHurlComment(r.line()) {
				r.at++
				continue
			}
			return
		}
		r.at++
		entry.sections[name] = append(entry.sections[name], r.pairs()...)
	}
}

func (r *hurlReader) pairs() []hurlPair {
	var pairs []hurlPair
	for !r.done() {
		line := r.line()
		if strings.TrimSpace(line) == "" || isHurlSectionLine(line) || isHurlResponseLine(line) || startsHurlBody(line) {
			return pairs
		}
		r.at++
		if isHurlComment(line) {
			continue
		}
		key, value, found := strings.Cut(line, ":")
		if found {
			pairs = append(pairs, hurlPair{strings.TrimSpace(key), strings.TrimSpace(value)})
		}
	}
	return pairs
}

func (r *hurlReader) requestBody(entry *hurlEntry) {
	if r.done() {
		return
	}
	line := r.line()
	trimmed := strings.TrimSpace(line)
	switch {
	case trimmed == "" || isHurlResponseLine(trimmed):
		return
	case strings.HasPrefix(trimmed, "```"):
		entry.body = r.fenced()
	case strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "["):
		entry.body = r.balanced()
	case strings.HasPrefix(trimmed, "file,") || strings.HasPrefix(trimmed, "base64,") || strings.HasPrefix(trimmed, "hex,"):
		entry.bodyFile = true
		r.at++
	case strings.HasPrefix(trimmed, "`") && strings.HasSuffix(trimmed, "`") && len(trimmed) > 1:
		entry.body = trimmed[1 : len(trimmed)-1]
		r.at++
	case strings.HasPrefix(trimmed, `"`) && strings.HasSuffix(trimmed, `"`) && len(trimmed) > 1:
		entry.body = trimmed[1 : len(trimmed)-1]
		r.at++
	case isHurlRequestLine(trimmed):
		return
	default:
		entry.body = r.untilBlank()
	}
}

func (r *hurlReader) fenced() string {
	var body []string
	r.at++
	for !r.done() && strings.TrimSpace(r.line()) != "```" {
		body = append(body, r.lines[r.at])
		r.at++
	}
	r.at++
	return strings.Join(body, "\n")
}

func (r *hurlReader) untilBlank() string {
	var body []string
	for !r.done() && strings.TrimSpace(r.lines[r.at]) != "" {
		body = append(body, r.lines[r.at])
		r.at++
	}
	return strings.Join(body, "\n")
}

func (r *hurlReader) balanced() string {
	var body []string
	depth, inString, escaped := 0, false, false
	for !r.done() {
		line := r.lines[r.at]
		body = append(body, line)
		r.at++
		for _, char := range line {
			switch {
			case escaped:
				escaped = false
			case inString && char == '\\':
				escaped = true
			case char == '"':
				inString = !inString
			case inString:
			case char == '{' || char == '[':
				depth++
			case char == '}' || char == ']':
				depth--
			}
		}
		if depth <= 0 {
			break
		}
	}
	return strings.Join(body, "\n")
}

func (r *hurlReader) response(entry *hurlEntry) {
	if r.done() {
		return
	}
	status, found := hurlResponseStatus(r.line())
	if !found {
		return
	}
	entry.status = status
	r.at++
	for !r.done() {
		line := r.line()
		if isHurlSectionLine(line) {
			break
		}
		name, value, found := hurlHeaderParts(line)
		if !found {
			break
		}
		entry.responseHeaders = append(entry.responseHeaders, hurlPair{name, value})
		r.at++
	}
	for !r.done() {
		section, found := hurlSectionName(r.line())
		if !found {
			break
		}
		r.at++
		switch section {
		case "asserts":
			entry.asserts = append(entry.asserts, r.assertLines()...)
		case "captures":
			entry.captures = append(entry.captures, r.pairs()...)
		default:
			r.pairs()
		}
	}
	r.responseBodyAfter(entry)
}

func (r *hurlReader) assertLines() []string {
	var asserts []string
	for !r.done() {
		line := strings.TrimSpace(r.line())
		if line == "" || isHurlSectionLine(line) {
			return asserts
		}
		r.at++
		if !isHurlComment(line) {
			asserts = append(asserts, line)
		}
	}
	return asserts
}

func (r *hurlReader) responseBodyAfter(entry *hurlEntry) {
	if r.done() {
		return
	}
	trimmed := strings.TrimSpace(r.line())
	switch {
	case trimmed == "" || isHurlRequestLine(trimmed) && !strings.HasPrefix(trimmed, "{"):
		return
	case strings.HasPrefix(trimmed, "```"):
		r.fenced()
	case strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "["):
		r.balanced()
	default:
		r.untilBlank()
	}
	entry.responseBody = true
}

func startsHurlBody(line string) bool {
	trimmed := strings.TrimSpace(line)
	return strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") || strings.HasPrefix(trimmed, "`") || strings.HasPrefix(trimmed, "<")
}

func isHurlRequestLine(line string) bool {
	_, _, found := hurlRequestParts(line)
	return found
}
