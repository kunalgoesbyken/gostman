package importer

import (
	"fmt"
	"strings"
)

const (
	multilineMark = "'''"
	disabledMark  = "~"
	blockIndent   = 2
	listOpen      = "["
	listClose     = "]"
)

var brunoBlocks = map[string]bool{
	"meta": true, "get": true, "post": true, "put": true, "delete": true, "patch": true, "options": true, "head": true,
	"trace": true, "connect": true, "params:query": true, "params:path": true, "headers": true, "auth": true,
	"auth:basic": true, "auth:bearer": true, "auth:digest": true, "auth:oauth2": true, "auth:awsv4": true,
	"auth:ntlm": true, "auth:apikey": true, "auth:wsse": true, "body": true, "body:json": true, "body:text": true,
	"body:xml": true, "body:sparql": true, "body:graphql": true, "body:graphql:vars": true,
	"body:form-urlencoded": true, "body:multipart-form": true, "body:file": true, "vars": true,
	"vars:pre-request": true, "vars:post-response": true, "vars:secret": true, "assert": true,
	"script:pre-request": true, "script:post-response": true, "tests": true, "docs": true, "settings": true,
}

type bruEntry struct {
	Key     string
	Value   string
	Enabled bool
}

type bruFile struct {
	blocks map[string][]string
}

func normalizeNewlines(source string) string {
	return strings.ReplaceAll(source, "\r\n", "\n")
}

func parseBru(source string) (bruFile, error) {
	file := bruFile{blocks: map[string][]string{}}
	lines := strings.Split(normalizeNewlines(source), "\n")
	for index := 0; index < len(lines); index++ {
		line := strings.TrimRight(lines[index], " \t")
		if strings.TrimSpace(line) == "" {
			continue
		}
		name, closer, ok := blockOpening(line)
		if !ok {
			return file, fmt.Errorf("line %d: expected a block such as \"meta {\"", index+1)
		}
		end := index + 1
		for end < len(lines) && strings.TrimRight(lines[end], " \t") != closer {
			end++
		}
		if end == len(lines) {
			return file, fmt.Errorf("line %d: the block %q is not closed", index+1, name)
		}
		file.blocks[name] = lines[index+1 : end]
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
	lines := f.blocks[name]
	var entries []bruEntry
	for index := 0; index < len(lines); index++ {
		line := strings.TrimSpace(lines[index])
		key, value, found := strings.Cut(line, ":")
		if !found {
			continue
		}
		value = strings.TrimSpace(value)
		if value == multilineMark {
			value, index = multilineValue(lines, index+1)
		}
		key = strings.TrimSpace(key)
		enabled := !strings.HasPrefix(key, disabledMark)
		entries = append(entries, bruEntry{Key: strings.TrimPrefix(key, disabledMark), Value: value, Enabled: enabled})
	}
	return entries
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
	for _, entry := range f.entries(block) {
		if entry.Key == key {
			return entry.Value
		}
	}
	return ""
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
