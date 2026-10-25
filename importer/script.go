package importer

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
	"github.com/kunalgoesbyken/gostman/locales"
)

const (
	scriptPrefix = "(async function(){\n"
	scriptSuffix = "\n})"

	maxScriptBytes  = 64 << 10
	translateBudget = 3 * time.Second
	maxTreeDepth    = 1500
)

const (
	noteSendScope = "sendRequest-scope"
	noteLeftOver  = "left-over"
)

type scriptNote struct {
	line int
	text string
	key  string
	said *locales.Message
}

func importNote(line int, key string, said locales.Message) scriptNote {
	return scriptNote{line: line, text: said.String(), key: key, said: &said}
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
	renamed      map[string]string
	outerScopes  map[ast.Node]map[string]bool
}

func keptAsWritten(source string, reason locales.Message) scriptTranslation {
	return scriptTranslation{text: source, notes: []scriptNote{importNote(1, "", reason)}, failed: 1}
}

func translateSource(d *dialect, source string) scriptTranslation {
	if len(source) > maxScriptBytes {
		return keptAsWritten(source, locales.New(locales.ImporterScriptTooLarge, locales.Params{"size": maxScriptBytes >> 10}))
	}
	done := make(chan scriptTranslation, 1)
	go func() {
		defer func() {
			if recover() != nil {
				done <- keptAsWritten(source, locales.New(locales.ImporterScriptInternal, nil))
			}
		}()
		done <- translateParsed(d, source)
	}()
	select {
	case result := <-done:
		return result
	case <-time.After(translateBudget):
		return keptAsWritten(source, locales.New(locales.ImporterScriptTooSlow, nil))
	}
}

func translateParsed(d *dialect, source string) scriptTranslation {
	program, err := parser.ParseFile(nil, "", scriptPrefix+source+scriptSuffix, 0)
	if err != nil {
		return scriptTranslation{text: source, notes: []scriptNote{importNote(1, "", locales.New(locales.ImporterScriptSyntax, nil))}, failed: 1}
	}
	body := scriptBody(program)
	if body == nil {
		return scriptTranslation{text: source}
	}
	if exceedsDepth(body, maxTreeDepth) {
		return scriptTranslation{text: source, notes: []scriptNote{importNote(1, "", locales.New(locales.ImporterScriptTooDeep, nil))}, failed: 1}
	}
	candidates := renameCandidates(d, body)
	t, text := translateBody(d, source, body, candidates)
	if needed := neededRenames(body, text, candidates); len(needed) != len(candidates) {
		t, text = translateBody(d, source, body, needed)
	}
	if t.truncated {
		return scriptTranslation{text: source, notes: []scriptNote{importNote(1, "", locales.New(locales.ImporterScriptTooDeep, nil))}, failed: 1}
	}
	return scriptTranslation{text: t.withRequires(text), notes: t.sortedNotes(), translated: t.translated, failed: t.failed}
}

