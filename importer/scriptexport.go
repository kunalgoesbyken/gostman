package importer

import (
	"fmt"
	"maps"
	"slices"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
	"github.com/dop251/goja/token"
)

const (
	TargetPostman = "postman"
	TargetBruno   = "bruno"

	shimIndent  = "  "
	everyMember = ".*"
)

var gostmanGlobals = []string{"env", "req", "res", "test", "expect", "sendRequest", "setNextRequest", "skipRequest", "stopExecution", "utils", "visualize"}

type shim struct {
	key  string
	text string
}

type scriptTarget struct {
	name       string
	native     map[string]bool
	foreign    map[string]string
	shims      []shim
	missing    map[string]string
	hints      map[string]string
	helpers    []shim
	needs      map[string]string
	calls      map[string]func(call *ast.CallExpression) string
	schema     func(actual, schema string) string
	wrapOpen   string
	wrapClose  string
	extract    *extractForm
	assertRows bool
	requests   map[string]string
}

type scriptUse struct {
	key  string
	node ast.Node
	note string
}

type scriptRead struct {
	source   string
	body     *ast.BlockStatement
	declared map[string]bool
}

type adaptedScript struct {
	text    string
	defined []string
	notes   []scriptNote
	unread  bool
}

func readScript(source string) (scriptRead, bool) {
	program, err := parser.ParseFile(nil, "", scriptPrefix+source+scriptSuffix, 0)
	if err != nil {
		return scriptRead{}, false
	}
	body := scriptBody(program)
	if body == nil || exceedsDepth(body, maxTreeDepth) {
		return scriptRead{}, false
	}
	return scriptRead{source: source, body: body, declared: declaredIn(body.List)}, true
}

func declaredIn(statements []ast.Statement) map[string]bool {
	t := &translator{declared: map[string]bool{}}
	for _, statement := range statements {
		switch declaration := statement.(type) {
		case *ast.LexicalDeclaration:
			t.declareBindings(declaration.List)
		case *ast.FunctionDeclaration:
			t.declareIdentifier(declaration.Function.Name)
		case *ast.ClassDeclaration:
			t.declareIdentifier(declaration.Class.Name)
		}
		t.collectHoisted(statement, 0)
	}
	return t.declared
}

func (t *translator) declareBindings(bindings []*ast.Binding) {
	for _, binding := range bindings {
		t.declareTarget(binding.Target)
	}
}

func (t *translator) collectHoisted(node ast.Node, depth int) {
	if depth > maxTreeDepth {
		return
	}
	switch current := node.(type) {
	case *ast.FunctionLiteral, *ast.ArrowFunctionLiteral, *ast.ClassLiteral:
		return
	case *ast.VariableStatement:
		t.declareBindings(current.List)
	case *ast.ForLoopInitializerVarDeclList:
		t.declareBindings(current.List)
	case *ast.ForIntoVar:
		t.declareTarget(current.Binding.Target)
	}
	for _, child := range childNodes(node) {
		t.collectHoisted(child.node, depth+1)
	}
}

func shadowedWithin(shadowed map[string]bool, scope ast.Node) map[string]bool {
	t := &translator{declared: maps.Clone(shadowed)}
	switch current := scope.(type) {
	case *ast.FunctionLiteral:
		t.declareIdentifier(current.Name)
		t.collectDeclared(current.ParameterList)
	case *ast.ArrowFunctionLiteral:
		t.collectDeclared(current.ParameterList)
	case *ast.BlockStatement:
		maps.Copy(t.declared, declaredIn(current.List))
	case *ast.CatchStatement:
		t.declareTarget(current.Parameter)
	case *ast.ForOfStatement:
		t.declareTarget(current.Into)
	case *ast.ForInStatement:
		t.declareTarget(current.Into)
	case *ast.ForStatement:
		if initializer, lexical := current.Initializer.(*ast.ForLoopInitializerLexicalDecl); lexical {
			t.declareBindings(initializer.LexicalDeclaration.List)
		}
	}
	return t.declared
}

func (r scriptRead) offset(index int) int {
	return min(max(index-1-len(scriptPrefix), 0), len(r.source))
}

