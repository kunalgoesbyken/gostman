package fuzz

import (
	"math"
	"math/rand"
	"slices"
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/openapi"
)

const (
	maxDepth      = 5
	maxRefHops    = 8
	maxTextLength = 10000
	maxItems      = 8
	longText      = 10000
)

var sampleFormats = map[string]string{
	"date-time": "2024-01-02T03:04:05Z",
	"date":      "2024-01-02",
	"time":      "03:04:05Z",
	"email":     "user@example.com",
	"uuid":      "123e4567-e89b-42d3-a456-426614174000",
	"uri":       "https://example.com/path",
	"url":       "https://example.com/path",
	"hostname":  "example.com",
	"ipv4":      "192.0.2.1",
	"ipv6":      "2001:db8::1",
	"byte":      "aGVsbG8=",
}

type mutation struct {
	label string
	kind  string
	value any
}

type generator struct {
	targets openapi.Targets
	rng     *rand.Rand
}

func (g *generator) flatten(schema map[string]any) map[string]any {
	for hop := 0; hop < maxRefHops; hop++ {
		switch {
		case schema["$ref"] != nil:
			target, ok := g.targets.Resolve(text(schema["$ref"]))
			if !ok {
				return map[string]any{}
			}
			schema = target
		case len(list(schema["allOf"])) > 0:
			schema = g.merged(schema)
		case len(list(schema["oneOf"])) > 0:
			schema = object(list(schema["oneOf"])[0])
		case len(list(schema["anyOf"])) > 0:
			schema = object(list(schema["anyOf"])[0])
		default:
			return schema
		}
	}
	return map[string]any{}
}

func (g *generator) merged(schema map[string]any) map[string]any {
	out := map[string]any{}
	properties := map[string]any{}
	var required []any
	parts := append([]any{without(schema, "allOf")}, list(schema["allOf"])...)
	for _, part := range parts {
		flat := g.flatten(object(part))
		for key, value := range flat {
			switch key {
			case "properties":
				for name, property := range object(value) {
					properties[name] = property
				}
			case "required":
				required = append(required, list(value)...)
			default:
				out[key] = value
			}
		}
	}
	if len(properties) > 0 {
		out["properties"] = properties
	}
	if len(required) > 0 {
		out["required"] = required
	}
	return out
}

func kindOf(schema map[string]any) string {
	switch declared := schema["type"].(type) {
	case string:
		return declared
	case []any:
		for _, candidate := range declared {
			if name := text(candidate); name != "null" {
				return name
			}
		}
	}
	switch {
	case schema["properties"] != nil:
		return "object"
	case schema["items"] != nil:
		return "array"
	}
	if values := list(schema["enum"]); len(values) > 0 {
		return kindOfValue(values[0])
	}
	return "string"
}

func kindOfValue(value any) string {
	switch value.(type) {
	case bool:
		return "boolean"
	case float64, int, int64:
		return "number"
	}
	return "string"
}

func (g *generator) valid(schema map[string]any, depth int) any {
	schema = g.flatten(schema)
	if depth > maxDepth {
		return nil
	}
	if values := list(schema["enum"]); len(values) > 0 {
		return values[g.rng.Intn(len(values))]
	}
	if constant, ok := schema["const"]; ok {
		return constant
	}
	switch kindOf(schema) {
	case "integer", "number":
		return g.number(schema)
	case "boolean":
		return g.rng.Intn(2) == 0
	case "array":
		return g.array(schema, depth)
	case "object":
		return g.object(schema, depth)
	}
	return g.textOf(schema)
}

func (g *generator) number(schema map[string]any) any {
	integer := kindOf(schema) == "integer"
	low, high := bounds(schema)
	if exclusive(schema, "exclusiveMinimum", "minimum") {
		low += step(integer)
	}
	if exclusive(schema, "exclusiveMaximum", "maximum") {
		high -= step(integer)
	}
	if high < low {
		high = low
	}
	value := low + g.rng.Float64()*(math.Min(high, low+1000)-low)
	if integer {
		return math.Round(value)
	}
	return value
}