func translateBody(d *dialect, source string, body *ast.BlockStatement, renamed map[string]string) (*translator, string) {
	t := &translator{dialect: d, source: source, wrapped: scriptPrefix + source + scriptSuffix, async: []bool{true}, declared: declaredIn(body.List), needs: map[string]bool{}, noted: map[string]bool{}, awaitedCalls: map[ast.Expression]bool{}, renamed: renamed, outerScopes: map[ast.Node]map[string]bool{}}
	return t, t.splice(len(scriptPrefix), len(scriptPrefix)+len(source), childNodes(body))
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

func (t *translator) fail(at ast.Node, code locales.Code, params locales.Params) {
	t.failed++
	t.notes = append(t.notes, importNote(t.lineOf(int(at.Idx0())-1), noteLeftOver, locales.New(code, params)))
}

func (t *translator) note(at ast.Node, key string, code locales.Code) {
	t.noteSaid(at, key, locales.New(code, nil))
}

func (t *translator) noteSaid(at ast.Node, key string, said locales.Message) {
	if t.noted[key] {
		return
	}
	t.noted[key] = true
	t.notes = append(t.notes, importNote(t.lineOf(int(at.Idx0())-1), key, said))
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
	if scope, outside := t.outerScopes[node]; outside {
		inner := t.declared
		t.declared = scope
		defer func() { t.declared = inner }()
	}
	if opensScope(node) {
		outer := t.declared
		t.declared = shadowedWithin(outer, node)
		defer func() { t.declared = outer }()
		if child := outsideScope(node); child != nil {
			t.outerScopes[child] = outer
		}
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
	case *ast.PropertyShort:
		return t.renderShorthand(current)
	case *ast.AwaitExpression:
		t.awaitedCalls[current.Argument] = true
	case *ast.AssignExpression:
		if rendered, ok := t.renderLegacyTest(current); ok {
			return rendered
		}
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
		return t.bindingName(name)
	}
	if t.dialect.roots[name] {
		if replacement, ok := t.dialect.properties[name]; ok {
			t.translated++
			return replacement
		}
		t.fail(identifier, locales.ImporterScriptValue, locales.Params{"name": name})
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
		t.fail(identifier, locales.ImporterScriptRetired, locales.Params{"name": name})
	}
}

func (t *translator) renderMember(node ast.Expression) string {
	path, pure := chainOf(node)
	if pure && t.aliased(path.root) {
		if replacement, ok := responseProperty(t.bindingName(path.root), path.path()); ok {
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
	t.fail(node, locales.ImporterScriptUnsupported, locales.Params{"name": path.text()})
	return t.text(node)
}

func (t *translator) property(node ast.Expression, path chain) (string, bool) {
	if response, isResponse := t.dialect.responsePath(path); isResponse {
		return responseProperty(responseRoot, response)
	}
	if replacement, ok := t.rebased(node, path); ok {
		return replacement, true
	}
	rule, found := t.dialect.properties[path.text()]
	return rule, found
}

func (t *translator) rebased(node ast.Expression, path chain) (string, bool) {
	replacement, outer, found := t.dialect.rebased(path)
	if !found {
		return "", false
	}
	inner := node
	for ; outer > 0; outer-- {
		inner = memberObject(inner)
	}
	return replacement + t.raw(int(inner.Idx1())-1, int(node.Idx1())-1), true
}

func memberObject(node ast.Expression) ast.Expression {
	switch member := node.(type) {
	case *ast.DotExpression:
		return member.Left
	case *ast.BracketExpression:
		return member.Left
	}
	return node
}

func (t *translator) renderCall(call *ast.CallExpression) string {
	path, pure := chainOf(call.Callee)
	if inspect, found := t.dialect.checks[path.text()]; pure && found {
		inspect(t, call)
	}
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
	return t.unsupportedCall(call, path, args)
}

func (t *translator) unsupportedCall(call *ast.CallExpression, path chain, args []string) string {
	t.fail(call, locales.ImporterScriptUnsupported, locales.Params{"name": path.text() + "()"})
	return t.text(call.Callee) + "(" + strings.Join(args, ", ") + ")"
}

func (t *translator) keepNative(node ast.Node, label string, supported bool, kept string) string {
	if !supported {
		t.fail(node, locales.ImporterScriptUnsupported, locales.Params{"name": label})
	}
	return kept
}

func (t *translator) renderAliasCall(call *ast.CallExpression, path chain) string {
	args := t.renderArguments(call)
	if replacement, ok := responseCall(t.bindingName(path.root), path.path(), args, call.ArgumentList); ok {
		t.translated++
		return replacement
	}
	return t.render(call.Callee) + "(" + strings.Join(args, ", ") + ")"
}

func (t *translator) callRule(call *ast.CallExpression, path chain, args []string) (string, bool) {
	if response, isResponse := t.dialect.responsePath(path); isResponse {
		return responseCall(responseRoot, response, args, call.ArgumentList)
	}
	rule, found := t.dialect.calls[path.text()]
	if found {
		return rule(args)
	}
	if callee, ok := t.rebased(call.Callee, path); ok {
		return callee + "(" + strings.Join(args, ", ") + ")", true
	}
	return "", false
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
		case *ast.ForDeclaration:
			t.declareTarget(current.Target)
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
	switch current := target.(type) {
	case *ast.Identifier:
		t.declareIdentifier(current)
	case *ast.ArrayPattern:
		for _, element := range current.Elements {
			t.declareTarget(element)
		}
		t.declareTarget(current.Rest)
	case *ast.ObjectPattern:
		for _, property := range current.Properties {
			t.declareTarget(property)
		}
		t.declareTarget(current.Rest)
	case *ast.PropertyShort:
		t.declareIdentifier(&current.Name)
	case *ast.PropertyKeyed:
		t.declareTarget(current.Value)
	case *ast.AssignExpression:
		t.declareTarget(current.Left)
	}
}

func (t *translator) declareParameters(parameters *ast.ParameterList) {
	if parameters != nil {
		t.declareBindings(parameters.List)
		t.declareTarget(parameters.Rest)
	}
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
