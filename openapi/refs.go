package openapi

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"reflect"
	"sort"
	"strconv"
	"strings"
)

type docCtx struct {
	root map[string]any
	base string
}

type node struct {
	v any
	d *docCtx
}

type loader struct {
	ctx      context.Context
	opt      Options
	main     *docCtx
	docs     map[string]*docCtx
	fetched  int
	warnings map[string]struct{}
	order    []string
}

func newLoader(ctx context.Context, opt Options, root map[string]any, base string) *loader {
	main := &docCtx{root: root, base: base}
	return &loader{ctx: ctx, opt: opt, main: main, docs: map[string]*docCtx{}, warnings: map[string]struct{}{}}
}

func (l *loader) warn(message string) {
	if _, seen := l.warnings[message]; seen {
		return
	}
	l.warnings[message] = struct{}{}
	l.order = append(l.order, message)
}

func (l *loader) warningList() []string {
	if len(l.order) <= maxWarningsShown {
		return l.order
	}
	shown := append([]string{}, l.order[:maxWarningsShown]...)
	return append(shown, fmt.Sprintf("%d more warnings were left out.", len(l.order)-maxWarningsShown))
}

func (l *loader) root(v any) node { return node{v: v, d: l.main} }

func refOf(v any) (string, bool) {
	m, ok := v.(map[string]any)
	if !ok {
		return "", false
	}
	ref, ok := m["$ref"].(string)
	return ref, ok && ref != ""
}

func (l *loader) deref(n node) (node, string) {
	name := ""
	for hop := 0; hop < maxRefHops; hop++ {
		ref, ok := refOf(n.v)
		if !ok {
			return n, name
		}
		next, refName, err := l.follow(n.d, ref)
		if err != nil {
			l.warn(fmt.Sprintf("Could not resolve %s: %v", ref, err))
			return node{d: n.d}, name
		}
		n, name = next, refName
	}
	l.warn("A chain of $ref values is longer than the supported limit.")
	return node{d: n.d}, name
}

func (l *loader) follow(from *docCtx, ref string) (node, string, error) {
	location, pointer, _ := strings.Cut(ref, "#")
	target := from
	if location != "" {
		loaded, err := l.document(from, location)
		if err != nil {
			return node{}, "", err
		}
		target = loaded
	}
	value, err := walkPointer(target.root, pointer)
	if err != nil {
		return node{}, "", err
	}
	name := pointerName(pointer)
	if name == "" && location != "" {
		name = strings.TrimSuffix(filepath.Base(location), filepath.Ext(location))
	}
	return node{v: value, d: target}, name, nil
}

func pointerName(pointer string) string {
	tokens := strings.Split(strings.TrimPrefix(pointer, "/"), "/")
	return unescapeToken(tokens[len(tokens)-1])
}

func unescapeToken(token string) string {
	if decoded, err := url.PathUnescape(token); err == nil {
		token = decoded
	}
	return strings.ReplaceAll(strings.ReplaceAll(token, "~1", "/"), "~0", "~")
}

func walkPointer(root any, pointer string) (any, error) {
	if pointer == "" || pointer == "/" {
		return root, nil
	}
	if !strings.HasPrefix(pointer, "/") {
		return nil, errors.New("only JSON pointers are supported")
	}
	current := root
	for _, raw := range strings.Split(pointer[1:], "/") {
		token := unescapeToken(raw)
		switch typed := current.(type) {
		case map[string]any:
			next, ok := typed[token]
			if !ok {
				return nil, fmt.Errorf("%q does not exist", token)
			}
			current = next
		case []any:
			index, err := strconv.Atoi(token)
			if err != nil || index < 0 || index >= len(typed) {
				return nil, fmt.Errorf("%q is not an index in the list", token)
			}
			current = typed[index]
		default:
			return nil, fmt.Errorf("%q cannot be followed", token)
		}
	}
	return current, nil
}

func (l *loader) document(from *docCtx, location string) (*docCtx, error) {
	target, isRemote, err := l.locate(from, location)
	if err != nil {
		return nil, err
	}
	if cached, ok := l.docs[target]; ok {
		return cached, nil
	}
	if l.fetched >= l.opt.refLimit() {
		return nil, fmt.Errorf("more than %d external documents are referenced", l.opt.refLimit())
	}
	l.fetched++
	var data []byte
	if isRemote {
		data, err = l.opt.fetch(l.ctx, target)
	} else {
		data, err = l.opt.readFile(target)
	}
	if err != nil {
		return nil, err
	}
	root, err := decode(data)
	if err != nil {
		return nil, err
	}
	loaded := &docCtx{root: root, base: target}
	l.docs[target] = loaded
	return loaded, nil
}

func (l *loader) locate(from *docCtx, location string) (string, bool, error) {
	if parsed, err := url.Parse(location); err == nil && parsed.Scheme != "" && len(parsed.Scheme) > 1 {
		if err := checkScheme(parsed); err != nil {
			return "", false, err
		}
		return parsed.String(), true, nil
	}
	if from.base == "" {
		return "", false, errors.New("a relative reference needs a spec that was loaded from an address or a file")
	}
	if baseURL, err := url.Parse(from.base); err == nil && baseURL.Scheme != "" && len(baseURL.Scheme) > 1 {
		resolved, err := baseURL.Parse(location)
		if err != nil {
			return "", false, err
		}
		if err := checkScheme(resolved); err != nil {
			return "", false, err
		}
		return resolved.String(), true, nil
	}
	if !l.opt.AllowFiles {
		return "", false, errors.New("local files cannot be read here")
	}
	return filepath.Join(filepath.Dir(from.base), filepath.FromSlash(location)), false, nil
}

func identity(v any) uintptr {
	value := reflect.ValueOf(v)
	if value.Kind() == reflect.Map || value.Kind() == reflect.Slice {
		return value.Pointer()
	}
	return 0
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func asList(v any) []any {
	list, _ := v.([]any)
	return list
}

func asString(v any) string {
	s, _ := v.(string)
	return s
}

func asBool(v any) bool {
	b, _ := v.(bool)
	return b
}

func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func (l *loader) child(n node, key string) node {
	m := asMap(n.v)
	if m == nil {
		return node{d: n.d}
	}
	return node{v: m[key], d: n.d}
}

func (l *loader) resolved(n node) (map[string]any, *docCtx, string) {
	r, name := l.deref(n)
	return asMap(r.v), r.d, name
}
