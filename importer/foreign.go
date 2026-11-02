package importer

import (
	"path"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	FormatHoppscotch = "hoppscotch"
	FormatThunder    = "thunder"
	FormatHTTPie     = "httpie"
	FormatHurl       = "hurl"
	FormatRAML       = "raml"
	FormatBlueprint  = "blueprint"
)

var documentReaders = map[string]func(*collector, document){
	kindHoppscotch:            (*collector).readHoppscotch,
	kindHoppscotchEnvironment: (*collector).readHoppscotchEnvironments,
	kindFirecamp:              (*collector).readFirecamp,
	kindThunder:               (*collector).readThunder,
	kindThunderEnvironment:    (*collector).readThunderEnvironment,
	kindHTTPie:                (*collector).readHTTPie,
	kindRAML:                  (*collector).readRAML,
	kindBlueprint:             (*collector).readBlueprint,
}

func classifyForeign(data any) string {
	if kind := hoppscotchKind(data); kind != kindUnknown {
		return kind
	}
	root := object(data)
	switch {
	case root == nil:
		return kindUnknown
	case firecampKind(root):
		return kindFirecamp
	case httpieKind(root):
		return kindHTTPie
	}
	return thunderKind(root)
}

func classifyForeignText(name, source string) string {
	switch {
	case path.Ext(strings.ToLower(name)) == hurlExtension:
		return kindHurl
	case looksLikeRAML(source):
		return kindRAML
	case looksLikeBlueprint(name, source):
		return kindBlueprint
	}
	return kindUnknown
}

func fieldRows(value any, keyField, valueField string, enabled func(map[string]any) bool) []row {
	var rows []row
	for _, item := range objects(value) {
		rows = append(rows, row{Key: text(item[keyField]), Value: text(item[valueField]), Enabled: enabled(item)})
	}
	return keyedRows(rows)
}

func firstOf(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func noAuth() *engine.Auth {
	return &engine.Auth{Type: authNone}
}

func responseRow(expression, operator, value string) assertion {
	return assertion{Expression: expression, Operator: operator, Value: value, Enabled: true}
}
