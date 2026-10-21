package lint

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

const maxRefHops = 32

var errExternalRef = errors.New("external reference")

type refTarget struct {
	value any
	err   error
}

type refUse struct {
	Pointer string
	Ref     string
}

func refOf(v any) (string, bool) {
	ref, ok := asMap(v)["$ref"].(string)
	return ref, ok && ref != ""
}

func lookupLocal(root map[string]any, ref string) (any, error) {
	fragment, local := strings.CutPrefix(ref, "#")
	if !local {
		return nil, errExternalRef
	}
	if fragment == "" || fragment == "/" {
		return root, nil
	}
	if !strings.HasPrefix(fragment, "/") {
		return nil, fmt.Errorf("%q is not a JSON pointer", ref)
	}
	var current any = root
	for _, raw := range strings.Split(fragment[1:], "/") {
		next, err := step(current, unescapeToken(raw))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", ref, err)
		}
		current = next
	}
	return current, nil
}

func step(current any, token string) (any, error) {
	switch typed := current.(type) {
	case map[string]any:
		next, ok := typed[token]
		if !ok {
			return nil, fmt.Errorf("%q does not exist", token)
		}
		return next, nil
	case []any:
		index, err := strconv.Atoi(token)
		if err != nil || index < 0 || index >= len(typed) {
			return nil, fmt.Errorf("%q is not an index in the list", token)
		}
		return typed[index], nil
	}
	return nil, fmt.Errorf("%q cannot be followed", token)
}

func followRef(root map[string]any, ref string) (any, error) {
	seen := map[string]bool{}
	for hop := 0; hop < maxRefHops; hop++ {
		if seen[ref] {
			return nil, fmt.Errorf("%s leads back to itself without reaching a definition", ref)
		}
		seen[ref] = true
		target, err := lookupLocal(root, ref)
		if err != nil {
			return nil, err
		}
		next, isRef := refOf(target)
		if !isRef {
			return target, nil
		}
		ref = next
	}
	return nil, fmt.Errorf("%s is part of a chain of more than %d $ref values", ref, maxRefHops)
}

func (s *Spec) follow(ref string) (any, error) {
	if cached, ok := s.targets[ref]; ok {
		return cached.value, cached.err
	}
	value, err := followRef(s.Root, ref)
	s.targets[ref] = refTarget{value: value, err: err}
	return value, err
}

func (s *Spec) resolve(v any) map[string]any {
	ref, isRef := refOf(v)
	if !isRef {
		return asMap(v)
	}
	target, err := s.follow(ref)
	if err != nil {
		return nil
	}
	return asMap(target)
}

func collectRefs(root map[string]any) []refUse {
	var uses []refUse
	collect(root, "", &uses)
	return uses
}

func collect(value any, at string, uses *[]refUse) {
	switch typed := value.(type) {
	case map[string]any:
		collectMap(typed, at, uses)
	case []any:
		for index, item := range typed {
			collect(item, at+"/"+strconv.Itoa(index), uses)
		}
	}
}

func collectMap(items map[string]any, at string, uses *[]refUse) {
	keys := make([]string, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if ref, isString := items[key].(string); isString && key == "$ref" {
			*uses = append(*uses, refUse{Pointer: at, Ref: ref})
			continue
		}
		collect(items[key], at+"/"+escapeToken(key), uses)
	}
}
