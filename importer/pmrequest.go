package importer

import (
	"fmt"
	"strings"

	"github.com/dop251/goja/ast"
)

const sendRequestWrapper = "((callback, target) => sendRequest(target).then((response) => callback(null, response), callback))"

func (t *translator) renderSendRequest(call *ast.CallExpression) string {
	t.note(call, "sendRequest-scope", messageScriptSendScope)
	if len(call.ArgumentList) == 0 {
		t.fail(call, messageScriptUnsupported, "pm.sendRequest()")
		return t.text(call)
	}
	t.translated++
	target := t.requestTarget(call.ArgumentList[0])
	if len(call.ArgumentList) == 1 {
		return "sendRequest(" + target + ")"
	}
	return t.awaited(call, sendRequestWrapper+"("+t.renderCallback(call.ArgumentList[1])+", "+target+")")
}

func (t *translator) awaited(at ast.Node, expression string) string {
	if t.inAsync() {
		return "await " + expression
	}
	t.note(at, "sendRequest-async", messageScriptSendAsync)
	return expression
}

func (t *translator) renderCallback(callback ast.Expression) string {
	name, literal := responseParameter(callback)
	if !literal {
		t.note(callback, "sendRequest-callback", messageScriptSendCallback)
		return t.render(callback)
	}
	if name == "" {
		return t.render(callback)
	}
	t.aliases = append(t.aliases, name)
	defer func() { t.aliases = t.aliases[:len(t.aliases)-1] }()
	return t.render(callback)
}

func responseParameter(callback ast.Expression) (string, bool) {
	switch function := callback.(type) {
	case *ast.FunctionLiteral:
		return secondParameter(function.ParameterList), true
	case *ast.ArrowFunctionLiteral:
		return secondParameter(function.ParameterList), true
	}
	return "", false
}

func secondParameter(parameters *ast.ParameterList) string {
	if parameters == nil || len(parameters.List) < 2 {
		return ""
	}
	if identifier, ok := parameters.List[1].Target.(*ast.Identifier); ok {
		return string(identifier.Name)
	}
	return ""
}

func (t *translator) requestTarget(argument ast.Expression) string {
	switch current := argument.(type) {
	case *ast.StringLiteral, *ast.TemplateLiteral:
		return "{ url: " + t.render(current) + " }"
	case *ast.ObjectLiteral:
		return t.requestObject(current)
	}
	t.note(argument, "sendRequest-target", messageScriptSendTarget)
	return t.render(argument)
}

func (t *translator) requestObject(object *ast.ObjectLiteral) string {
	var fields []string
	for _, property := range object.Value {
		if field, ok := t.requestField(property); ok {
			fields = append(fields, field)
		}
	}
	return "{ " + strings.Join(fields, ", ") + " }"
}

func (t *translator) requestField(property ast.Property) (string, bool) {
	keyed, ok := property.(*ast.PropertyKeyed)
	name, named := propertyName(keyed)
	if !ok || !named {
		t.fail(property, messageScriptOption, "computed")
		return "", false
	}
	switch name {
	case "url":
		return t.requestURL(keyed.Value)
	case "method":
		return "method: " + t.render(keyed.Value), true
	case "header":
		return t.requestHeaders(keyed.Value)
	case "body":
		return t.requestBody(keyed.Value)
	}
	t.fail(property, messageScriptOption, name)
	return "", false
}

func propertyName(property *ast.PropertyKeyed) (string, bool) {
	if property == nil || property.Computed {
		return "", false
	}
	switch key := property.Key.(type) {
	case *ast.Identifier:
		return string(key.Name), true
	case *ast.StringLiteral:
		return string(key.Value), true
	}
	return "", false
}

func objectField(object *ast.ObjectLiteral, name string) ast.Expression {
	for _, property := range object.Value {
		keyed, ok := property.(*ast.PropertyKeyed)
		if given, named := propertyName(keyed); ok && named && given == name {
			return keyed.Value
		}
	}
	return nil
}

func (t *translator) requestURL(value ast.Expression) (string, bool) {
	object, isObject := value.(*ast.ObjectLiteral)
	if !isObject {
		return "url: " + t.render(value), true
	}
	if raw := objectField(object, "raw"); raw != nil {
		return "url: " + t.render(raw), true
	}
	t.fail(value, messageScriptOption, "url")
	return "", false
}

func (t *translator) requestHeaders(value ast.Expression) (string, bool) {
	list, isList := value.(*ast.ArrayLiteral)
	if !isList {
		return "headers: " + t.render(value), true
	}
	var pairs []string
	for _, element := range list.Value {
		pair, ok := t.headerPair(element)
		if !ok {
			t.fail(element, messageScriptOption, "header")
			continue
		}
		pairs = append(pairs, pair)
	}
	return "headers: { " + strings.Join(pairs, ", ") + " }", true
}

func (t *translator) headerPair(element ast.Expression) (string, bool) {
	object, isObject := element.(*ast.ObjectLiteral)
	if !isObject {
		return "", false
	}
	key, value := objectField(object, "key"), objectField(object, "value")
	if key == nil || value == nil {
		return "", false
	}
	return "[" + t.render(key) + "]: " + t.render(value), true
}

func (t *translator) requestBody(value ast.Expression) (string, bool) {
	object, isObject := value.(*ast.ObjectLiteral)
	if !isObject {
		return "body: " + t.render(value), true
	}
	raw := objectField(object, "raw")
	if raw == nil {
		t.fail(value, messageScriptOption, "body")
		return "", false
	}
	if mode, ok := objectField(object, "mode").(*ast.StringLiteral); ok && string(mode.Value) != "raw" {
		t.fail(value, messageScriptOption, fmt.Sprintf("body mode %s", mode.Value))
		return "", false
	}
	return "body: " + t.render(raw), true
}

func (t *translator) checkRequire(call *ast.CallExpression) {
	if len(call.ArgumentList) == 0 {
		return
	}
	name, literal := call.ArgumentList[0].(*ast.StringLiteral)
	if !literal {
		t.fail(call, messageScriptModuleDynamic)
		return
	}
	module := string(name.Value)
	if strings.HasPrefix(module, ".") || supportedModules[module] {
		return
	}
	t.fail(call, messageScriptModule, module)
}
