package importer

import (
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
	"github.com/dop251/goja/token"
)

const (
	runRequestName   = "bru.runRequest"
	runRequestCall   = runRequestName + "(%s)"
	runRequestTarget = "request"
	savedRequestCall = "sendRequest"
)

func (target *scriptTarget) withRequests(paths map[string]string) *scriptTarget {
	copied := *target
	copied.requests = paths
	return &copied
}

func (target *scriptTarget) withRequestTable(table map[string]string) *scriptTarget {
	if len(table) == 0 {
		return target
	}
	copied := *target
	copied.shims = slices.Clone(target.shims)
	from := fmt.Sprintf(runRequestCall, runRequestTarget)
	to := fmt.Sprintf(runRequestCall, requestTableText(table)+"["+runRequestTarget+"] ?? "+runRequestTarget)
	for index, candidate := range copied.shims {
		if candidate.key == savedRequestCall {
			copied.shims[index].text = strings.Replace(candidate.text, from, to, 1)
		}
	}
	return &copied
}

func requestTableText(table map[string]string) string {
	names := make([]string, 0, len(table))
	for name := range table {
		names = append(names, name)
	}
	sort.Strings(names)
	pairs := make([]string, len(names))
	for index, name := range names {
		pairs[index] = jsString(name) + ": " + jsString(table[name])
	}
	return "{ " + strings.Join(pairs, ", ") + " }"
}

func (target *scriptTarget) forScript(r scriptRead, wanted map[string]bool) (*scriptTarget, []scriptNote) {
	if target.requests == nil || !wanted[savedRequestCall] {
		return target, nil
	}
	table := map[string]string{}
	missing := map[string]bool{}
	var notes []scriptNote
	for _, call := range savedRequestCalls(r.body) {
		name := string(call.ArgumentList[0].(*ast.StringLiteral).Value)
		location, found := target.requests[name]
		switch {
		case !found && !missing[name]:
			missing[name] = true
			notes = append(notes, scriptNote{line: r.lineOf(call), text: fmt.Sprintf(messageExportRunRequest, name)})
		case found && location != name:
			table[name] = location
		}
	}
	return target.withRequestTable(table), notes
}

func savedRequestCalls(root ast.Node) []*ast.CallExpression {
	var calls []*ast.CallExpression
	visit(root, func(node ast.Node) {
		call, isCall := node.(*ast.CallExpression)
		if !isCall || len(call.ArgumentList) == 0 {
			return
		}
		callee, named := call.Callee.(*ast.Identifier)
		if _, literal := call.ArgumentList[0].(*ast.StringLiteral); named && literal && string(callee.Name) == savedRequestCall {
			calls = append(calls, call)
		}
	}, 0)
	return calls
}

func requestTableIn(definitions []definitionText) map[string]string {
	index := slices.IndexFunc(definitions, func(definition definitionText) bool { return definition.name == savedRequestCall })
	if index < 0 {
		return nil
	}
	program, err := parser.ParseFile(nil, "", definitions[index].text, 0)
	if err != nil {
		return nil
	}
	var table map[string]string
	visit(program, func(node ast.Node) {
		if table == nil {
			table = tableArgument(node)
		}
	}, 0)
	return table
}

func tableArgument(node ast.Node) map[string]string {
	call, isCall := node.(*ast.CallExpression)
	if !isCall || len(call.ArgumentList) != 1 {
		return nil
	}
	callee, pure := chainOf(call.Callee)
	fallback, coalesced := call.ArgumentList[0].(*ast.BinaryExpression)
	if !pure || callee.text() != runRequestName || !coalesced || fallback.Operator != token.COALESCE {
		return nil
	}
	lookup, isLookup := fallback.Left.(*ast.BracketExpression)
	if !isLookup {
		return nil
	}
	object, isObject := lookup.Left.(*ast.ObjectLiteral)
	if !isObject {
		return nil
	}
	return stringPairs(object)
}

func stringPairs(object *ast.ObjectLiteral) map[string]string {
	pairs := map[string]string{}
	for _, property := range object.Value {
		keyed, _ := property.(*ast.PropertyKeyed)
		name, named := propertyName(keyed)
		if !named {
			return nil
		}
		value, literal := keyed.Value.(*ast.StringLiteral)
		if !literal {
			return nil
		}
		pairs[name] = string(value.Value)
	}
	return pairs
}
