package importer

import (
	"strings"

	"github.com/dop251/goja/ast"
)

type special func(t *translator, call *ast.CallExpression) string

type receiver struct {
	fields  map[string]bool
	methods map[string]string
	query   bool
}

type dialect struct {
	name       string
	api        string
	roots      map[string]bool
	response   string
	properties map[string]string
	calls      map[string]callRule
	specials   map[string]special
	scoped     map[string]bool
	retired    map[string]bool
	implicit   map[string]string
	receivers  map[string]receiver
}

func (d *dialect) responsePath(path chain) (string, bool) {
	if d.response == "" || len(path.segments) == 0 || path.root+"."+path.segments[0] != d.response {
		return "", false
	}
	return strings.Join(path.segments[1:], "."), true
}
