package importer

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

const (
	scriptPrefix = "(async function(){\n"
	scriptSuffix = "\n})"

	maxScriptBytes  = 64 << 10
	translateBudget = 3 * time.Second
	maxTreeDepth    = 1500
)

type scriptNote struct {
	line int
	text string
}

type scriptTranslation struct {
	text       string
	notes      []scriptNote
	translated int
	failed     int
}

type translator struct {
	dialect      *dialect
	source       string
	wrapped      string
	notes        []scriptNote
	translated   int
	failed       int
	aliases      []string
	depth        int
	truncated    bool
	async        []bool
	declared     map[string]bool
	needs        map[string]bool
	awaitedCalls map[ast.Expression]bool
	noted        map[string]bool
}

func keptAsWritten(source, reason string) scriptTranslation {
	return scriptTranslation{text: source, notes: []scriptNote{{line: 1, text: reason}}, failed: 1}
}

func translateSource(d *dialect, source string) scriptTranslation {
	if len(source) > maxScriptBytes {
		return keptAsWritten(source, fmt.Sprintf(messageScriptTooLarge, maxScriptBytes>>10))
	}
	done := make(chan scriptTranslation, 1)
	go func() {
		defer func() {
			if recover() != nil {
				done <- keptAsWritten(source, messageScriptInternal)
			}
		}()
		done <- translateParsed(d, source)
	}()
	select {
	case result := <-done:
		return result
	case <-time.After(translateBudget):
		return keptAsWritten(source, messageScriptTooSlow)
	}
}

func translateParsed(d *dialect, source string) scriptTranslation {
	program, err := parser.ParseFile(nil, "", scriptPrefix+source+scriptSuffix, 0)
	if err != nil {
		return scriptTranslation{text: source, notes: []scriptNote{{line: 1, text: messageScriptSyntax}}, failed: 1}
	}
	body := scriptBody(program)
	if body == nil {
		return scriptTranslation{text: source}
	}
	if exceedsDepth(body, maxTreeDepth) {
		return scriptTranslation{text: source, notes: []scriptNote{{line: 1, text: messageScriptTooDeep}}, failed: 1}
	}
	t := &translator{dialect: d, source: source, wrapped: scriptPrefix + source + scriptSuffix, async: []bool{true}, declared: map[string]bool{}, needs: map[string]bool{}, noted: map[string]bool{}, awaitedCalls: map[ast.Expression]bool{}}
	t.collectDeclared(body)
	text := t.splice(len(scriptPrefix), len(scriptPrefix)+len(source), childNodes(body))
	if t.truncated {
		return scriptTranslation{text: source, notes: []scriptNote{{line: 1, text: messageScriptTooDeep}}, failed: 1}
	}
	return scriptTranslation{text: t.withRequires(text), notes: t.sortedNotes(), translated: t.translated, failed: t.failed}
}

func scriptBody(program *ast.Program) *ast.BlockStatement {
	if len(program.Body) != 1 {
		return nil
	}
	statement, ok := program.Body[0].(*ast.ExpressionStatement)
	if !ok {
		return nil
	}
	function, ok := statement.Expression.(*ast.FunctionLiteral)
	if !ok {
		return nil
	}
	return function.Body
}

func (t *translator) sortedNotes() []scriptNote {
	sort.SliceStable(t.notes, func(a, b int) bool { return t.notes[a].line < t.notes[b].line })
	return t.notes
}

func (t *translator) lineOf(offset int) int {
	local := offset - len(scriptPrefix)
	if local < 0 {
		return 1
	}
	if local > len(t.source) {
		local = len(t.source)
	}
	return strings.Count(t.source[:local], "\n") + 1
}

func (t *translator) fail(at ast.Node, format string, args ...any) {
	t.failed++
	t.notes = append(t.notes, scriptNote{line: t.lineOf(int(at.Idx0()) - 1), text: fmt.Sprintf(format, args...)})
}

func (t *translator) note(at ast.Node, key, text string) {
	if t.noted[key] {
		return
	}
	t.noted[key] = true
	t.notes = append(t.notes, scriptNote{line: t.lineOf(int(at.Idx0()) - 1), text: text})
}

func (t *translator) splice(from, to int, children []span) string {
	var out strings.Builder
	cursor := from
	for _, child := range children {
		if child.start < cursor || child.end > to {
			continue
		}
		out.WriteString(t.raw(cursor, child.start))
		out.WriteString(t.render(child.node))
		cursor = child.end
	}
	out.WriteString(t.raw(cursor, to))
	return out.String()
}

