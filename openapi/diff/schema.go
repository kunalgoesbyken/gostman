package diff

import (
	"context"
	"fmt"
	"github.com/kunalgoesbyken/gostman/locales"
	"slices"
	"sort"
	"strings"
)

const (
	maxSchemaDepth = 32
	maxVisits      = 20000
	checkEvery     = 256
)

type direction int

const (
	asRequest direction = iota
	asResponse
)

type resolver struct {
	old    map[string]any
	new    map[string]any
	budget *budget
}

type budget struct {
	ctx       context.Context
	visits    int
	exhausted bool
	cut       bool
	compared  map[compareKey]int
}

type compareKey struct {
	oldRef string
	newRef string
	way    direction
}

func newBudget(ctx context.Context) *budget {
	return &budget{ctx: ctx, compared: map[compareKey]int{}}
}

func (b *budget) spend() bool {
	if b.exhausted {
		return false
	}
	b.visits++
	if b.visits > maxVisits || b.visits%checkEvery == 0 && b.ctx.Err() != nil {
		b.exhausted = true
	}
	return !b.exhausted
}

func (b *budget) incomplete() bool {
	return b.exhausted || b.cut
}

func (b *budget) tooDeep(depth int) bool {
	if depth <= maxSchemaDepth {
		return false
	}
	b.cut = true
	return true
}

func (b *budget) firstVisit(oldSchema, newSchema any, way direction, depth int) bool {
	oldRef, newRef := textOf(objectOf(oldSchema)["$ref"]), textOf(objectOf(newSchema)["$ref"])
	if oldRef == "" || newRef == "" {
		return true
	}
	key := compareKey{oldRef, newRef, way}
	if earlier, seen := b.compared[key]; seen && earlier <= depth {
		return false
	}
	b.compared[key] = depth
	return true
}

func objectOf(value any) map[string]any {
	object, _ := value.(map[string]any)
	return object
}

func listOf(value any) []any {
	list, _ := value.([]any)
	return list
}

func textOf(value any) string {
	if value == nil {
		return ""
	}
	return fmt.Sprint(value)
}

func numberOf(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	}
	return 0, false
}

func resolve(root map[string]any, value any) any {
	for hops := 0; hops < maxSchemaDepth; hops++ {
		reference := textOf(objectOf(value)["$ref"])
		pointer, local := strings.CutPrefix(reference, "#")
		if !local || reference == "" {
			return value
		}
		found := walk(root, pointer)
		if found == nil {
			return value
		}
		value = found
	}
	return value
}

func walk(root any, pointer string) any {
	current := root
	for _, token := range strings.Split(strings.TrimPrefix(pointer, "/"), "/") {
		if token == "" {
			continue
		}
		token = strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
		switch typed := current.(type) {
		case map[string]any:
			current = typed[token]
		default:
			return nil
		}
	}
	return current
}

type schemaView struct {
	types      []string
	nullable   bool
	enum       []string
	hasEnum    bool
	properties map[string]any
	required   map[string]bool
	items      any
	numbers    map[string]float64
	format     string
	pattern    string
	composed   map[string]int
	merged     map[string]bool
}

