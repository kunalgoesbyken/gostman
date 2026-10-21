package lint

import (
	"errors"
	"fmt"
	"strings"
)

var componentKinds = []string{"schemas", "parameters", "responses", "requestBodies", "headers", "examples", "links", "callbacks"}

var swaggerKinds = []string{"definitions", "parameters", "responses"}

type componentKey struct {
	kind string
	name string
}

func componentRules() []Rule {
	return []Rule{
		{ID: "component-unused", Severity: SeverityInfo, Description: "every reusable component is referenced", Check: componentUnused},
		{ID: "ref-valid", Severity: SeverityError, Description: "every $ref points to something that exists", Check: refValid},
	}
}

func (s *Spec) componentPool(kind string) map[string]any {
	if s.V2 {
		return asMap(s.Root[kind])
	}
	return asMap(asMap(s.Root["components"])[kind])
}

func (s *Spec) componentPointer(key componentKey) string {
	if s.V2 {
		return pointer(key.kind, key.name)
	}
	return pointer("components", key.kind, key.name)
}

func (s *Spec) kinds() []string {
	if s.V2 {
		return swaggerKinds
	}
	return componentKinds
}

func (s *Spec) keyOf(ref string) (componentKey, bool) {
	fragment, local := strings.CutPrefix(ref, "#/")
	if !local {
		return componentKey{}, false
	}
	tokens := strings.Split(fragment, "/")
	if !s.V2 {
		if tokens[0] != "components" {
			return componentKey{}, false
		}
		tokens = tokens[1:]
	}
	if len(tokens) < 2 {
		return componentKey{}, false
	}
	return componentKey{kind: unescapeToken(tokens[0]), name: unescapeToken(tokens[1])}, true
}

func (s *Spec) usedComponents() map[componentKey]bool {
	used := map[componentKey]bool{}
	for _, use := range s.Refs {
		key, ok := s.keyOf(use.Ref)
		if !ok {
			continue
		}
		own := s.componentPointer(key)
		if use.Pointer != own && !strings.HasPrefix(use.Pointer, own+"/") {
			used[key] = true
		}
	}
	return used
}

func componentUnused(s *Spec) []Issue {
	used := s.usedComponents()
	var issues []Issue
	for _, kind := range s.kinds() {
		pool := s.componentPool(kind)
		for _, name := range sortedKeys(pool) {
			key := componentKey{kind: kind, name: name}
			if !used[key] {
				issues = append(issues, Issue{Path: s.componentPointer(key), Message: fmt.Sprintf("%s/%s is defined but never referenced", kind, name)})
			}
		}
	}
	return issues
}

func refValid(s *Spec) []Issue {
	var issues []Issue
	for _, use := range s.Refs {
		_, err := s.follow(use.Ref)
		if err == nil || errors.Is(err, errExternalRef) {
			continue
		}
		issues = append(issues, Issue{Path: use.Pointer + "/$ref", Message: "invalid $ref: " + err.Error()})
	}
	return issues
}
