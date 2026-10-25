package lint

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
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
	return []Issue{issueAt("/paths", locales.LintPathsNone, nil)}
}

func pathLeadingSlash(s *Spec) []Issue {
	var issues []Issue
	for _, path := range s.Paths {
		if !strings.HasPrefix(path, "/") {
			issues = append(issues, issueAt(pointer("paths", path), locales.LintPathsNoLeadingSlash, locales.Params{"path": path}))
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
		issues = append(issues, issueAt(pointer("paths", path), locales.LintPathsAmbiguous, locales.Params{"path": path, "earlier": earlier}))
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
			issues = append(issues, issueAt(op.Pointer, locales.LintPathsParameterUndeclared, locales.Params{"name": name}))
		}
	}
	for name, parameter := range declared {
		if !used[name] {
			issues = append(issues, issueAt(parameter.Pointer, locales.LintPathsParameterUnused, locales.Params{"name": name}))
		}
	}
	return issues
}
