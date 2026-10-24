package importer

import (
	"fmt"
	"strings"
)

const (
	multilineMark   = "'''"
	disabledMark    = "~"
	localMark       = "@"
	listOpen        = "["
	listClose       = "]"
	sectionOpen     = ": {"
	sectionClose    = "}"
	annotationStart = "("
)

var brunoBlocks = map[string]bool{
	"meta": true, "get": true, "post": true, "put": true, "delete": true, "patch": true, "options": true, "head": true,
	"trace": true, "connect": true, "http": true, "grpc": true, "ws": true, "params:query": true, "query": true,
	"params:path": true, "headers": true, "metadata": true, "auth": true,
	"auth:basic": true, "auth:bearer": true, "auth:digest": true, "auth:oauth2": true, "auth:awsv4": true,
	"auth:ntlm": true, "auth:apikey": true, "auth:wsse": true, "auth:oauth1": true, "auth:akamai-edgegrid": true,
	"body": true, "body:json": true, "body:text": true,
	"body:xml": true, "body:sparql": true, "body:graphql": true, "body:graphql:vars": true,
	"body:form-urlencoded": true, "body:multipart-form": true, "body:file": true, "body:grpc": true, "body:ws": true,
	"vars": true, "vars:pre-request": true, "vars:post-response": true, "vars:secret": true, "assert": true,
	"script:pre-request": true, "script:post-response": true, "tests": true, "docs": true, "settings": true, "example": true,
}

type bruEntry struct {
	Key     string
	Value   string
	Enabled bool
}

type bruFile struct {
	blocks   map[string][]string
	repeated map[string][][]string
	top      map[string]string
}

func normalizeNewlines(source string) string {
	return strings.ReplaceAll(source, "\r\n", "\n")
}

func parseBru(source string) (bruFile, error) {
	file := bruFile{blocks: map[string][]string{}, repeated: map[string][][]string{}, top: map[string]string{}}
	lines := strings.Split(normalizeNewlines(source), "\n")
	for index := 0; index < len(lines); index++ {
		line := strings.TrimRight(lines[index], " \t")
		if strings.TrimSpace(line) == "" {
			continue
		}
		name, closer, ok := blockOpening(line)
		if !ok {
			key, value, pair := strings.Cut(line, ":")
			if !pair || strings.HasPrefix(line, " ") {
				return file, fmt.Errorf("line %d: expected a block such as \"meta {\"", index+1)
			}
			file.top[strings.TrimSpace(key)] = strings.TrimSpace(value)
			continue
		}
		end := index + 1
		for end < len(lines) && strings.TrimRight(lines[end], " \t") != closer {
			end++
		}
		if end == len(lines) {
			return file, fmt.Errorf("line %d: the block %q is not closed", index+1, name)
		}
		body := lines[index+1 : end]
		if _, seen := file.blocks[name]; !seen {
			file.blocks[name] = body
		}
		file.repeated[name] = append(file.repeated[name], body)
		index = end
	}
	return file, nil
}

func blockOpening(line string) (string, string, bool) {
	if name, found := strings.CutSuffix(line, " {"); found && !strings.HasPrefix(line, " ") {
		return name, "}", true
	}
	if name, found := strings.CutSuffix(line, " ["); found && !strings.HasPrefix(line, " ") {
		return name, "]", true
	}
	return "", "", false
}

func (f bruFile) has(name string) bool {
	_, found := f.blocks[name]
	return found
}

func (f bruFile) entries(name string) []bruEntry {
	return bruEntries(f.blocks[name])
}

func bruEntries(lines []string) []bruEntry {
	var entries []bruEntry
	for index := 0; index < len(lines); index++ {
		line := strings.TrimSpace(lines[index])
		if isAnnotation(line) {
			continue
		}
		key, value, found := splitPair(line)
		if !found {
			continue
		}
		if value == multilineMark {
			value, index = multilineValue(lines, index+1)
		}
		enabled := !strings.HasPrefix(key, disabledMark)
		key = strings.TrimPrefix(strings.TrimPrefix(key, disabledMark), localMark)
		entries = append(entries, bruEntry{Key: key, Value: value, Enabled: enabled})
	}
	return entries
}

