package importer

import (
	"encoding/json"
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

func decodedValue(source string) any {
	var value any
	decoder := json.NewDecoder(strings.NewReader(source))
	decoder.UseNumber()
	if decoder.Decode(&value) != nil {
		return nil
	}
	return value
}

func noAuth() *engine.Auth {
	return &engine.Auth{Type: authNone}
}

func responseRow(expression, operator, value string) assertion {
	return assertion{Expression: expression, Operator: operator, Value: value, Enabled: true}
}