func (r scriptRead) lineOf(node ast.Node) int {
	return strings.Count(r.source[:r.offset(int(node.Idx0()))], "\n") + 1
}

func (target *scriptTarget) shimFor(key string) (string, bool) {
	index := slices.IndexFunc(target.shims, func(candidate shim) bool { return candidate.key == key })
	if index < 0 {
		return "", false
	}
	return target.shims[index].text, true
}

func (target *scriptTarget) knows(key string) bool {
	_, shimmed := target.shimFor(key)
	_, missing := target.missing[key]
	return shimmed || missing
}

func (target *scriptTarget) keyOf(path chain) string {
	for kept := len(path.segments); kept >= 0; kept-- {
		key := chain{root: path.root, segments: path.segments[:kept]}.text()
		if target.knows(key) {
			return key
		}
	}
	return path.text()
}

func (target *scriptTarget) isFree(r scriptRead, shadowed map[string]bool, name string) bool {
	return slices.Contains(gostmanGlobals, name) && !r.declared[name] && !shadowed[name] && !target.native[name]
}

func (r scriptRead) uses(target *scriptTarget) []scriptUse {
	var found []scriptUse
	record := func(key string, node ast.Node) { found = append(found, scriptUse{key: key, node: node}) }
	noteAt := func(note string, node ast.Node) { found = append(found, scriptUse{node: node, note: note}) }
	var walk func(node ast.Node, depth int, shadowed map[string]bool)
	walk = func(node ast.Node, depth int, shadowed map[string]bool) {
		if depth > maxTreeDepth {
			return
		}
		switch current := node.(type) {
		case *ast.FunctionLiteral, *ast.ArrowFunctionLiteral, *ast.BlockStatement, *ast.CatchStatement, *ast.ForOfStatement, *ast.ForInStatement, *ast.ForStatement:
			shadowed = shadowedWithin(shadowed, current)
		case *ast.DotExpression:
			if path, pure := chainOf(current); pure && target.isFree(r, shadowed, path.root) {
				record(target.keyOf(path), current)
				return
			}
			if hint, hinted := target.hints[string(current.Identifier.Name)]; hinted {
				noteAt(hint, current)
			}
			walk(current.Left, depth+1, shadowed)
			return
		case *ast.BracketExpression:
			if path, pure := chainOf(current); pure && target.isFree(r, shadowed, path.root) {
				record(target.keyOf(path), current)
				return
			}
		case *ast.Identifier:
			name := string(current.Name)
			if target.isFree(r, shadowed, name) {
				record(name+everyMember, current)
			}
			if message, foreign := target.foreign[name]; foreign && !r.declared[name] && !shadowed[name] {
				noteAt(fmt.Sprintf(message, name, target.name), current)
			}
			return
		case *ast.PropertyKeyed:
			if current.Computed {
				walk(current.Key, depth+1, shadowed)
			}
			walk(current.Value, depth+1, shadowed)
			return
		case *ast.CallExpression:
			if callee, isName := current.Callee.(*ast.Identifier); isName && target.isFree(r, shadowed, string(callee.Name)) {
				record(string(callee.Name), callee)
				if inspect, found := target.calls[string(callee.Name)]; found {
					if note := inspect(current); note != "" {
						noteAt(note, current)
					}
				}
				for _, argument := range current.ArgumentList {
					walk(argument, depth+1, shadowed)
				}
				return
			}
		}
		for _, child := range childNodes(node) {
			walk(child.node, depth+1, shadowed)
		}
	}
	walk(r.body, 0, map[string]bool{})
	return found
}

func (target *scriptTarget) membersOf(global string) []string {
	var keys []string
	for _, candidate := range target.shims {
		if candidate.key == global || strings.HasPrefix(candidate.key, global+".") {
			keys = append(keys, candidate.key)
		}
	}
	return keys
}

func (target *scriptTarget) noteFor(key string) string {
	if reason, known := target.missing[key]; known {
		return fmt.Sprintf(messageExportMissing, key, target.name, reason)
	}
	return fmt.Sprintf(messageExportUnknown, key, target.name)
}

