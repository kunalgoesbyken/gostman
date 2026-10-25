package importer

import (
	"strconv"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/kunalgoesbyken/gostman/locales"
)

const insomniaRoot = "insomnia"

var insomniaDialect = withBaseEnvironment(rebasedDialect(postmanDialect, "Insomnia", insomniaRoot))

func withBaseEnvironment(d *dialect) *dialect {
	from, to := insomniaRoot+".collectionVariables.", insomniaRoot+".baseEnvironment."
	for name, rule := range rebasedKeys(d.calls, from, to) {
		d.calls[name] = rule
	}
	return d
}

func rebasedDialect(source *dialect, name, root string) *dialect {
	from, to := postmanRoot+".", root+"."
	response, _ := rebasedKey(source.response, from, to)
	return &dialect{
		name:       name,
		api:        root + ".*",
		roots:      map[string]bool{root: true},
		response:   response,
		properties: rebasedKeys(source.properties, from, to),
		objects:    rebasedKeys(source.objects, from, to),
		calls:      rebasedKeys(source.calls, from, to),
		specials:   rebasedKeys(source.specials, from, to),
		implicit:   source.implicit,
	}
}

func rebasedKey(key, from, to string) (string, bool) {
	rest, found := strings.CutPrefix(key, from)
	return to + rest, found
}

func rebasedKeys[V any](source map[string]V, from, to string) map[string]V {
	rebased := make(map[string]V, len(source))
	for key, value := range source {
		if target, found := rebasedKey(key, from, to); found {
			rebased[target] = value
		}
	}
	return rebased
}

const unitResponseShape = "((response) => ({ status: response.status, statusMessage: response.statusText, data: typeof response.body === 'string' ? response.body : JSON.stringify(response.body), headers: response.headers, responseTime: response.responseTime }))"

func unitTestDialect(targets map[string]string) *dialect {
	testing := *insomniaDialect
	testing.specials = map[string]special{}
	for name, render := range insomniaDialect.specials {
		testing.specials[name] = render
	}
	testing.specials[insomniaRoot+".send"] = func(t *translator, call *ast.CallExpression) string { return t.renderUnitSend(call, targets) }
	return &testing
}

func (t *translator) renderUnitSend(call *ast.CallExpression, targets map[string]string) string {
	if len(call.ArgumentList) == 0 {
		t.translated++
		return unitResponseShape + "(res)"
	}
	literal, isLiteral := call.ArgumentList[0].(*ast.StringLiteral)
	target, known := "", false
	if isLiteral {
		target, known = targets[requestKey(string(literal.Value))]
	}
	if len(call.ArgumentList) != 1 || !known {
		t.fail(call, locales.ImporterScriptUnsupported, locales.Params{"name": insomniaRoot + ".send()"})
		return t.text(call)
	}
	t.translated++
	return "sendRequest(" + strconv.Quote(target) + ").then(" + unitResponseShape + ")"
}

func indent(code string) string {
	lines := strings.Split(code, "\n")
	for index, line := range lines {
		if line != "" {
			lines[index] = "  " + line
		}
	}
	return strings.Join(lines, "\n")
}