var numericLimits = []string{"minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "minProperties", "maxProperties"}

func (r resolver) view(root map[string]any, schema any, depth int) schemaView {
	view := schemaView{properties: map[string]any{}, required: map[string]bool{}, numbers: map[string]float64{}, composed: map[string]int{}, merged: map[string]bool{}}
	r.collect(root, schema, &view, depth)
	slices.Sort(view.types)
	return view
}

func (r resolver) collect(root map[string]any, schema any, view *schemaView, depth int) {
	if reference := textOf(objectOf(schema)["$ref"]); reference != "" {
		if view.merged[reference] {
			return
		}
		view.merged[reference] = true
	}
	object := objectOf(resolve(root, schema))
	if object == nil || r.budget.tooDeep(depth) || !r.budget.spend() {
		return
	}
	switch typed := object["type"].(type) {
	case string:
		view.types = appendOnce(view.types, typed)
	case []any:
		for _, item := range typed {
			if name := textOf(item); name == "null" {
				view.nullable = true
			} else {
				view.types = appendOnce(view.types, name)
			}
		}
	}
	if object["nullable"] == true {
		view.nullable = true
	}
	if values, ok := object["enum"].([]any); ok {
		view.hasEnum = true
		for _, value := range values {
			view.enum = appendOnce(view.enum, fmt.Sprintf("%v", value))
		}
	}
	for name, property := range objectOf(object["properties"]) {
		if _, seen := view.properties[name]; !seen {
			view.properties[name] = property
		}
	}
	for _, name := range listOf(object["required"]) {
		view.required[textOf(name)] = true
	}
	if object["items"] != nil && view.items == nil {
		view.items = object["items"]
	}
	for _, limit := range numericLimits {
		if number, ok := numberOf(object[limit]); ok {
			view.numbers[limit] = number
		}
	}
	if format := textOf(object["format"]); format != "" {
		view.format = format
	}
	if pattern := textOf(object["pattern"]); pattern != "" {
		view.pattern = pattern
	}
	for _, part := range listOf(object["allOf"]) {
		r.collect(root, part, view, depth+1)
	}
	for _, keyword := range []string{"oneOf", "anyOf"} {
		if parts := listOf(object[keyword]); len(parts) > 0 {
			view.composed[keyword] = len(parts)
		}
	}
	if len(view.types) == 0 && len(view.properties) > 0 {
		view.types = []string{"object"}
	}
}

func appendOnce(items []string, item string) []string {
	if slices.Contains(items, item) {
		return items
	}
	return append(items, item)
}

type reporter func(severity Severity, where string, said locales.Message)

func (r resolver) schemas(oldSchema, newSchema any, way direction, where string, report reporter) {
	r.compareSchemas(oldSchema, newSchema, way, where, report, 0)
}

func (r resolver) compareSchemas(oldSchema, newSchema any, way direction, where string, report reporter, depth int) {
	if r.budget.tooDeep(depth) || !r.budget.spend() || !r.budget.firstVisit(oldSchema, newSchema, way, depth) {
		return
	}
	before := r.view(r.old, oldSchema, 0)
	after := r.view(r.new, newSchema, 0)
	r.compareTypes(before, after, way, where, report)
	r.compareEnums(before, after, way, where, report)
	r.compareLimits(before, after, way, where, report)
	if before.format != after.format && before.format != "" {
		report(Breaking, where, locales.New(locales.LintDiffFormatChanged, locales.Params{"old": before.format, "new": valueOrNone(after.format)}))
	}
	if before.pattern != after.pattern && (before.pattern != "" || after.pattern != "") {
		report(Informational, where, locales.New(locales.LintDiffPatternChanged, nil))
	}
	for _, keyword := range []string{"oneOf", "anyOf"} {
		if before.composed[keyword] != after.composed[keyword] {
			report(Informational, where, locales.New(locales.LintDiffCompositionChanged, locales.Params{"keyword": keyword, "count": after.composed[keyword], "was": before.composed[keyword]}))
		}
	}
	r.compareProperties(before, after, oldSchema, newSchema, way, where, report, depth)
	if before.items != nil && after.items != nil {
		r.compareSchemas(before.items, after.items, way, where+"[]", report, depth+1)
	}
}

func valueOrNone(value string) string {
	if value == "" {
		return "-"
	}
	return value
}

func (r resolver) compareTypes(before, after schemaView, way direction, where string, report reporter) {
	if len(before.types) > 0 && len(after.types) > 0 && !slices.Equal(before.types, after.types) {
		removed, added := difference(before.types, after.types), difference(after.types, before.types)
		widened := len(removed) == 0
		narrowed := len(added) == 0
		switch {
		case way == asRequest && widened:
			report(NonBreaking, where, locales.New(locales.LintDiffTypeWidened, locales.Params{"types": locales.Unit(after.types)}))
		case way == asResponse && narrowed:
			report(NonBreaking, where, locales.New(locales.LintDiffTypeNarrowed, locales.Params{"types": locales.Unit(after.types)}))
		default:
			report(Breaking, where, locales.New(locales.LintDiffTypeChanged, locales.Params{"old": locales.Unit(before.types), "new": locales.Unit(after.types)}))
		}
	}
	switch {
	case before.nullable && !after.nullable && way == asRequest:
		report(Breaking, where, locales.New(locales.LintDiffNullRejected, nil))
	case !before.nullable && after.nullable && way == asResponse:
		report(Breaking, where, locales.New(locales.LintDiffNullReturned, nil))
	case before.nullable != after.nullable:
		report(NonBreaking, where, locales.New(locales.LintDiffNullabilityChanged, nil))
	}
}

func difference(first, second []string) []string {
	var only []string
	for _, item := range first {
		if !slices.Contains(second, item) {
			only = append(only, item)
		}
	}
	return only
}

func (r resolver) compareEnums(before, after schemaView, way direction, where string, report reporter) {
	switch {
	case !before.hasEnum && after.hasEnum:
		severity := Breaking
		if way == asResponse {
			severity = NonBreaking
		}
		report(severity, where, locales.New(locales.LintDiffEnumLimited, nil))
		return
	case before.hasEnum && !after.hasEnum:
		severity := NonBreaking
		if way == asResponse {
			severity = Breaking
		}
		report(severity, where, locales.New(locales.LintDiffEnumLimitRemoved, nil))
		return
	}
	removed, added := difference(before.enum, after.enum), difference(after.enum, before.enum)
	if len(removed) > 0 {
		severity := Breaking
		if way == asResponse {
			severity = NonBreaking
		}
		report(severity, where, locales.New(locales.LintDiffEnumRemoved, locales.Params{"values": locales.Unit(removed)}))
	}
	if len(added) > 0 {
		severity := NonBreaking
		if way == asResponse {
			severity = Informational
		}
		report(severity, where, locales.New(locales.LintDiffEnumAdded, locales.Params{"values": locales.Unit(added)}))
	}
}

func (r resolver) compareLimits(before, after schemaView, way direction, where string, report reporter) {
	lower := map[string]bool{"minimum": true, "minLength": true, "minItems": true, "minProperties": true}
	for _, limit := range numericLimits {
		oldValue, hadOld := before.numbers[limit]
		newValue, hasNew := after.numbers[limit]
		if hadOld == hasNew && oldValue == newValue {
			continue
		}
		tighter := hasNew && (!hadOld || lower[limit] && newValue > oldValue || !lower[limit] && newValue < oldValue)
		looser := hadOld && (!hasNew || lower[limit] && newValue < oldValue || !lower[limit] && newValue > oldValue)
		message := locales.New(locales.LintDiffLimitChanged, locales.Params{"limit": limit, "old": limitText(oldValue, hadOld), "new": limitText(newValue, hasNew)})
		switch {
		case tighter && way == asRequest, looser && way == asResponse:
			report(Breaking, where, message)
		default:
			report(NonBreaking, where, message)
		}
	}
}

func limitText(value float64, present bool) string {
	if !present {
		return "-"
	}
	return fmt.Sprint(value)
}

func (r resolver) compareProperties(before, after schemaView, oldSchema, newSchema any, way direction, where string, report reporter, depth int) {
	names := make([]string, 0, len(before.properties))
	for name := range before.properties {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		place := where + "." + name
		next, kept := after.properties[name]
		switch {
		case !kept && way == asResponse:
			report(Breaking, place, locales.New(locales.LintDiffPropertyRemoved, nil))
		case !kept:
			report(NonBreaking, place, locales.New(locales.LintDiffPropertyRemoved, nil))
		default:
			r.compareSchemas(before.properties[name], next, way, place, report, depth+1)
		}
		wasRequired, isRequired := before.required[name], after.required[name]
		switch {
		case kept && !wasRequired && isRequired && way == asRequest:
			report(Breaking, place, locales.New(locales.LintDiffPropertyNowRequired, nil))
		case kept && wasRequired && !isRequired && way == asResponse:
			report(Breaking, place, locales.New(locales.LintDiffPropertyNotAlwaysPresent, nil))
		case kept && wasRequired != isRequired:
			report(NonBreaking, place, locales.New(locales.LintDiffRequiredChanged, nil))
		}
	}
	added := make([]string, 0)
	for name := range after.properties {
		if _, existed := before.properties[name]; !existed {
			added = append(added, name)
		}
	}
	sort.Strings(added)
	for _, name := range added {
		place := where + "." + name
		switch {
		case way == asRequest && after.required[name]:
			report(Breaking, place, locales.New(locales.LintDiffRequiredPropertyAdded, nil))
		default:
			report(NonBreaking, place, locales.New(locales.LintDiffPropertyAdded, nil))
		}
	}
}