func (target *scriptTarget) wanted(r scriptRead, uses []scriptUse) (map[string]bool, []scriptNote) {
	wanted := map[string]bool{}
	var notes []scriptNote
	noted := map[string]bool{}
	for _, use := range uses {
		if global, every := strings.CutSuffix(use.key, everyMember); every && use.note == "" {
			for _, key := range target.membersOf(global) {
				wanted[key] = true
			}
			continue
		}
		if _, shimmed := target.shimFor(use.key); shimmed && use.note == "" {
			wanted[use.key] = true
			continue
		}
		note := use.note
		if note == "" {
			note = target.noteFor(use.key)
		}
		if !noted[note] {
			noted[note] = true
			notes = append(notes, scriptNote{line: r.lineOf(use.node), text: note})
		}
	}
	return wanted, notes
}

func adaptScript(target *scriptTarget, source string) adaptedScript {
	if strings.TrimSpace(source) == "" {
		return adaptedScript{text: source}
	}
	r, ok := readScript(source)
	if !ok {
		return adaptedScript{text: source, unread: true}
	}
	wanted, notes := target.wanted(r, r.uses(target))
	target, pathNotes := target.forScript(r, wanted)
	return adaptedScript{text: target.header(wanted, r.declared) + target.wrapped(r, source), defined: target.definedNames(wanted), notes: append(notes, pathNotes...)}
}

func (target *scriptTarget) wrapped(r scriptRead, source string) string {
	if target.wrapOpen == "" || !hasTopLevelAwait(r.body) {
		return source
	}
	return target.wrapOpen + "\n" + source + "\n" + target.wrapClose
}

func (target *scriptTarget) unwrapped(source string) (string, bool) {
	if target.wrapOpen == "" {
		return source, false
	}
	inner, opened := strings.CutPrefix(source, target.wrapOpen+"\n")
	inner, closed := strings.CutSuffix(inner, "\n"+target.wrapClose)
	if !opened || !closed {
		return source, false
	}
	return inner, true
}

func hasTopLevelAwait(node ast.Node) bool {
	found := false
	var walk func(node ast.Node, depth int)
	walk = func(node ast.Node, depth int) {
		if found || depth > maxTreeDepth {
			return
		}
		switch node.(type) {
		case *ast.AwaitExpression:
			found = true
			return
		case *ast.FunctionLiteral, *ast.ArrowFunctionLiteral:
			if depth > 0 {
				return
			}
		}
		for _, child := range childNodes(node) {
			walk(child.node, depth+1)
		}
	}
	walk(node, 0)
	return found
}

func (target *scriptTarget) definedNames(wanted map[string]bool) []string {
	var names []string
	for _, global := range gostmanGlobals {
		if len(target.wantedUnder(global, wanted)) > 0 {
			names = append(names, global)
		}
	}
	return names
}

func (target *scriptTarget) wantedUnder(global string, wanted map[string]bool) []string {
	return slices.DeleteFunc(target.membersOf(global), func(key string) bool { return !wanted[key] })
}

func (target *scriptTarget) header(wanted map[string]bool, declared map[string]bool) string {
	var out strings.Builder
	for _, helper := range target.helpers {
		if !declared[helper.key] && target.helperWanted(helper.key, wanted) {
			out.WriteString(helper.text + "\n")
		}
	}
	for _, global := range gostmanGlobals {
		if keys := target.wantedUnder(global, wanted); len(keys) > 0 {
			out.WriteString(target.definition(global, keys) + "\n")
		}
	}
	if out.Len() == 0 {
		return ""
	}
	return out.String() + "\n"
}

func (target *scriptTarget) helperWanted(name string, wanted map[string]bool) bool {
	for key, helper := range target.needs {
		if helper == name && wanted[key] {
			return true
		}
	}
	return false
}

func (target *scriptTarget) definition(global string, keys []string) string {
	function, _ := target.shimFor(global)
	members := slices.DeleteFunc(slices.Clone(keys), func(key string) bool { return key == global })
	switch {
	case len(members) == 0:
		return "const " + global + " = " + function + ";"
	case slices.Contains(keys, global):
		return "const " + global + " = Object.assign(" + function + ", " + target.objectText(global, members, 0) + ");"
	}
	return "const " + global + " = " + target.objectText(global, members, 0) + ";"
}