func (t *translator) raw(from, to int) string {
	from = max(0, min(from, len(t.wrapped)))
	to = max(from, min(to, len(t.wrapped)))
	return t.wrapped[from:to]
}

func (t *translator) text(node ast.Node) string {
	return t.raw(startOf(node), int(node.Idx1())-1)
}

func (t *translator) renderChildren(node ast.Node, skip func(ast.Node) bool) string {
	from, to := startOf(node), int(node.Idx1())-1
	var kept []span
	for _, child := range childNodes(node) {
		if skip == nil || !skip(child.node) {
			kept = append(kept, child)
		}
	}
	return t.splice(from, to, kept)
}

func (t *translator) render(node ast.Node) string {
	t.depth++
	defer func() { t.depth-- }()
	if t.depth > maxTreeDepth {
		t.truncated = true
		return t.text(node)
	}
	switch current := node.(type) {
	case *ast.CallExpression:
		return t.renderCall(current)
	case *ast.DotExpression:
		return t.renderMember(current)
	case *ast.BracketExpression:
		return t.renderMember(current)
	case *ast.Identifier:
		return t.renderIdentifier(current)
	case *ast.FunctionLiteral:
		return t.inFunction(current, current.Async)
	case *ast.ArrowFunctionLiteral:
		return t.inFunction(current, current.Async)
	case *ast.PropertyKeyed:
		return t.renderProperty(current)
	case *ast.AwaitExpression:
		t.awaitedCalls[current.Argument] = true
	}
	return t.renderChildren(node, nil)
}

func (t *translator) inFunction(node ast.Node, async bool) string {
	t.async = append(t.async, async)
	defer func() { t.async = t.async[:len(t.async)-1] }()
	return t.renderChildren(node, nil)
}

func (t *translator) renderProperty(property *ast.PropertyKeyed) string {
	if property.Computed {
		return t.renderChildren(property, nil)
	}
	return t.renderChildren(property, func(child ast.Node) bool { return child == ast.Node(property.Key) })
}

func (t *translator) inAsync() bool {
	return t.async[len(t.async)-1]
}

func (t *translator) aliased(name string) bool {
	for _, alias := range t.aliases {
		if alias == name {
			return true
		}
	}
	return false
}

func (t *translator) renderIdentifier(identifier *ast.Identifier) string {
	name := string(identifier.Name)
	if t.declared[name] {
		return name
	}
	if t.dialect.roots[name] {
		t.fail(identifier, messageScriptValue, name)
		return name
	}
	t.noteFreeIdentifier(identifier, name)
	return name
}

func (t *translator) noteFreeIdentifier(identifier *ast.Identifier, name string) {
	if _, implicit := t.dialect.implicit[name]; implicit {
		t.needs[name] = true
		return
	}
	if t.dialect.retired[name] {
		t.fail(identifier, messageScriptRetired, name)
	}
}

func (t *translator) renderMember(node ast.Expression) string {
	path, pure := chainOf(node)
	if pure && t.aliased(path.root) {
		if replacement, ok := responseProperty(path.root, path.path()); ok {
			t.translated++
			return replacement
		}
	}
	if pure && t.rooted(path.root) {
		return t.renderPath(node, path)
	}
	if dot, isDot := node.(*ast.DotExpression); isDot {
		return t.renderDot(dot)
	}
	return t.renderChildren(node, nil)
}

func (t *translator) renderDot(dot *ast.DotExpression) string {
	if string(dot.Identifier.Name) == jsonSchemaAssertion {
		t.fail(dot, messageScriptUnsupported, jsonSchemaAssertion)
	}
	return t.renderChildren(dot, func(child ast.Node) bool { return child == ast.Node(&dot.Identifier) })
}

func (t *translator) rooted(root string) bool {
	if t.declared[root] {
		return false
	}
	return t.dialect.roots[root]
}

func (t *translator) renderPath(node ast.Expression, path chain) string {
	if supported, native := t.dialect.nativePath(path); native {
		return t.keepNative(node, path.text(), supported, t.text(node))
	}
	if replacement, ok := t.property(node, path); ok {
		t.translated++
		return replacement
	}
	t.fail(node, messageScriptUnsupported, path.text())
	return t.text(node)
}

