package importer

import (
	"strconv"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
)

var scriptGlobals = append(append([]string{}, gostmanGlobals...), brunoRoot, postmanRoot, insomniaRoot)

func (t *translator) bindingName(name string) string {
	if renamed, found := t.renamed[name]; found {
		return renamed
	}
	return name
}

func (t *translator) renderShorthand(property *ast.PropertyShort) string {
	name := string(property.Name.Name)
	if _, found := t.renamed[name]; !found {
		return t.renderChildren(property, nil)
	}
	return name + ": " + t.renderChildren(property, nil)
}

func renameCandidates(d *dialect, body *ast.BlockStatement) map[string]string {
	declared := (&translator{declared: map[string]bool{}})
	declared.collectDeclared(body)
	used := identifierNames(body)
	renames := map[string]string{}
	for _, name := range scriptGlobals {
		if declared.declared[name] && !d.roots[name] && !d.shared[name] {
			renames[name] = freshName(name, used)
		}
	}
	return renames
}

func freshName(name string, used map[string]bool) string {
	for suffix := 1; ; suffix++ {
		candidate := name + strconv.Itoa(suffix)
		if !used[candidate] {
			used[candidate] = true
			return candidate
		}
	}
}

func neededRenames(body *ast.BlockStatement, translated string, candidates map[string]string) map[string]string {
	if len(candidates) == 0 {
		return candidates
	}
	program, err := parser.ParseFile(nil, "", scriptPrefix+translated+scriptSuffix, 0)
	output := scriptBody(program)
	if err != nil || output == nil {
		return candidates
	}
	referenced := map[string]bool{}
	referencedNames(output, referenced, 0)
	topLevel := lexicalNames(body.List)
	needed := map[string]string{}
	for name, renamed := range candidates {
		if referenced[name] || topLevel[name] {
			needed[name] = renamed
		}
	}
	return needed
}

func lexicalNames(statements []ast.Statement) map[string]bool {
	t := &translator{declared: map[string]bool{}}
	for _, statement := range statements {
		switch declaration := statement.(type) {
		case *ast.LexicalDeclaration:
			t.declareBindings(declaration.List)
		case *ast.ClassDeclaration:
			t.declareIdentifier(declaration.Class.Name)
		}
	}
	return t.declared
}

func identifierNames(root ast.Node) map[string]bool {
	names := map[string]bool{}
	visit(root, func(node ast.Node) {
		if identifier, ok := node.(*ast.Identifier); ok {
			names[string(identifier.Name)] = true
		}
	}, 0)
	return names
}

func referencedNames(node ast.Node, found map[string]bool, depth int) {
	if depth > maxTreeDepth {
		return
	}
	switch current := node.(type) {
	case *ast.Identifier:
		found[string(current.Name)] = true
		return
	case *ast.DotExpression:
		referencedNames(current.Left, found, depth+1)
		return
	case *ast.PropertyKeyed:
		if current.Computed {
			referencedNames(current.Key, found, depth+1)
		}
		referencedNames(current.Value, found, depth+1)
		return
	}
	for _, child := range childNodes(node) {
		referencedNames(child.node, found, depth+1)
	}
}