func (target *scriptTarget) objectText(prefix string, keys []string, depth int) string {
	indent := strings.Repeat(shimIndent, depth+1)
	var out strings.Builder
	out.WriteString("{\n")
	var groups []string
	for _, key := range keys {
		group, _, nested := strings.Cut(strings.TrimPrefix(key, prefix+"."), ".")
		if !nested {
			text, _ := target.shimFor(key)
			out.WriteString(indent + strings.ReplaceAll(text, "\n", "\n"+indent) + ",\n")
			continue
		}
		if slices.Contains(groups, group) {
			continue
		}
		groups = append(groups, group)
		inner := prefix + "." + group
		children := slices.DeleteFunc(slices.Clone(keys), func(candidate string) bool { return !strings.HasPrefix(candidate, inner+".") })
		out.WriteString(indent + group + ": " + target.objectText(inner, children, depth+1) + ",\n")
	}
	out.WriteString(strings.Repeat(shimIndent, depth) + "}")
	return out.String()
}

func withoutExportHeader(target *scriptTarget, source string) (string, bool) {
	if target == nil {
		return source, false
	}
	rest, stripped := withoutDefinitions(target, source)
	inner, unwrapped := target.unwrapped(rest)
	return inner, stripped || unwrapped
}

func withoutDefinitions(target *scriptTarget, source string) (string, bool) {
	if !strings.HasPrefix(source, "const ") {
		return source, false
	}
	r, ok := readScript(source)
	if !ok {
		return source, false
	}
	definitions := target.leadingDefinitions(r)
	target = target.withRequestTable(requestTableIn(definitions))
	for count := len(definitions); count > 0; count-- {
		header := target.header(target.keysWithin(definitions[:count]), declaredIn(r.body.List[count:]))
		if header != "" && strings.HasPrefix(source, header) {
			return source[len(header):], true
		}
	}
	return source, false
}

func (target *scriptTarget) isDefinitionName(name string) bool {
	return slices.Contains(gostmanGlobals, name) || slices.ContainsFunc(target.helpers, func(helper shim) bool { return helper.key == name })
}

type definitionText struct {
	name string
	text string
}

func (target *scriptTarget) leadingDefinitions(r scriptRead) []definitionText {
	var definitions []definitionText
	for _, statement := range r.body.List {
		name, ok := constName(statement)
		if !ok || !target.isDefinitionName(name) {
			break
		}
		definitions = append(definitions, definitionText{name: name, text: "\n" + r.source[r.offset(int(statement.Idx0())):r.offset(int(statement.Idx1()))]})
	}
	return definitions
}

func constName(statement ast.Statement) (string, bool) {
	declaration, ok := statement.(*ast.LexicalDeclaration)
	if !ok || declaration.Token != token.CONST || len(declaration.List) != 1 {
		return "", false
	}
	identifier, ok := declaration.List[0].Target.(*ast.Identifier)
	if !ok {
		return "", false
	}
	return string(identifier.Name), true
}

func (target *scriptTarget) keysWithin(definitions []definitionText) map[string]bool {
	regions := map[string]string{}
	for _, definition := range definitions {
		regions[definition.name] = definition.text
	}
	keys := map[string]bool{}
	for _, candidate := range target.shims {
		global, _, _ := strings.Cut(candidate.key, ".")
		region := regions[global]
		if slices.ContainsFunc(firstLines(candidate), func(line string) bool { return strings.Contains(region, line) }) {
			keys[candidate.key] = true
		}
	}
	return keys
}

func firstLines(candidate shim) []string {
	line, _, _ := strings.Cut(candidate.text, "\n")
	if !strings.Contains(candidate.key, ".") {
		return []string{"\nconst " + candidate.key + " = " + line, "\nconst " + candidate.key + " = Object.assign(" + line}
	}
	return []string{"\n" + strings.Repeat(shimIndent, strings.Count(candidate.key, ".")) + line}
}