func step(integer bool) float64 {
	if integer {
		return 1
	}
	return 0.5
}

func bounds(schema map[string]any) (float64, float64) {
	low, hasLow := number(schema["minimum"])
	high, hasHigh := number(schema["maximum"])
	if exclusiveValue, ok := number(schema["exclusiveMinimum"]); ok {
		low, hasLow = exclusiveValue, true
	}
	if exclusiveValue, ok := number(schema["exclusiveMaximum"]); ok {
		high, hasHigh = exclusiveValue, true
	}
	switch {
	case !hasLow && !hasHigh:
		return 0, 100
	case !hasLow:
		return math.Min(0, high), high
	case !hasHigh:
		return low, math.Max(100, low)
	}
	return low, high
}

func exclusive(schema map[string]any, keyword, limit string) bool {
	flag, isFlag := schema[keyword].(bool)
	if isFlag {
		return flag && schema[limit] != nil
	}
	_, isNumber := number(schema[keyword])
	return isNumber
}

func (g *generator) textOf(schema map[string]any) string {
	if sample, ok := sampleFormats[text(schema["format"])]; ok {
		return sample
	}
	least := int(clamp(schema["minLength"], 0, maxTextLength))
	most := int(clamp(schema["maxLength"], float64(max(least, 8)), maxTextLength))
	return padded("sample", least, most)
}

func padded(base string, least, most int) string {
	for len(base) < least {
		base += "x"
	}
	if len(base) > most {
		return base[:most]
	}
	return base
}

func (g *generator) array(schema map[string]any, depth int) any {
	count := int(clamp(schema["minItems"], 1, maxItems))
	if limit, ok := number(schema["maxItems"]); ok {
		count = int(math.Min(float64(count), math.Max(limit, 0)))
	}
	items := make([]any, count)
	for index := range items {
		items[index] = g.valid(object(schema["items"]), depth+1)
	}
	return items
}

func (g *generator) object(schema map[string]any, depth int) any {
	out := map[string]any{}
	properties := object(schema["properties"])
	for _, name := range sortedNames(properties) {
		property := g.flatten(object(properties[name]))
		if property["readOnly"] == true {
			continue
		}
		out[name] = g.valid(property, depth+1)
	}
	for _, name := range list(schema["required"]) {
		if _, present := out[text(name)]; !present && text(name) != "" {
			out[text(name)] = "sample"
		}
	}
	return out
}

func (g *generator) mutations(schema map[string]any, depth int) []mutation {
	schema = g.flatten(schema)
	if depth > maxDepth {
		return nil
	}
	var found []mutation
	if values := list(schema["enum"]); len(values) > 0 {
		found = append(found, mutation{"value outside the enum", "invalid", "__not_in_enum__"})
	}
	switch kindOf(schema) {
	case "integer", "number":
		found = append(found, numberMutations(schema)...)
	case "array":
		found = append(found, g.arrayMutations(schema, depth)...)
	case "object":
		found = append(found, g.objectMutations(schema, depth)...)
	case "string":
		found = append(found, textMutations(schema)...)
	}
	return append(found, typeMutations(schema)...)
}

func typeMutations(schema map[string]any) []mutation {
	var found []mutation
	if schema["nullable"] != true {
		found = append(found, mutation{"null", "invalid", nil})
	}
	wrong := map[string]any{"string": 12345, "integer": "not a number", "number": "not a number", "boolean": "maybe", "array": "not an array", "object": []any{}}
	if value, ok := wrong[kindOf(schema)]; ok {
		found = append(found, mutation{"wrong type", "invalid", value})
	}
	return found
}

func textMutations(schema map[string]any) []mutation {
	found := []mutation{
		{"empty string", "boundary", ""},
		{"very long string", "boundary", strings.Repeat("a", longText)},
		{"unicode string", "boundary", "‮☃\U0001F600\u0000"},
	}
	if least, ok := number(schema["minLength"]); ok && least > 0 && least <= maxTextLength {
		found = append(found, mutation{"minLength", "boundary", padded("", int(least), int(least))})
		found = append(found, mutation{"below minLength", "invalid", padded("", int(least)-1, int(least)-1)})
	}
	if most, ok := number(schema["maxLength"]); ok && most >= 0 && most < maxTextLength {
		found = append(found, mutation{"maxLength", "boundary", padded("", int(most), int(most))})
		found = append(found, mutation{"above maxLength", "invalid", padded("", int(most)+1, int(most)+1)})
	}
	if format := text(schema["format"]); sampleFormats[format] != "" {
		found = append(found, mutation{"malformed " + format, "invalid", "not-a-" + format})
	}
	return found
}

