package lint

import (
	"fmt"
	"strings"
)

func pathRules() []Rule {
	return []Rule{
		{ID: "paths-defined", Severity: SeverityWarning, Description: "the document defines paths", Check: pathsDefined},
		{ID: "path-leading-slash", Severity: SeverityError, Description: "every path starts with a slash", Check: pathLeadingSlash},
		{ID: "path-template-ambiguous", Severity: SeverityError, Description: "no two paths differ only in parameter names", Check: pathTemplateAmbiguous},
		{ID: "path-params-declared", Severity: SeverityError, Description: "path parameters are declared exactly as the template uses them", Check: eachOperation(pathParamsDeclared)},
	}
}

func pathsDefined(s *Spec) []Issue {
	if len(asMap(s.Root["paths"])) > 0 {
		return nil
	}
	return []Issue{{Path: "/paths", Message: "the document defines no paths"}}
}

func pathLeadingSlash(s *Spec) []Issue {
	var issues []Issue
	for _, path := range s.Paths {
		if !strings.HasPrefix(path, "/") {
			issues = append(issues, Issue{Path: pointer("paths", path), Message: fmt.Sprintf("path %q does not start with a slash", path)})
		}
	}
	return issues
}

func templateVariables(path string) []string {
	var names []string
	rest := path
	for {
		_, afterOpen, opened := strings.Cut(rest, "{")
		if !opened {
			return names
		}
		name, afterClose, closed := strings.Cut(afterOpen, "}")
		if !closed {
			return names
		}
		names = append(names, name)
		rest = afterClose
	}
}

func shapeOf(path string) string {
	shape := path
	for _, name := range templateVariables(path) {
		shape = strings.Replace(shape, "{"+name+"}", "{}", 1)
	}
	return shape
}

func pathTemplateAmbiguous(s *Spec) []Issue {
	first := map[string]string{}
	var issues []Issue
	for _, path := range s.Paths {
		shape := shapeOf(path)
		earlier, seen := first[shape]
		if !seen {
			first[shape] = path
			continue
		}
		issues = append(issues, Issue{Path: pointer("paths", path), Message: fmt.Sprintf("%s cannot be told apart from %s", path, earlier)})
	}
	return issues
}

func pathParamsDeclared(s *Spec, op Operation) []Issue {
	declared := map[string]Parameter{}
	for _, parameter := range s.Parameters(op) {
		if parameter.In == "path" {
			declared[parameter.Name] = parameter
		}
	}
	used := map[string]bool{}
	var issues []Issue
	for _, name := range templateVariables(op.Path) {
		used[name] = true
		if _, ok := declared[name]; !ok {
			issues = append(issues, Issue{Path: op.Pointer, Message: fmt.Sprintf("path parameter %q is in the path but not declared", name)})
		}
	}
	for name, parameter := range declared {
		if !used[name] {
			issues = append(issues, Issue{Path: parameter.Pointer, Message: fmt.Sprintf("path parameter %q is declared but not in the path", name)})
		}
	}
	return issues
}
