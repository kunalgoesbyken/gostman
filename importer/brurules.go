package importer

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/kunalgoesbyken/gostman/locales"
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
	shared:   setOf(requestReceiver, responseRoot, "test", "expect"),
	calls:    buildBrunoRules(),
	checks:   map[string]check{"JSON.stringify": (*translator).noteStringifiedBody},
	specials: map[string]special{"bru.sendRequest": (*translator).renderBrunoSend, "bru.setEnvVar": (*translator).renderEnvironmentWrite, "bru.runRequest": func(t *translator, call *ast.CallExpression) string { return t.renderRunRequest(call, nil) }},
	native: map[string]map[string]bool{
		"bru.cookies": setOf("get", "has", "one", "all", "count", "idx", "indexOf", "toObject", "toString", "each", "find", "filter", "map", "reduce", "add", "upsert", "remove", "delete", "clear", "jar"),
	},
	receivers: map[string]receiver{
		requestReceiver: {
			fields: setOf("method", "url", "headers", "body", "name", "timeout", "headerList"),
			methods: setOf("getName", "getUrl", "setUrl", "getHost", "getPath", "getQueryString", "getMethod", "setMethod",
				"getHeaders", "setHeaders", "getHeader", "setHeader", "deleteHeader", "deleteHeaders", "getBody", "setBody", "getTimeout", "setTimeout"),
		},
		responseRoot: {
			fields:   setOf("status", "statusText", "headers", "body", "responseTime", "size", "url", "headerList"),
			methods:  setOf("getStatus", "getStatusText", "getHeaders", "getHeader", "getBody", "setBody", "getResponseTime", "getUrl", "getSize"),
			callable: true,
		},
	},
}

var brunoVariableFamilies = map[string]string{
	"EnvVar": environmentAccess, "Var": sessionAccess, "CollectionVar": collectionAccess, "GlobalEnvVar": globalAccess,
}

func buildBrunoRules() map[string]callRule {
	rules := map[string]callRule{
		"bru.getFolderVar":                   rename("env.get"),
		"bru.getRequestVar":                  rename("env.get"),
		"bru.getProcessEnv":                  processValue,
		"bru.getEnvName":                     withoutArguments("env.name"),
		"bru.getRequestName":                 withoutArguments("req.name"),
		"bru.interpolate":                    rename("env.interpolate"),
		"bru.isSafeMode":                     withoutArguments("true"),
		"bru.setNextRequest":                 rename("setNextRequest"),
		"bru.runner.setNextRequest":          rename("setNextRequest"),
		"bru.runner.skipRequest":             rename("skipRequest"),
		"bru.runner.stopExecution":           rename("stopExecution"),
		"bru.runner.iterationData.has":       rename("env.has"),
		"bru.runner.iterationData.get":       iterationValue,
		"bru.runner.iterationData.unset":     rename("env.unset"),
		"bru.runner.iterationData.stringify": withoutArguments("JSON.stringify(env.all())"),
		"bru.sleep":                          pause,
	}
	for family, access := range brunoVariableFamilies {
		rules["bru.get"+family] = rename(access + ".get")
		rules["bru.set"+family] = rename(access + ".set")
		rules["bru.has"+family] = rename(access + ".has")
		rules["bru.delete"+family] = rename(access + ".unset")
		rules["bru.getAll"+family+"s"] = withoutArguments(access + ".all()")
		rules["bru.deleteAll"+family+"s"] = withoutArguments(access + ".clear()")
	}
	return rules
}

func (t *translator) noteStringifiedBody(call *ast.CallExpression) {
	if len(call.ArgumentList) != 1 {
		return
	}
	inner, isCall := call.ArgumentList[0].(*ast.CallExpression)
	if !isCall || len(inner.ArgumentList) != 0 {
		return
	}
	if path, pure := chainOf(inner.Callee); pure && path.text() == requestReceiver+".getBody" {
		t.note(call, "stringified-body", locales.ImporterScriptBodyText)
	}
}

func iterationValue(args []string) (string, bool) {
	if len(args) == 0 {
		return "env.all()", true
	}
	return rename("env.get")(args)
}