func numberMutations(schema map[string]any) []mutation {
	found := []mutation{
		{"zero", "boundary", 0},
		{"negative one", "boundary", -1},
		{"int32 maximum", "boundary", math.MaxInt32},
		{"int64 maximum", "boundary", int64(math.MaxInt64)},
	}
	if low, ok := number(schema["minimum"]); ok {
		found = append(found, mutation{"minimum", "boundary", low}, mutation{"below minimum", "invalid", low - step(kindOf(schema) == "integer")})
	}
	if high, ok := number(schema["maximum"]); ok {
		found = append(found, mutation{"maximum", "boundary", high}, mutation{"above maximum", "invalid", high + step(kindOf(schema) == "integer")})
	}
	if kindOf(schema) == "integer" {
		found = append(found, mutation{"fraction for an integer", "invalid", 1.5})
	}
	return found
}

func (g *generator) arrayMutations(schema map[string]any, depth int) []mutation {
	found := []mutation{{"empty array", "boundary", []any{}}}
	if least, ok := number(schema["minItems"]); ok && least >= 1 && least <= maxItems {
		found = append(found, mutation{"below minItems", "invalid", make([]any, int(least)-1)})
	}
	if most, ok := number(schema["maxItems"]); ok && most >= 0 && most < maxItems {
		found = append(found, mutation{"above maxItems", "invalid", slices.Repeat([]any{g.valid(object(schema["items"]), depth+1)}, int(most)+1)})
	}
	for _, inner := range g.mutations(object(schema["items"]), depth+1) {
		found = append(found, mutation{"item: " + inner.label, inner.kind, []any{inner.value}})
	}
	return found
}

func (g *generator) objectMutations(schema map[string]any, depth int) []mutation {
	var found []mutation
	base, _ := g.valid(schema, depth).(map[string]any)
	properties := object(schema["properties"])
	for _, name := range sortedNames(properties) {
		for _, inner := range g.mutations(object(properties[name]), depth+1) {
			found = append(found, mutation{name + ": " + inner.label, inner.kind, with(base, name, inner.value)})
		}
	}
	for _, name := range list(schema["required"]) {
		found = append(found, mutation{"missing " + text(name), "invalid", without(base, text(name))})
	}
	if schema["additionalProperties"] == false {
		found = append(found, mutation{"unexpected property", "invalid", with(base, "__unexpected", 1)})
	}
	return found
}

func sortedNames(values map[string]any) []string {
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func with(base map[string]any, name string, value any) map[string]any {
	out := make(map[string]any, len(base)+1)
	for key, existing := range base {
		out[key] = existing
	}
	out[name] = value
	return out
}

func without(base map[string]any, name string) map[string]any {
	out := make(map[string]any, len(base))
	for key, existing := range base {
		if key != name {
			out[key] = existing
		}
	}
	return out
}

func object(value any) map[string]any {
	typed, _ := value.(map[string]any)
	return typed
}

func list(value any) []any {
	typed, _ := value.([]any)
	return typed
}

func text(value any) string {
	typed, _ := value.(string)
	return typed
}

func number(value any) (float64, bool) {
	var typed float64
	switch converted := value.(type) {
	case float64:
		typed = converted
	case int:
		typed = float64(converted)
	case int64:
		typed = float64(converted)
	default:
		return 0, false
	}
	if math.IsNaN(typed) || math.IsInf(typed, 0) {
		return 0, false
	}
	return typed, true
}

func clamp(value any, low, high float64) float64 {
	typed, ok := number(value)
	if !ok {
		return low
	}
	return math.Max(low, math.Min(typed, high))
}
