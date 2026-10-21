package lint

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
)

var methods = []string{"get", "put", "post", "delete", "options", "head", "patch", "trace"}

type Operation struct {
	Key     string
	Method  string
	Path    string
	Pointer string
	Data    map[string]any
	Item    map[string]any
}

type Spec struct {
	Root       map[string]any
	V2         bool
	Paths      []string
	Operations []Operation
	Refs       []refUse
	Tags       map[string]bool

	ctx     context.Context
	targets map[string]refTarget
}

type Parameter struct {
	Name    string
	In      string
	Pointer string
}

func newSpec(ctx context.Context, root map[string]any) (*Spec, error) {
	spec := &Spec{Root: root, ctx: ctx, targets: map[string]refTarget{}}
	if err := spec.detectVersion(); err != nil {
		return nil, err
	}
	if err := checkLimits(root); err != nil {
		return nil, err
	}
	spec.Refs = collectRefs(root)
	spec.Tags = declaredTags(root)
	spec.readOperations()
	return spec, nil
}

func (s *Spec) detectVersion() error {
	if swagger := asString(s.Root["swagger"]); swagger != "" {
		if !strings.HasPrefix(swagger, "2") {
			return fmt.Errorf("Swagger %s is not supported", swagger)
		}
		s.V2 = true
		return nil
	}
	version := asString(s.Root["openapi"])
	if version == "" {
		return errors.New("this is not an OpenAPI document: it has no \"openapi\" or \"swagger\" field")
	}
	if !strings.HasPrefix(version, "3.") {
		return fmt.Errorf("OpenAPI %s is not supported", version)
	}
	return nil
}

func (s *Spec) readOperations() {
	paths := asMap(s.Root["paths"])
	for path := range paths {
		if !strings.HasPrefix(path, "x-") {
			s.Paths = append(s.Paths, path)
		}
	}
	sort.Strings(s.Paths)
	for _, path := range s.Paths {
		item := s.resolve(paths[path])
		for _, method := range methods {
			if data := s.resolve(item[method]); data != nil {
				s.Operations = append(s.Operations, newOperation(path, method, data, item))
			}
		}
	}
}

func newOperation(path, method string, data, item map[string]any) Operation {
	upper := strings.ToUpper(method)
	return Operation{
		Key:     upper + " " + path,
		Method:  upper,
		Path:    path,
		Pointer: pointer("paths", path, method),
		Data:    data,
		Item:    item,
	}
}

func (s *Spec) Parameters(op Operation) []Parameter {
	itemPointer := pointer("paths", op.Path)
	found := s.parametersOf(op.Item, itemPointer)
	return append(found, s.parametersOf(op.Data, op.Pointer)...)
}

func (s *Spec) parametersOf(holder map[string]any, at string) []Parameter {
	var found []Parameter
	for index, raw := range asList(holder["parameters"]) {
		data := s.resolve(raw)
		if data == nil {
			continue
		}
		found = append(found, Parameter{
			Name:    asString(data["name"]),
			In:      asString(data["in"]),
			Pointer: fmt.Sprintf("%s/parameters/%d", at, index),
		})
	}
	return found
}

func (s *Spec) SecuritySchemes() map[string]any {
	if s.V2 {
		return asMap(s.Root["securityDefinitions"])
	}
	return asMap(asMap(s.Root["components"])["securitySchemes"])
}