func processValue(args []string) (string, bool) {
	if len(args) != 1 {
		return "", false
	}
	if name, err := strconv.Unquote(args[0]); err == nil {
		return fmt.Sprintf("(env.get(%q) ?? env.get(%q))", processPrefix+name, name), true
	}
	return fmt.Sprintf("((name) => env.get(%q + name) ?? env.get(name))(%s)", processPrefix, args[0]), true
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

func (t *translator) receiver(root string) (receiver, bool) {
	kind, found := t.dialect.receivers[root]
	return kind, found && !t.declared[root]
}

func (t *translator) renderReceiver(call *ast.CallExpression, path chain, kind receiver) string {
	kept := t.text(call.Callee) + "(" + strings.Join(t.renderArguments(call), ", ") + ")"
	if !kind.supports(path) {
		t.fail(call, locales.ImporterScriptUnsupported, locales.Params{"name": path.text() + "()"})
	}
	return kept
}

func (r receiver) supports(path chain) bool {
	if len(path.segments) == 0 {
		return r.callable
	}
	member := path.segments[0]
	return r.fields[member] || (len(path.segments) == 1 && r.methods[member])
}

func (t *translator) renderBrunoSend(call *ast.CallExpression) string {
	t.note(call, noteSendScope, locales.ImporterScriptSendScope)
	if len(call.ArgumentList) == 0 {
		t.fail(call, locales.ImporterScriptUnsupported, locales.Params{"name": "bru.sendRequest()"})
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

func (t *translator) renderEnvironmentWrite(call *ast.CallExpression) string {
	args := call.ArgumentList
	if len(args) < 2 || len(args) > 3 {
		t.fail(call, locales.ImporterScriptUnsupported, locales.Params{"name": "bru.setEnvVar()"})
		return t.text(call)
	}
	access := sessionAccess
	if len(args) == 3 && !optionOff(args[2], "persist") {
		access = environmentAccess
	}
	t.translated++
	return access + ".set(" + t.render(args[0]) + ", " + t.render(args[1]) + ")"
}

func optionOff(options ast.Expression, name string) bool {
	object, ok := options.(*ast.ObjectLiteral)
	if !ok {
		return false
	}
	for _, property := range object.Value {
		keyed, _ := property.(*ast.PropertyKeyed)
		if key, named := propertyName(keyed); named && key == name {
			value, literal := keyed.Value.(*ast.BooleanLiteral)
			return literal && !value.Value
		}
	}
	return true
}

func (t *translator) brunoRequestField(property ast.Property) (string, bool) {
	keyed, ok := property.(*ast.PropertyKeyed)
	name, named := propertyName(keyed)
	if !ok || !named {
		t.fail(property, locales.ImporterScriptOption, locales.Params{"name": "computed"})
		return "", false
	}
	switch name {
	case "url", "method", "headers", "timeout":
		return name + ": " + t.render(keyed.Value), true
	case "data":
		return "body: " + t.render(keyed.Value), true
	}
	t.fail(property, locales.ImporterScriptOption, locales.Params{"name": name})
	return "", false
}

type requestPath struct {
	path string
	name string
}

func requestTargets(paths []requestPath) (map[string]string, map[string]string) {
	named := map[string]int{}
	for _, entry := range paths {
		named[entry.name]++
	}
	ids := map[string]string{}
	targets := map[string]string{}
	for _, entry := range paths {
		ids[entry.path] = newID()
		target := entry.name
		if named[entry.name] > 1 {
			target = ids[entry.path]
		}
		targets[requestKey(entry.path)] = target
	}
	return ids, targets
}

func runTargets(paths []requestPath) (map[string]string, *dialect) {
	ids, targets := requestTargets(paths)
	resolving := *brunoDialect
	resolving.specials = map[string]special{
		"bru.sendRequest": (*translator).renderBrunoSend,
		"bru.setEnvVar":   (*translator).renderEnvironmentWrite,
		"bru.runRequest":  func(t *translator, call *ast.CallExpression) string { return t.renderRunRequest(call, targets) },
	}
	return ids, &resolving
}

func requestKey(location string) string {
	key := strings.Trim(strings.TrimPrefix(strings.ReplaceAll(location, `\`, "/"), "./"), "/")
	for _, extension := range []string{brunoExtension, ".yml", ".yaml"} {
		key = strings.TrimSuffix(key, extension)
	}
	return key
}

func (t *translator) renderRunRequest(call *ast.CallExpression, targets map[string]string) string {
	if len(call.ArgumentList) != 1 {
		t.fail(call, locales.ImporterScriptUnsupported, locales.Params{"name": "bru.runRequest()"})
		return t.text(call)
	}
	literal, ok := call.ArgumentList[0].(*ast.StringLiteral)
	if !ok {
		t.fail(call, locales.ImporterScriptRequestPath, nil)
		return t.text(call)
	}
	requested := string(literal.Value)
	target, found := targets[requestKey(requested)]
	if !found {
		target = requested[strings.LastIndex(requested, "/")+1:]
		t.noteSaid(call, "runRequest-"+requested, locales.New(locales.ImporterScriptRunRequest, locales.Params{"requested": requested, "target": target}))
	}
	t.translated++
	return "sendRequest(" + strconv.Quote(target) + ").then(" + brunoResponseShape + ")"
}
