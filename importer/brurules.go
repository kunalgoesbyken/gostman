package importer

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dop251/goja/ast"
)

const (
	brunoRoot          = "bru"
	requestReceiver    = "req"
	brunoResponseShape = "(response) => ({ ...response, data: response.body })"
	brunoSendWrapper   = "((callback, target) => sendRequest(target).then((response) => callback(null, { ...response, data: response.body }), callback))"
)

var brunoDialect = &dialect{
	name:     "Bruno",
	api:      "bru.*",
	roots:    map[string]bool{brunoRoot: true},
	calls:    buildBrunoRules(),
	specials: map[string]special{"bru.sendRequest": (*translator).renderBrunoSend, "bru.runRequest": (*translator).renderRunRequest},
	scoped:   brunoScopedNames(),
	receivers: map[string]receiver{
		requestReceiver: {
			fields:  setOf("method", "url", "headers", "body"),
			methods: keptMethods("getUrl", "setUrl", "getMethod", "setMethod", "getHeaders", "setHeaders", "getHeader", "setHeader", "getBody", "setBody"),
		},
		responseRoot: {
			fields:  setOf("status", "statusText", "headers", "body", "responseTime", "size", "url"),
			methods: withRenames(keptMethods("getStatus", "getHeaders", "getHeader", "getBody", "getResponseTime"), map[string]string{"getStatusText": "res.statusText", "getUrl": "res.url"}),
			query:   true,
		},
	},
}

var (
	brunoScopedFamilies   = []string{"Var", "GlobalEnvVar", "CollectionVar"}
	brunoVariableFamilies = append([]string{"EnvVar"}, brunoScopedFamilies...)
)

func buildBrunoRules() map[string]callRule {
	rules := map[string]callRule{
		"bru.getFolderVar":             rename("env.get"),
		"bru.getRequestVar":            rename("env.get"),
		"bru.getAllEnvVars":            withoutArguments("env.all()"),
		"bru.getAllVars":               withoutArguments("env.all()"),
		"bru.getAllGlobalEnvVars":      withoutArguments("env.all()"),
		"bru.setNextRequest":           rename("setNextRequest"),
		"bru.runner.setNextRequest":    rename("setNextRequest"),
		"bru.runner.skipRequest":       rename("skipRequest"),
		"bru.runner.stopExecution":     rename("stopExecution"),
		"bru.runner.iterationData.has": rename("env.has"),
		"bru.runner.iterationData.get": iterationValue,
		"bru.sleep":                    pause,
	}
	for _, family := range brunoVariableFamilies {
		rules["bru.get"+family] = rename("env.get")
		rules["bru.set"+family] = rename("env.set")
		rules["bru.has"+family] = rename("env.has")
		rules["bru.delete"+family] = rename("env.unset")
	}
	return rules
}

func brunoScopedNames() map[string]bool {
	names := setOf("bru.getFolderVar", "bru.getRequestVar", "bru.getAllVars", "bru.getAllGlobalEnvVars", "bru.runner.iterationData")
	for _, family := range brunoScopedFamilies {
		for _, verb := range []string{"get", "set", "has", "delete"} {
			names["bru."+verb+family] = true
		}
	}
	return names
}

func iterationValue(args []string) (string, bool) {
	if len(args) == 0 {
		return "env.all()", true
	}
	return rename("env.get")(args)
}

func pause(args []string) (string, bool) {
	if len(args) != 1 {
		return "", false
	}
	return "new Promise((resolve) => setTimeout(resolve, " + args[0] + "))", true
}

func setOf(names ...string) map[string]bool {
	set := make(map[string]bool, len(names))
	for _, name := range names {
		set[name] = true
	}
	return set
}

func keptMethods(names ...string) map[string]string {
	methods := make(map[string]string, len(names))
	for _, name := range names {
		methods[name] = ""
	}
	return methods
}

func withRenames(methods, renames map[string]string) map[string]string {
	for name, replacement := range renames {
		methods[name] = replacement
	}
	return methods
}

func (t *translator) receiver(root string) (receiver, bool) {
	kind, found := t.dialect.receivers[root]
	return kind, found && !t.declared[root]
}

func (t *translator) renderReceiver(call *ast.CallExpression, path chain, kind receiver) string {
	args := t.renderArguments(call)
	kept := t.text(call.Callee) + "(" + strings.Join(args, ", ") + ")"
	if len(path.segments) == 0 {
		if kind.query {
			t.fail(call, messageScriptQuery, path.root)
		}
		return kept
	}
	member := path.segments[0]
	if kind.fields[member] {
		return kept
	}
	replacement, known := kind.methods[member]
	switch {
	case known && replacement == "":
		return kept
	case known && len(path.segments) == 1 && len(args) == 0:
		t.translated++
		return replacement
	}
	t.fail(call, messageScriptUnsupported, path.text()+"()")
	return kept
}

func (t *translator) renderBrunoSend(call *ast.CallExpression) string {
	t.note(call, "sendRequest-scope", messageScriptSendScope)
	if len(call.ArgumentList) == 0 {
		t.fail(call, messageScriptUnsupported, "bru.sendRequest()")
		return t.text(call)
	}
	t.translated++
	target := t.requestTarget(call.ArgumentList[0], t.brunoRequestField)
	if len(call.ArgumentList) == 1 {
		return "sendRequest(" + target + ").then(" + brunoResponseShape + ")"
	}
	expression := brunoSendWrapper + "(" + t.render(call.ArgumentList[1]) + ", " + target + ")"
	if t.awaitedCalls[call] {
		return expression
	}
	return t.awaited(call, expression)
}

func (t *translator) brunoRequestField(property ast.Property) (string, bool) {
	keyed, ok := property.(*ast.PropertyKeyed)
	name, named := propertyName(keyed)
	if !ok || !named {
		t.fail(property, messageScriptOption, "computed")
		return "", false
	}
	switch name {
	case "url", "method", "headers":
		return name + ": " + t.render(keyed.Value), true
	case "data":
		return "body: " + t.render(keyed.Value), true
	}
	t.fail(property, messageScriptOption, name)
	return "", false
}

func (t *translator) renderRunRequest(call *ast.CallExpression) string {
	if len(call.ArgumentList) != 1 {
		t.fail(call, messageScriptUnsupported, "bru.runRequest()")
		return t.text(call)
	}
	literal, ok := call.ArgumentList[0].(*ast.StringLiteral)
	if !ok {
		t.fail(call, messageScriptRequestPath)
		return t.text(call)
	}
	requested := string(literal.Value)
	name := requested[strings.LastIndex(requested, "/")+1:]
	if name != requested {
		t.note(call, "runRequest-"+requested, fmt.Sprintf(messageScriptRunRequest, requested, name))
	}
	t.translated++
	return "sendRequest(" + strconv.Quote(name) + ").then(" + brunoResponseShape + ")"
}
