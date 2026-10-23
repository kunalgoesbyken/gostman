package importer

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

const (
	systemMark         = "$"
	encodedMark        = "%"
	processPrefix      = "process.env."
	randomRange        = "$randomInt(%d,%d)"
	randomIntegerCall  = "$random.integer("
	jetbrainsEnvPrefix = "$env."
	responseSegment    = "response"
	requestSegment     = "request"
	bodySegment        = "body"
	headersSegment     = "headers"
	wholeBody          = "*"
	jsonPathRoot       = "$"
	sourceHeader       = "header"
	sourceBody         = "body"
)

var (
	systemAliases = map[string]string{
		"$guid": "$guid", "$uuid": "$uuid", "$random.uuid": "$uuid", "$timestamp": "$timestamp",
		"$isoTimestamp": "$isoTimestamp", "$randomInt": "$randomInt", "$random.integer": "$randomInt",
		"$random.integer()": "$randomInt", "$random.email": "$randomEmail", "$datetime iso8601": "$isoTimestamp",
	}
	environmentReaders = map[string]bool{"$processEnv": true, "$dotenv": true}
)

type responseLink struct {
	request   string
	rule      extractor
	supported bool
}

func mapPlaceholders(text string, transform func(string) string) string {
	var out strings.Builder
	for {
		start := strings.Index(text, variableOpen)
		if start < 0 {
			break
		}
		end := strings.Index(text[start+len(variableOpen):], variableClose)
		if end < 0 {
			break
		}
		end += start + len(variableOpen)
		out.WriteString(text[:start])
		out.WriteString(transform(strings.TrimSpace(text[start+len(variableOpen) : end])))
		text = text[end+len(variableClose):]
	}
	out.WriteString(text)
	return out.String()
}

func (c *collector) httpPlaceholders(text, label string, prompts map[string]bool) string {
	return mapPlaceholders(text, func(inner string) string {
		if prompts[inner] {
			return variableOpen + promptPrefix + inner + variableClose
		}
		mapped, known := c.systemVariable(inner, label)
		if !known {
			c.flagUnique(messageHTTPVariables, variableOpen+inner+variableClose)
		}
		return variableOpen + mapped + variableClose
	})
}

func (c *collector) systemVariable(inner, label string) (string, bool) {
	if !strings.HasPrefix(inner, systemMark) {
		return inner, !strings.HasPrefix(inner, encodedMark)
	}
	fields := strings.Fields(inner)
	if alias, found := systemAliases[strings.Join(fields, " ")]; found {
		return alias, true
	}
	if mapped, ok := randomBetween(fields); ok {
		return mapped, true
	}
	if name, ok := environmentReference(fields); ok {
		c.flagUnique(messageHTTPProcessEnv, label)
		return processPrefix + name, true
	}
	return inner, false
}

func randomBetween(fields []string) (string, bool) {
	if len(fields) == 3 && fields[0] == "$randomInt" {
		return exclusiveRange(fields[1], fields[2])
	}
	joined := strings.Join(fields, "")
	arguments, found := strings.CutPrefix(joined, randomIntegerCall)
	arguments, closed := strings.CutSuffix(arguments, ")")
	low, high, paired := strings.Cut(arguments, ",")
	if !found || !closed || !paired {
		return "", false
	}
	return exclusiveRange(low, high)
}

func exclusiveRange(low, high string) (string, bool) {
	from, lowErr := strconv.Atoi(low)
	to, highErr := strconv.Atoi(high)
	if lowErr != nil || highErr != nil || to <= from {
		return "", false
	}
	return fmt.Sprintf(randomRange, from, to-1), true
}

func environmentReference(fields []string) (string, bool) {
	if len(fields) == 2 && environmentReaders[fields[0]] && validVariableName(fields[1]) {
		return fields[1], true
	}
	if name, found := strings.CutPrefix(fields[0], jetbrainsEnvPrefix); found && len(fields) == 1 && validVariableName(name) {
		return name, true
	}
	return "", false
}

func validVariableName(name string) bool {
	if name == "" {
		return false
	}
	for _, r := range name {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '_' && r != '.' && r != '-' {
			return false
		}
	}
	return true
}

func responseReference(inner string) (responseLink, bool) {
	segments := strings.SplitN(inner, ".", 4)
	if len(segments) < 4 || segments[1] != responseSegment && segments[1] != requestSegment {
		return responseLink{}, false
	}
	link := responseLink{request: segments[0]}
	if segments[1] != responseSegment {
		return link, true
	}
	selector := segments[3]
	switch {
	case segments[2] == headersSegment:
		link.rule = extractor{Name: linkName(segments[0], selector), Source: sourceHeader, Expression: selector, Enabled: true}
	case segments[2] == bodySegment && selector == wholeBody:
		link.rule = extractor{Name: linkName(segments[0], bodySegment), Source: sourceBody, Expression: jsonPathRoot, Enabled: true}
	case segments[2] == bodySegment && strings.HasPrefix(selector, jsonPathRoot):
		link.rule = extractor{Name: linkName(segments[0], strings.TrimPrefix(selector, jsonPathRoot)), Source: sourceBody, Expression: selector, Enabled: true}
	default:
		return link, true
	}
	link.supported = true
	return link, true
}

func linkName(request, selector string) string {
	var out strings.Builder
	for _, r := range request + "_" + selector {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			out.WriteRune(r)
			continue
		}
		out.WriteRune('_')
	}
	parts := strings.FieldsFunc(out.String(), func(r rune) bool { return r == '_' })
	return strings.Join(parts, "_")
}
