package fuzz

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"strings"

	"github.com/kunalgoesbyken/gostman/openapi"
)

const (
	Valid    = "valid"
	Boundary = "boundary"
	Invalid  = "invalid"

	DefaultPerOperation = 25
)

type Case struct {
	Target  openapi.Target
	Label   string
	Kind    string
	Params  map[string]any
	Body    any
	HasBody bool
}

func ParamKey(input openapi.Input) string {
	return input.In + ":" + input.Name
}

func Text(value any) string {
	switch typed := value.(type) {
	case nil:
		return "null"
	case string:
		return typed
	case []any:
		parts := make([]string, len(typed))
		for index, item := range typed {
			parts[index] = Text(item)
		}
		return strings.Join(parts, ",")
	case map[string]any:
		encoded, _ := json.Marshal(typed)
		return string(encoded)
	}
	return fmt.Sprint(value)
}

func Cases(targets openapi.Targets, seed int64, perOperation int) []Case {
	if perOperation <= 0 {
		perOperation = DefaultPerOperation
	}
	g := &generator{targets: targets, rng: rand.New(rand.NewSource(seed))}
	var all []Case
	for _, target := range targets.Operations {
		all = append(all, g.casesOf(target, perOperation)...)
	}
	return all
}

func (g *generator) casesOf(target openapi.Target, limit int) []Case {
	base := g.baseline(target)
	chosen := []Case{base}
	variants := g.variants(target, base)
	g.rng.Shuffle(len(variants), func(i, j int) { variants[i], variants[j] = variants[j], variants[i] })
	return append(chosen, variants[:min(len(variants), limit-1)]...)
}

func (g *generator) baseline(target openapi.Target) Case {
	c := Case{Target: target, Label: "schema-valid input", Kind: Valid, Params: map[string]any{}}
	for _, input := range target.Params {
		c.Params[ParamKey(input)] = g.valid(input.Schema, 0)
	}
	if target.Body != nil {
		c.Body, c.HasBody = g.valid(target.Body.Schema, 0), true
	}
	return c
}

func (g *generator) variants(target openapi.Target, base Case) []Case {
	var found []Case
	for _, input := range target.Params {
		key := ParamKey(input)
		if input.Required && input.In != "path" {
			found = append(found, derived(base, input.Name+": omitted", Invalid, func(c *Case) { delete(c.Params, key) }))
		}
		for _, change := range g.mutations(input.Schema, 0) {
			found = append(found, derived(base, input.Name+": "+change.label, change.kind, func(c *Case) { c.Params[key] = change.value }))
		}
	}
	if target.Body == nil {
		return found
	}
	if target.Body.Required {
		found = append(found, derived(base, "body: omitted", Invalid, func(c *Case) { c.Body, c.HasBody = nil, false }))
	}
	for _, change := range g.mutations(target.Body.Schema, 0) {
		found = append(found, derived(base, "body: "+change.label, change.kind, func(c *Case) { c.Body = change.value }))
	}
	return found
}

func derived(base Case, label, kind string, change func(*Case)) Case {
	c := base
	c.Label, c.Kind = label, kind
	c.Params = make(map[string]any, len(base.Params))
	for key, value := range base.Params {
		c.Params[key] = value
	}
	change(&c)
	return c
}