func (t *translator) property(node ast.Expression, path chain) (string, bool) {
	t.noteScope(node, path)
	if response, isResponse := t.dialect.responsePath(path); isResponse {
		return responseProperty(responseRoot, response)
	}
	rule, found := t.dialect.properties[path.text()]
	return rule, found
}

func (t *translator) noteScope(node ast.Node, path chain) {
	if len(path.segments) == 0 {
		return
	}
	name := path.root
	for _, segment := range path.segments {
		name += "." + segment
		if t.dialect.scoped[name] {
			t.note(node, name, fmt.Sprintf(messageScriptScope, name))
			return
		}
	}
}

func (t *translator) renderCall(call *ast.CallExpression) string {
	path, pure := chainOf(call.Callee)
	if pure && (t.rooted(path.root) || t.aliased(path.root)) {
		return t.renderRooted(call, path)
	}
	if kind, found := t.receiver(path.root); pure && found {
		return t.renderReceiver(call, path, kind)
	}
	if pure && path.root == "require" && len(path.segments) == 0 && !t.declared["require"] {
		t.checkRequire(call)
	}
	return t.renderChildren(call, nil)
}

func (t *translator) renderRooted(call *ast.CallExpression, path chain) string {
	if t.aliased(path.root) && !t.rooted(path.root) {
		return t.renderAliasCall(call, path)
	}
	if render, found := t.dialect.specials[path.text()]; found {
		return render(t, call)
	}
	args := t.renderArguments(call)
	if supported, native := t.dialect.nativePath(path); native {
		return t.keepNative(call, path.text()+"()", supported, t.text(call.Callee)+"("+strings.Join(args, ", ")+")")
	}
	if replacement, ok := t.callRule(call, path, args); ok {
		t.translated++
		return replacement
	}
	t.fail(call, messageScriptUnsupported, path.text()+"()")
	return t.text(call.Callee) + "(" + strings.Join(args, ", ") + ")"
}

func (t *translator) keepNative(node ast.Node, label string, supported bool, kept string) string {
	if !supported {
		t.fail(node, messageScriptUnsupported, label)
	}
	return kept
}

func (t *translator) renderAliasCall(call *ast.CallExpression, path chain) string {
	args := t.renderArguments(call)
	if replacement, ok := responseCall(path.root, path.path(), args); ok {
		t.translated++
		return replacement
	}
	return t.text(call.Callee) + "(" + strings.Join(args, ", ") + ")"
}

func (t *translator) callRule(call *ast.CallExpression, path chain, args []string) (string, bool) {
	t.noteScope(call, path)
	if response, isResponse := t.dialect.responsePath(path); isResponse {
		return responseCall(responseRoot, response, args)
	}
	rule, found := t.dialect.calls[path.text()]
	if !found {
		return "", false
	}
	return rule(args)
}

func (t *translator) renderArguments(call *ast.CallExpression) []string {
	args := make([]string, len(call.ArgumentList))
	for index, argument := range call.ArgumentList {
		args[index] = t.render(argument)
	}
	return args
}

func (t *translator) collectDeclared(root ast.Node) {
	declare := func(node ast.Node) {
		switch current := node.(type) {
		case *ast.Binding:
			t.declareTarget(current.Target)
		case *ast.FunctionLiteral:
			t.declareIdentifier(current.Name)
		case *ast.ClassLiteral:
			t.declareIdentifier(current.Name)
		case *ast.CatchStatement:
			t.declareTarget(current.Parameter)
		case *ast.ParameterList:
			t.declareTarget(current.Rest)
		}
	}
	visit(root, declare, 0)
}

func (t *translator) declareIdentifier(identifier *ast.Identifier) {
	if identifier != nil {
		t.declared[string(identifier.Name)] = true
	}
}

func (t *translator) declareTarget(target ast.Node) {
	if target == nil {
		return
	}
	visit(target, func(node ast.Node) {
		if identifier, ok := node.(*ast.Identifier); ok {
			t.declared[string(identifier.Name)] = true
		}
	}, 0)
}

func visit(node ast.Node, run func(ast.Node), depth int) {
	if depth > maxTreeDepth {
		return
	}
	run(node)
	for _, child := range childNodes(node) {
		visit(child.node, run, depth+1)
	}
}

func (t *translator) withRequires(text string) string {
	var names []string
	for name := range t.needs {
		names = append(names, name)
	}
	sort.Strings(names)
	var header strings.Builder
	for _, name := range names {
		header.WriteString(fmt.Sprintf("const %s = require(%q);\n", name, t.dialect.implicit[name]))
	}
	return header.String() + text
}
