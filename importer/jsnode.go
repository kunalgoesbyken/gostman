package importer

import (
	"reflect"
	"sort"
	"strings"

	"github.com/dop251/goja/ast"
)

var (
	nodeType        = reflect.TypeOf((*ast.Node)(nil)).Elem()
	skippedChildren = map[string]bool{"DeclarationList": true, "File": true}
)

type span struct {
	node       ast.Node
	start, end int
}

func childNodes(parent ast.Node) []span {
	var found []span
	eachChild(parent, func(node ast.Node) { found = appendSpan(found, node) })
	sort.SliceStable(found, func(a, b int) bool { return found[a].start < found[b].start })
	return disjoint(found)
}

func disjoint(sorted []span) []span {
	var kept []span
	for _, candidate := range sorted {
		if len(kept) > 0 && candidate.start < kept[len(kept)-1].end {
			continue
		}
		kept = append(kept, candidate)
	}
	return kept
}

func collectNodes(value reflect.Value, emit func(ast.Node)) {
	if value.Kind() != reflect.Struct {
		return
	}
	for index := 0; index < value.NumField(); index++ {
		if skippedChildren[value.Type().Field(index).Name] {
			continue
		}
		collectField(value.Field(index), emit)
	}
}

func collectField(field reflect.Value, emit func(ast.Node)) {
	switch field.Kind() {
	case reflect.Slice:
		for index := 0; index < field.Len(); index++ {
			collectField(field.Index(index), emit)
		}
	case reflect.Interface:
		if !field.IsNil() {
			collectField(field.Elem(), emit)
		}
	case reflect.Pointer:
		collectPointer(field, emit)
	case reflect.Struct:
		collectEmbedded(field, emit)
	}
}

func collectPointer(field reflect.Value, emit func(ast.Node)) {
	if field.IsNil() || !field.Type().Implements(nodeType) {
		return
	}
	emit(field.Interface().(ast.Node))
}

func appendSpan(found []span, node ast.Node) []span {
	if from, to := int(node.Idx0()), int(node.Idx1()); from > 0 && to >= from {
		return append(found, span{node: node, start: from - 1, end: to - 1})
	}
	return found
}

func eachChild(parent ast.Node, emit func(ast.Node)) {
	collectNodes(reflect.ValueOf(parent).Elem(), emit)
}

func exceedsDepth(node ast.Node, limit int) bool {
	if limit < 0 {
		return true
	}
	deeper := false
	eachChild(node, func(child ast.Node) {
		deeper = deeper || exceedsDepth(child, limit-1)
	})
	return deeper
}

func collectEmbedded(field reflect.Value, emit func(ast.Node)) {
	if field.CanAddr() && field.Addr().Type().Implements(nodeType) {
		collectPointer(field.Addr(), emit)
		return
	}
	collectNodes(field, emit)
}

type chain struct {
	root     string
	segments []string
}

func (c chain) path() string {
	return strings.Join(c.segments, ".")
}

func (c chain) text() string {
	return strings.Join(append([]string{c.root}, c.segments...), ".")
}

func chainOf(expression ast.Expression) (chain, bool) {
	switch node := expression.(type) {
	case *ast.Identifier:
		return chain{root: string(node.Name)}, true
	case *ast.DotExpression:
		return extend(node.Left, string(node.Identifier.Name))
	case *ast.BracketExpression:
		member, literal := node.Member.(*ast.StringLiteral)
		if !literal {
			return chain{}, false
		}
		return extend(node.Left, string(member.Value))
	}
	return chain{}, false
}

func extend(left ast.Expression, segment string) (chain, bool) {
	base, ok := chainOf(left)
	if !ok {
		return chain{}, false
	}
	base.segments = append(append([]string{}, base.segments...), segment)
	return base, true
}
