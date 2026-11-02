package importer

import (
	"regexp"
	"strings"
)

const hurlExtension = ".hurl"

var (
	hurlRequestLine  = regexp.MustCompile(`^([A-Z]+)[ \t]+(\S.*)$`)
	hurlResponseLine = regexp.MustCompile(`^HTTP(?:/[0-9.]+)?[ \t]+(\S+)`)
	hurlHeaderLine   = regexp.MustCompile(`^([A-Za-z0-9!#$%&'*+.^_|~-]+)[ \t]*:[ \t]*(.*)$`)
	hurlSectionLine  = regexp.MustCompile(`^\[(\w+)\]\s*$`)
)

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
	match := hurlRequestLine.FindStringSubmatch(r.line())
	if match == nil || hurlResponseLine.MatchString(r.line()) {
		r.at++
		return entry, false
	}
	entry.method, entry.url = match[1], strings.TrimSpace(match[2])
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
		match := hurlHeaderLine.FindStringSubmatch(line)
		if match == nil {
			return
		}
		entry.headers = append(entry.headers, hurlPair{match[1], strings.TrimSpace(match[2])})
		r.at++
	}
}

func (r *hurlReader) requestSections(entry *hurlEntry) {
	for !r.done() {
		match := hurlSectionLine.FindStringSubmatch(r.line())
		if match == nil {
			if isHurlComment(r.line()) {
				r.at++
				continue
			}
			return
		}
		name := strings.ToLower(match[1])
		r.at++
		entry.sections[name] = append(entry.sections[name], r.pairs()...)
	}
}

func (r *hurlReader) pairs() []hurlPair {
	var pairs []hurlPair
	for !r.done() {
		line := r.line()
		if strings.TrimSpace(line) == "" || hurlSectionLine.MatchString(line) || hurlResponseLine.MatchString(line) || startsHurlBody(line) {
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
	case trimmed == "" || hurlResponseLine.MatchString(trimmed):
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
	case hurlRequestLine.MatchString(trimmed):
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
	match := hurlResponseLine.FindStringSubmatch(r.line())
	if match == nil {
		return
	}
	entry.status = match[1]
	r.at++
	for !r.done() {
		line := r.line()
		if hurlSectionLine.MatchString(line) {
			break
		}
		header := hurlHeaderLine.FindStringSubmatch(line)
		if header == nil {
			break
		}
		entry.responseHeaders = append(entry.responseHeaders, hurlPair{header[1], strings.TrimSpace(header[2])})
		r.at++
	}
	for !r.done() {
		section := hurlSectionLine.FindStringSubmatch(r.line())
		if section == nil {
			break
		}
		r.at++
		switch strings.ToLower(section[1]) {
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
		if line == "" || hurlSectionLine.MatchString(line) {
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
	case trimmed == "" || hurlRequestLine.MatchString(trimmed) && !strings.HasPrefix(trimmed, "{"):
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
