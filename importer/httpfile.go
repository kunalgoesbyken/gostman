package importer

import (
	"path"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	httpExtension       = ".http"
	restExtension       = ".rest"
	httpSeparator       = "###"
	httpScriptOpen      = "{%"
	httpScriptClose     = "%}"
	httpPreScript       = "<"
	httpPostScript      = ">"
	httpRedirect        = ">>"
	httpHandlerSuffix   = ".js"
	httpVersionMark     = " HTTP/"
	directiveMark       = "@"
	directiveName       = "name"
	directivePrompt     = "prompt"
	directiveNoRedirect = "no-redirect"
	directiveTimeout    = "timeout"
	maxTimeoutDigits    = 7
)

var (
	standardMethods = setOf("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE", "CONNECT")
	timeoutUnits    = map[string]time.Duration{"": time.Second, "s": time.Second, "ms": time.Millisecond, "m": time.Minute}
)

type httpBlock struct {
	name  string
	lines []string
}

type httpSection struct {
	requestLine string
	name        string
	method      string
	url         string
	headers     []row
	body        []string
	description []string
	prompts     map[string]bool
	preScript   string
	postScript  string
	handlerFile bool
	redirect    bool
	options     engine.Options
}

type httpDocument struct {
	variables []row
	sections  []httpSection
}

type lineCursor struct {
	lines []string
	at    int
}

func isHTTPFileName(name string) bool {
	extension := path.Ext(strings.ToLower(name))
	return extension == httpExtension || extension == restExtension
}

func looksLikeHTTP(source string) bool {
	var doc httpDocument
	for _, block := range httpBlocks(normalizeNewlines(source)) {
		section, found := doc.parseBlock(block)
		if !found {
			continue
		}
		method, target, explicit := cutSpace(section.requestLine)
		target = strings.TrimSpace(target)
		hasAddress := strings.HasPrefix(target, "http://") || strings.HasPrefix(target, "https://") || strings.HasPrefix(target, variableOpen)
		return explicit && standardMethods[method] && hasAddress
	}
	return false
}

func parseHTTPFile(source string) httpDocument {
	var doc httpDocument
	for _, block := range httpBlocks(normalizeNewlines(source)) {
		if section, found := doc.parseBlock(block); found {
			doc.sections = append(doc.sections, section)
		}
	}
	return doc
}

func httpBlocks(source string) []httpBlock {
	blocks := []httpBlock{{}}
	for _, line := range strings.Split(source, "\n") {
		if name, isSeparator := separatorName(line); isSeparator {
			blocks = append(blocks, httpBlock{name: name})
			continue
		}
		last := &blocks[len(blocks)-1]
		last.lines = append(last.lines, line)
	}
	return blocks
}

func separatorName(line string) (string, bool) {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, httpSeparator) {
		return "", false
	}
	return strings.TrimSpace(strings.TrimLeft(trimmed, "#")), true
}

func (d *httpDocument) parseBlock(block httpBlock) (httpSection, bool) {
	section := httpSection{name: block.name, prompts: map[string]bool{}}
	cursor := &lineCursor{lines: block.lines}
	if !d.readPreamble(cursor, &section) {
		return section, false
	}
	section.readRequestLine(cursor)
	section.readHeaders(cursor)
	section.readBody(cursor)
	return section, true
}

func (d *httpDocument) readPreamble(cursor *lineCursor, section *httpSection) bool {
	for ; !cursor.done(); cursor.at++ {
		line := cursor.current()
		switch {
		case line == "":
		case isScriptLine(line, httpPreScript):
			section.preScript = joinScripts([]string{section.preScript, cursor.script(httpPreScript)})
		case isComment(line):
			section.readComment(commentText(line))
		case strings.HasPrefix(line, directiveMark):
			d.readVariable(line)
		default:
			return true
		}
	}
	return false
}

func (d *httpDocument) readVariable(line string) {
	name, value, found := strings.Cut(strings.TrimPrefix(line, directiveMark), "=")
	name = strings.TrimSpace(name)
	if !found || name == "" || strings.ContainsFunc(name, unicode.IsSpace) {
		return
	}
	d.variables = append(d.variables, row{Key: name, Value: strings.TrimSpace(value), Enabled: true})
}

func (s *httpSection) readComment(text string) {
	directive, found := strings.CutPrefix(text, directiveMark)
	if !found {
		s.description = append(s.description, text)
		return
	}
	key, value := directiveParts(directive)
	switch key {
	case directiveName:
		if value != "" {
			s.name = value
		}
	case directivePrompt:
		if fields := strings.Fields(value); len(fields) > 0 {
			s.prompts[fields[0]] = true
		}
	case directiveNoRedirect:
		s.options.NoFollowRedirects = true
	case directiveTimeout:
		s.options.TimeoutMs = timeoutMs(value)
	}
}

