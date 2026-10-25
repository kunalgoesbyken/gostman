package lint

import (
	"strconv"

	"github.com/kunalgoesbyken/gostman/locales"
)

func securityRules() []Rule {
	return []Rule{
		{ID: "security-scheme-defined", Severity: SeverityError, Description: "security requirements name defined schemes", Check: securitySchemeDefined},
		{ID: "operation-security", Severity: SeverityInfo, Description: "operations are covered by a security requirement when schemes exist", Check: eachOperation(operationSecurity)},
	}
}

func securitySchemeDefined(s *Spec) []Issue {
	schemes := s.SecuritySchemes()
	issues := undefinedSchemes(schemes, asList(s.Root["security"]), "/security")
	for _, op := range s.Operations {
		issues = append(issues, undefinedSchemes(schemes, asList(op.Data["security"]), op.Pointer+"/security")...)
	}
	return issues
}

func undefinedSchemes(schemes map[string]any, requirements []any, at string) []Issue {
	var issues []Issue
	for index, requirement := range requirements {
		for _, name := range sortedKeys(asMap(requirement)) {
			if _, defined := schemes[name]; !defined {
				issues = append(issues, issueAt(at+"/"+strconv.Itoa(index)+pointer(name), locales.LintSecurityUndefinedScheme, locales.Params{"name": name}))
			}
		}
	}
	return issues
}

func operationSecurity(s *Spec, op Operation) []Issue {
	if len(s.SecuritySchemes()) == 0 || len(asList(s.Root["security"])) > 0 {
		return nil
	}
	if _, stated := op.Data["security"]; stated {
		return nil
	}
	return []Issue{issueAt(op.Pointer, locales.LintOperationsNoSecurity, nil)}
}
