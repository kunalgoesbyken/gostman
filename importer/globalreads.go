package importer

import (
	"slices"
	"strings"

	"github.com/dop251/goja/ast"
	"github.com/dop251/goja/parser"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	globalsSegment    = "globals"
	collectionSegment = "collection"
)

func withGlobalsInCollection(source string) string {
	if !strings.Contains(source, globalAccess) {
		return source
	}
	program, err := parser.ParseFile(nil, "", scriptPrefix+source+scriptSuffix, 0)
	body := scriptBody(program)
	if err != nil || body == nil {
		return source
	}
	var offsets []int
	globalReads(body, &offsets)
	slices.Sort(offsets)
	for _, offset := range slices.Backward(offsets) {
		at := offset - len(scriptPrefix)
		source = source[:at] + collectionSegment + source[at+len(globalsSegment):]
	}
	return source
}

func withBakedGlobals(keys map[string]bool, source string) string {
	if keys[globalAccess+".get"] || keys[globalAccess+".has"] {
		return withGlobalsInCollection(source)
	}
	return source
}

func globalReads(node ast.Node, offsets *[]int) {
	if dot, ok := node.(*ast.DotExpression); ok {
		if root, named := dot.Left.(*ast.Identifier); named && string(root.Name) == environmentAccess && string(dot.Identifier.Name) == globalsSegment {
			*offsets = append(*offsets, startOf(&dot.Identifier))
		}
	}
	eachChild(node, func(child ast.Node) { globalReads(child, offsets) })
}

func (r Result) scriptsReadingCollection() Result {
	r.Requests = slices.Clone(r.Requests)
	for index := range r.Requests {
		r.Requests[index].PreScript = withGlobalsInCollection(r.Requests[index].PreScript)
		r.Requests[index].PostScript = withGlobalsInCollection(r.Requests[index].PostScript)
	}
	r.Folders = slices.Clone(r.Folders)
	for index := range r.Folders {
		r.Folders[index].Settings = settingsReadingCollection(r.Folders[index].Settings)
	}
	if r.Settings != nil {
		settings := settingsReadingCollection(*r.Settings)
		r.Settings = &settings
	}
	return r
}

func settingsReadingCollection(settings workspace.Settings) workspace.Settings {
	settings.PreScript = withGlobalsInCollection(settings.PreScript)
	settings.PostScript = withGlobalsInCollection(settings.PostScript)
	return settings
}
