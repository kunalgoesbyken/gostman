package importer

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

const (
	sourceCookie     = "cookie"
	scopeEnvironment = "environment"
	jsonPathRootName = "$"
	valueSlot        = "%s"
)

type extractForm struct {
	setters map[string]string
	options map[string]string
	vars    bool
	lower   bool
	body    string
	status  string
	header  string
	cookie  string
}

var postmanExtract = &extractForm{
	setters: map[string]string{"": "pm.collectionVariables.set", scopeSession: "pm.variables.set", scopeEnvironment: "pm.environment.set"},
	body:    "pm.response.json()",
	status:  "pm.response.code",
	header:  "pm.response.headers.get(%s)",
	cookie:  "pm.cookies.get(%s)",
}

var brunoExtract = &extractForm{
	setters: map[string]string{scopeEnvironment: "bru.setEnvVar"},
	options: map[string]string{scopeEnvironment: ", { persist: true }"},
	vars:    true,
	lower:   true,
	body:    "res.body",
	status:  "res.status",
	header:  "res.headers[%s]",
	cookie:  "bru.cookies.get(%s)",
}

func extractScope(rule extractor) string {
	if rule.Scope == scopeSession || rule.Scope == scopeEnvironment {
		return rule.Scope
	}
	return ""
}

func (form *extractForm) inVars(rule extractor) bool {
	return form.vars && extractScope(rule) != scopeEnvironment
}

func (form *extractForm) value(rule extractor) (string, bool) {
	expression := strings.TrimSpace(rule.Expression)
	switch rule.Source {
	case sourceBody, "":
		members, ok := jsonPathMembers(expression)
		return form.body + members, ok
	case sourceHeader:
		if form.lower {
			expression = strings.ToLower(expression)
		}
		return fmt.Sprintf(form.header, jsString(expression)), expression != ""
	case sourceCookie:
		return fmt.Sprintf(form.cookie, jsString(expression)), expression != ""
	case sourceStatus:
		return form.status, true
	}
	return "", false
}

func (form *extractForm) line(rule extractor, value string) string {
	scope := extractScope(rule)
	return form.setters[scope] + "(" + jsString(rule.Name) + ", " + value + form.options[scope] + ");"
}

func jsonPathMembers(path string) (string, bool) {
	members, found := strings.CutPrefix(path, jsonPathRootName)
	if !found || members == "" {
		return "", found
	}
	expression, ok := soleExpression(path)
	return members, ok && isMemberPath(expression, jsonPathRootName)
}

func withoutExtractLines(target *scriptTarget, source string) (string, []extractor) {
	if target == nil || target.extract == nil {
		return source, nil
	}
	lines := strings.Split(source, "\n")
	var rules []extractor
	count := 0
	for ; count < len(lines); count++ {
		rule, ok := target.extract.ruleOf(lines[count])
		if !ok {
			break
		}
		rules = append(rules, rule)
	}
	if count == 0 {
		return source, nil
	}
	if count < len(lines) && strings.TrimSpace(lines[count]) == "" {
		count++
	}
	return strings.Join(lines[count:], "\n"), rules
}

func (form *extractForm) ruleOf(line string) (extractor, bool) {
	program, err := parser.ParseFile(nil, "", line, 0)
	if err != nil || len(program.Body) != 1 {
		return extractor{}, false
	}
	statement, ok := program.Body[0].(*ast.ExpressionStatement)
	if !ok {
		return extractor{}, false
	}
	call, ok := statement.Expression.(*ast.CallExpression)
	if !ok || len(call.ArgumentList) < 2 {
		return extractor{}, false
	}
	name, named := call.ArgumentList[0].(*ast.StringLiteral)
	callee, pure := chainOf(call.Callee)
	scope, known := form.scopeOf(callee.text())
	if !named || !pure || !known {
		return extractor{}, false
	}
	argument := call.ArgumentList[1]
	rule, read := form.sourceOf(line[int(argument.Idx0())-1 : int(argument.Idx1())-1])
	rule.Name, rule.Scope, rule.Enabled = string(name.Value), scope, true
	value, valid := form.value(rule)
	return rule, read && valid && form.line(rule, value) == line
}

func (form *extractForm) scopeOf(setter string) (string, bool) {
	for scope, candidate := range form.setters {
		if candidate == setter {
			return scope, true
		}
	}
	return "", false
}

func (form *extractForm) sourceOf(value string) (extractor, bool) {
	if value == form.status {
		return extractor{Source: sourceStatus}, true
	}
	if members, found := strings.CutPrefix(value, form.body); found {
		return extractor{Source: sourceBody, Expression: jsonPathRootName + members}, true
	}
	for source, format := range map[string]string{sourceHeader: form.header, sourceCookie: form.cookie} {
		if name, ok := quotedArgument(value, format); ok {
			return extractor{Source: source, Expression: name}, true
		}
	}
	return extractor{}, false
}

func quotedArgument(value, format string) (string, bool) {
	prefix, suffix, _ := strings.Cut(format, valueSlot)
	inner, ok := enclosed(value, prefix, suffix)
	var name string
	return name, ok && json.Unmarshal([]byte(inner), &name) == nil
}

func encodeExtractors(rules []extractor) string {
	if len(rules) == 0 {
		return ""
	}
	encoded, _ := json.Marshal(rules)
	return string(encoded)
}
