package importer

import (
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

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
	node, ok := soleExpression(expression)
	if call, isCall := node.(*ast.CallExpression); ok && isCall {
		return calledReference(call)
	}
	path, pure := chainOf(node)
	switch {
	case !ok || !pure || path.root != responseRoot:
		return "", "", false
	case path.path() == sourceStatus:
		return sourceStatus, "", true
	case len(path.segments) == 2 && path.segments[0] == "headers":
		return sourceHeader, path.segments[1], path.segments[1] != ""
	}
	return "", "", false
}

func calledReference(call *ast.CallExpression) (string, string, bool) {
	callee, pure := chainOf(call.Callee)
	switch {
	case !pure:
		return "", "", false
	case callee.text() == responseRoot+".getStatus":
		return sourceStatus, "", len(call.ArgumentList) == 0
	case callee.text() == responseRoot+".getHeader":
		name, ok := onlyText(call)
		return sourceHeader, name, ok
	case callee.text() == brunoRoot+".cookies.get":
		name, ok := onlyText(call)
		return sourceCookie, name, ok
	}
	return "", "", false
}

func onlyText(call *ast.CallExpression) (string, bool) {
	if len(call.ArgumentList) != 1 {
		return "", false
	}
	literal, ok := call.ArgumentList[0].(*ast.StringLiteral)
	if !ok {
		return "", false
	}
	return string(literal.Value), literal.Value != ""
}

func soleExpression(source string) (ast.Expression, bool) {
	program, err := parser.ParseFile(nil, "", source, 0)
	if err != nil || len(program.Body) != 1 {
		return nil, false
	}
	statement, ok := program.Body[0].(*ast.ExpressionStatement)
	if !ok {
		return nil, false
	}
	return statement.Expression, true
}

func bodyExpression(expression string) (string, bool) {
	rest, found := strings.CutPrefix(strings.TrimSpace(expression), "res.body")
	if !found || (rest != "" && rest[0] != '.' && rest[0] != '[') {
		return "", false
	}
	_, member := jsonPathMembers(jsonPathRootName + rest)
	return jsonPathRootName + rest, member
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
