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
	collectNodes(reflect.ValueOf(parent).Elem(), &found)
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

func collectNodes(value reflect.Value, found *[]span) {
	if value.Kind() != reflect.Struct {
		return
	}
	for index := 0; index < value.NumField(); index++ {
		if skippedChildren[value.Type().Field(index).Name] {
			continue
		}
		collectField(value.Field(index), found)
	}
}

func collectField(field reflect.Value, found *[]span) {
	switch field.Kind() {
	case reflect.Slice:
		for index := 0; index < field.Len(); index++ {
			collectField(field.Index(index), found)
		}
	case reflect.Interface:
		if !field.IsNil() {
			collectField(field.Elem(), found)
		}
	case reflect.Pointer:
		collectPointer(field, found)
	case reflect.Struct:
		collectEmbedded(field, found)
	}
}

func collectPointer(field reflect.Value, found *[]span) {
	if field.IsNil() || !field.Type().Implements(nodeType) {
		return
	}
	node := field.Interface().(ast.Node)
	if from, to := int(node.Idx0()), int(node.Idx1()); from > 0 && to >= from {
		*found = append(*found, span{node: node, start: from - 1, end: to - 1})
	}
}

func collectEmbedded(field reflect.Value, found *[]span) {
	if field.CanAddr() && field.Addr().Type().Implements(nodeType) {
		collectPointer(field.Addr(), found)
		return
	}
	collectNodes(field, found)
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
