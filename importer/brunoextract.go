package importer

import "strings"

const (
	sourceStatus = "status"
	scopeSession = "session"
)

func responseExtractor(name, expression string, enabled bool) (extractor, bool) {
	source, path, ok := brunoResponseReference(strings.TrimSpace(expression))
	return extractor{Name: name, Source: source, Expression: path, Enabled: enabled, Scope: scopeSession}, ok
}

func brunoResponseReference(expression string) (string, string, bool) {
	if path, ok := bodyExpression(expression); ok {
		return sourceBody, path, true
	}
	if path, ok := bodyExpression(strings.Replace(expression, "res.getBody()", "res.body", 1)); ok {
		return sourceBody, path, true
	}
	switch expression {
	case "res.status", "res.getStatus()":
		return sourceStatus, "", true
	}
	if header, ok := headerReference(expression); ok {
		return sourceHeader, header, true
	}
	return "", "", false
}

func bodyExpression(expression string) (string, bool) {
	rest, found := strings.CutPrefix(strings.TrimSpace(expression), "res.body")
	if !found || (rest != "" && rest[0] != '.' && rest[0] != '[') {
		return "", false
	}
	return "$" + rest, true
}

func headerReference(expression string) (string, bool) {
	if inner, ok := enclosed(expression, "res.getHeader(", ")"); ok {
		return quotedText(inner)
	}
	if inner, ok := enclosed(expression, "res.headers[", "]"); ok {
		return quotedText(inner)
	}
	name, found := strings.CutPrefix(expression, "res.headers.")
	if !found || name == "" || strings.ContainsAny(name, ".[( ") {
		return "", false
	}
	return name, true
}

func enclosed(expression, prefix, suffix string) (string, bool) {
	inner, found := strings.CutPrefix(expression, prefix)
	if !found {
		return "", false
	}
	return strings.CutSuffix(inner, suffix)
}

func quotedText(source string) (string, bool) {
	scanner := &tagScanner{source: strings.TrimSpace(source)}
	if scanner.done() {
		return "", false
	}
	argument, ok := scanner.argument()
	return argument.text, ok && argument.quoted && scanner.done() && argument.text != ""
}