func isAnnotation(line string) bool {
	name, found := strings.CutPrefix(line, localMark)
	if !found {
		return false
	}
	colon, open := strings.Index(name, ":"), strings.Index(name, annotationStart)
	return colon < 0 || open >= 0 && open < colon && strings.HasSuffix(name, ")")
}

func splitPair(line string) (string, string, bool) {
	prefix := ""
	if trimmed, disabled := strings.CutPrefix(line, disabledMark); disabled {
		prefix, line = disabledMark, trimmed
	}
	if quoted, isQuoted := strings.CutPrefix(line, `"`); isQuoted {
		end := strings.Index(quoted, `"`)
		if end < 0 {
			return "", "", false
		}
		rest, found := strings.CutPrefix(strings.TrimSpace(quoted[end+1:]), ":")
		return prefix + quoted[:end], strings.TrimSpace(rest), found
	}
	key, value, found := strings.Cut(line, ":")
	return prefix + strings.TrimSpace(key), strings.TrimSpace(value), found
}

func multilineValue(lines []string, start int) (string, int) {
	end := start
	for end < len(lines) && strings.TrimSpace(lines[end]) != multilineMark {
		end++
	}
	return dedent(lines[start:min(end, len(lines))]), end
}

func (f bruFile) text(name string) string {
	return dedent(f.blocks[name])
}

func (f bruFile) names(name string) []string {
	var names []string
	for _, item := range strings.Split(strings.Join(f.blocks[name], "\n"), ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			names = append(names, trimmed)
		}
	}
	return names
}

func (f bruFile) list(block, key string) []string {
	lines := f.blocks[block]
	for index, line := range lines {
		name, value, found := strings.Cut(strings.TrimSpace(line), ":")
		if found && strings.TrimSpace(name) == key && strings.TrimSpace(value) == listOpen {
			return listItems(lines[index+1:])
		}
	}
	return nil
}

func listItems(lines []string) []string {
	var items []string
	for _, line := range lines {
		item := strings.TrimSpace(line)
		if item == listClose {
			break
		}
		if item != "" {
			items = append(items, item)
		}
	}
	return items
}

func (f bruFile) value(block, key string) string {
	return entryValue(f.entries(block), key)
}

func entryValue(entries []bruEntry, key string) string {
	for _, entry := range entries {
		if entry.Key == key {
			return entry.Value
		}
	}
	return ""
}

type bruSection struct {
	entries  []bruEntry
	sections map[string]bruSection
}

func parseSection(lines []string) bruSection {
	lines = strings.Split(dedent(lines), "\n")
	section := bruSection{sections: map[string]bruSection{}}
	var plain []string
	for index := 0; index < len(lines); index++ {
		name, opens := strings.CutSuffix(strings.TrimRight(lines[index], " \t"), sectionOpen)
		if !opens || strings.HasPrefix(name, " ") {
			plain = append(plain, lines[index])
			continue
		}
		end := index + 1
		for end < len(lines) && strings.TrimRight(lines[end], " \t") != sectionClose {
			end++
		}
		section.sections[name] = parseSection(lines[index+1 : min(end, len(lines))])
		index = end
	}
	section.entries = bruEntries(plain)
	return section
}

func (s bruSection) value(key string) string {
	return entryValue(s.entries, key)
}

func dedent(lines []string) string {
	indent := -1
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		leading := len(line) - len(strings.TrimLeft(line, " \t"))
		if indent < 0 || leading < indent {
			indent = leading
		}
	}
	stripped := make([]string, len(lines))
	for index, line := range lines {
		stripped[index] = line
		if len(line) >= indent && indent > 0 {
			stripped[index] = line[indent:]
		} else if strings.TrimSpace(line) == "" {
			stripped[index] = ""
		}
	}
	return strings.TrimRight(strings.Join(stripped, "\n"), "\n ")
}
