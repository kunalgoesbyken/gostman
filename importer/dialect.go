package importer

import (
	"strings"

	"github.com/dop251/goja/ast"
)

type special func(t *translator, call *ast.CallExpression) string

type receiver struct {
	fields   map[string]bool
	methods  map[string]bool
	callable bool
}

type dialect struct {
	name       string
	api        string
	roots      map[string]bool
	response   string
	properties map[string]string
	objects    map[string]string
	calls      map[string]callRule
	specials   map[string]special
	retired    map[string]bool
	implicit   map[string]string
	receivers  map[string]receiver
	native     map[string]map[string]bool
}

func (d *dialect) rebased(path chain) (string, int, bool) {
	for kept := len(path.segments); kept > 0; kept-- {
		prefix := chain{root: path.root, segments: path.segments[:kept]}
		if replacement, found := d.objects[prefix.text()]; found {
			return replacement, len(path.segments) - kept, true
		}
	}
	return "", 0, false
}

func (d *dialect) responsePath(path chain) (string, bool) {
	if d.response == "" || len(path.segments) == 0 || path.root+"."+path.segments[0] != d.response {
		return "", false
	}
	return strings.Join(path.segments[1:], "."), true
}

func (d *dialect) nativePath(path chain) (supported, native bool) {
	if len(path.segments) == 0 {
		return false, false
	}
	members, native := d.native[path.root+"."+path.segments[0]]
	switch {
	case !native:
		return false, false
	case len(path.segments) == 1:
		return true, true
	}
	return len(path.segments) == 2 && members[path.segments[1]], true
}