func directiveParts(directive string) (string, string) {
	end := strings.IndexFunc(directive, func(r rune) bool { return unicode.IsSpace(r) || r == '=' })
	if end < 0 {
		return directive, ""
	}
	value := strings.TrimSpace(directive[end:])
	return directive[:end], strings.TrimSpace(strings.TrimPrefix(value, "="))
}

func timeoutMs(value string) int {
	compact := strings.Join(strings.Fields(value), "")
	digits := strings.TrimRightFunc(compact, unicode.IsLetter)
	amount, err := strconv.Atoi(digits)
	if err != nil || amount <= 0 || len(digits) > maxTimeoutDigits {
		return 0
	}
	return int((time.Duration(amount) * timeoutUnits[compact[len(digits):]]).Milliseconds())
}

func (s *httpSection) readRequestLine(cursor *lineCursor) {
	s.requestLine = cursor.current()
	s.method, s.url = requestLine(s.requestLine)
	for cursor.at++; !cursor.done() && continuesAddress(cursor.lines[cursor.at]); cursor.at++ {
		s.url += cursor.current()
	}
}

func requestLine(line string) (string, string) {
	if index := strings.LastIndex(line, httpVersionMark); index > 0 {
		line = strings.TrimSpace(line[:index])
	}
	method, target, found := cutSpace(line)
	if found && isMethodToken(method) {
		return method, strings.TrimSpace(target)
	}
	return defaultMethod, line
}

func isMethodToken(token string) bool {
	if token == "" || len(token) > maxMethodLength {
		return false
	}
	for _, r := range token {
		if r < 'A' || r > 'Z' {
			return false
		}
	}
	return true
}

func continuesAddress(line string) bool {
	trimmed := strings.TrimSpace(line)
	indented := trimmed != "" && trimmed != line && strings.HasPrefix(trimmed, "/")
	return indented || strings.HasPrefix(trimmed, "?") || strings.HasPrefix(trimmed, "&")
}

func (s *httpSection) readHeaders(cursor *lineCursor) {
	for ; !cursor.done(); cursor.at++ {
		line := cursor.current()
		if line == "" {
			cursor.at++
			return
		}
		if isComment(line) {
			continue
		}
		name, value, found := strings.Cut(line, ":")
		if !found || isScriptLine(line, httpPostScript) || strings.HasPrefix(line, httpRedirect) {
			return
		}
		s.headers = append(s.headers, row{Key: strings.TrimSpace(name), Value: strings.TrimSpace(value), Enabled: true})
	}
}

func (s *httpSection) readBody(cursor *lineCursor) {
	for ; !cursor.done(); cursor.at++ {
		line := cursor.current()
		switch {
		case isScriptLine(line, httpPostScript):
			s.postScript = joinScripts([]string{s.postScript, cursor.script(httpPostScript)})
		case strings.HasPrefix(line, httpRedirect):
			s.redirect = true
		case isHandlerFile(line):
			s.handlerFile = true
		default:
			s.body = append(s.body, cursor.lines[cursor.at])
		}
	}
	s.body = trimBlankLines(s.body)
}

func trimBlankLines(lines []string) []string {
	for len(lines) > 0 && strings.TrimSpace(lines[0]) == "" {
		lines = lines[1:]
	}
	for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

func isScriptLine(line, marker string) bool {
	rest, found := strings.CutPrefix(line, marker)
	return found && strings.HasPrefix(strings.TrimSpace(rest), httpScriptOpen)
}

func isHandlerFile(line string) bool {
	rest, found := strings.CutPrefix(line, httpPostScript)
	return found && strings.HasSuffix(strings.ToLower(strings.TrimSpace(rest)), httpHandlerSuffix)
}

func isComment(line string) bool {
	return strings.HasPrefix(line, "#") || strings.HasPrefix(line, "//")
}

func commentText(line string) string {
	if rest, found := strings.CutPrefix(line, "//"); found {
		return strings.TrimSpace(rest)
	}
	return strings.TrimSpace(strings.TrimLeft(line, "#"))
}

func cutSpace(text string) (string, string, bool) {
	index := strings.IndexFunc(text, unicode.IsSpace)
	if index < 0 {
		return text, "", false
	}
	return text[:index], text[index:], true
}

func (c *lineCursor) done() bool {
	return c.at >= len(c.lines)
}

func (c *lineCursor) current() string {
	return strings.TrimSpace(c.lines[c.at])
}

func (c *lineCursor) script(marker string) string {
	opening := strings.TrimSpace(strings.TrimPrefix(c.current(), marker))
	text := strings.TrimPrefix(opening, httpScriptOpen)
	var lines []string
	for {
		before, _, closed := strings.Cut(text, httpScriptClose)
		lines = append(lines, before)
		if closed || c.at+1 >= len(c.lines) {
			return dedent(trimBlankLines(lines))
		}
		c.at++
		text = c.lines[c.at]
	}
}
