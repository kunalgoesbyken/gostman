package capture

import (
	"bytes"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

const (
	pathRoot     = "$"
	pathWildcard = "*"
)

func applyHeaders(header http.Header, edits []Edit) {
	for _, edit := range edits {
		for _, name := range edit.RemoveHeaders {
			header.Del(strings.TrimSpace(name))
		}
		for _, row := range edit.SetHeaders {
			if name := strings.TrimSpace(row.Key); name != "" {
				header.Set(name, row.Value)
			}
		}
	}
}

func applyBody(body []byte, edits []Edit) []byte {
	for _, edit := range edits {
		for _, change := range edit.Body {
			body = change.apply(body)
		}
	}
	return body
}

func (b BodyEdit) apply(body []byte) []byte {
	switch {
	case b.Path != "":
		return setAtPath(body, b.Path, b.Value)
	case b.Regex:
		pattern, err := regexp.Compile(b.Find)
		if err != nil {
			return body
		}
		return pattern.ReplaceAll(body, []byte(b.Replace))
	}
	return bytes.ReplaceAll(body, []byte(b.Find), []byte(b.Replace))
}

func pathSteps(path string) []string {
	rest := strings.TrimPrefix(strings.TrimSpace(path), pathRoot)
	var steps []string
	for rest != "" {
		switch rest[0] {
		case '.':
			rest = rest[1:]
		case '[':
			end := strings.IndexByte(rest, ']')
			if end < 0 {
				return nil
			}
			steps = append(steps, strings.Trim(rest[1:end], `'"`))
			rest = rest[end+1:]
		default:
			end := strings.IndexAny(rest, ".[")
			if end < 0 {
				end = len(rest)
			}
			steps = append(steps, rest[:end])
			rest = rest[end:]
		}
	}
	return steps
}

func parsedValue(text string) any {
	decoder := json.NewDecoder(strings.NewReader(text))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil || decoder.More() {
		return text
	}
	return value
}

func setAtPath(body []byte, path, value string) []byte {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.UseNumber()
	var document any
	if err := decoder.Decode(&document); err != nil {
		return body
	}
	steps := pathSteps(path)
	replaced, changed := assign(document, steps, parsedValue(value))
	if !changed {
		return body
	}
	var out bytes.Buffer
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(replaced); err != nil {
		return body
	}
	return bytes.TrimRight(out.Bytes(), "\n")
}

func assign(node any, steps []string, value any) (any, bool) {
	if len(steps) == 0 {
		return value, true
	}
	step, rest := steps[0], steps[1:]
	switch current := node.(type) {
	case map[string]any:
		child, present := current[step]
		if !present && len(rest) > 0 {
			return node, false
		}
		replaced, changed := assign(child, rest, value)
		if changed {
			current[step] = replaced
		}
		return current, changed
	case []any:
		return assignInList(current, step, rest, value)
	}
	return node, false
}

func assignInList(list []any, step string, rest []string, value any) (any, bool) {
	changedAny := false
	for index := range list {
		if step != pathWildcard && step != strconv.Itoa(index) {
			continue
		}
		replaced, changed := assign(list[index], rest, value)
		if changed {
			list[index] = replaced
			changedAny = true
		}
	}
	return list, changedAny
}
