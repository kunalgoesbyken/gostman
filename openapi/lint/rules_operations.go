package lint

import (
	"fmt"

	"github.com/kunalgoesbyken/gostman/locales"
)

func operationRules() []Rule {
	return []Rule{
		{ID: "operation-id-defined", Severity: SeverityWarning, Description: "every operation has an operationId", Check: eachOperation(operationIDDefined)},
		{ID: "operation-id-unique", Severity: SeverityError, Description: "operationId values are unique", Check: operationIDUnique},
		{ID: "operation-summary", Severity: SeverityWarning, Description: "every operation has a summary or description", Check: eachOperation(operationSummary)},
		{ID: "operation-tags-declared", Severity: SeverityWarning, Description: "tags used by operations are declared", Check: eachOperation(operationTagsDeclared)},
		{ID: "deprecated-description", Severity: SeverityWarning, Description: "deprecated operations explain why", Check: eachOperation(deprecatedDescription)},
	}
}

func operationIDDefined(_ *Spec, op Operation) []Issue {
	if !blank(op.Data["operationId"]) {
		return nil
	}
	return []Issue{issueAt(op.Pointer, locales.LintOperationsNoOperationId, nil)}
}

func operationIDUnique(s *Spec) []Issue {
	first := map[string]string{}
	var issues []Issue
	for _, op := range s.Operations {
		id := asString(op.Data["operationId"])
		if id == "" {
			continue
		}
		earlier, seen := first[id]
		if !seen {
			first[id] = op.Key
			continue
		}
		issues = append(issues, issueAt(op.Pointer+"/operationId", locales.LintOperationsDuplicateOperationId, locales.Params{"id": id, "earlier": earlier}))
	}
	return issues
}

func operationSummary(_ *Spec, op Operation) []Issue {
	if !blank(op.Data["summary"]) || !blank(op.Data["description"]) {
		return nil
	}
	return []Issue{issueAt(op.Pointer, locales.LintOperationsNoSummary, nil)}
}

func declaredTags(root map[string]any) map[string]bool {
	declared := map[string]bool{}
	for _, raw := range asList(root["tags"]) {
		declared[asString(asMap(raw)["name"])] = true
	}
	return declared
}

func operationTagsDeclared(s *Spec, op Operation) []Issue {
	var issues []Issue
	for index, raw := range asList(op.Data["tags"]) {
		if tag := asString(raw); !s.Tags[tag] {
			issues = append(issues, issueAt(fmt.Sprintf("%s/tags/%d", op.Pointer, index), locales.LintOperationsUndeclaredTag, locales.Params{"tag": tag}))
		}
	}
	return issues
}

func deprecatedDescription(_ *Spec, op Operation) []Issue {
	if !asBool(op.Data["deprecated"]) || !blank(op.Data["description"]) {
		return nil
	}
	return []Issue{issueAt(op.Pointer+"/deprecated", locales.LintOperationsDeprecatedWithoutDescription, nil)}
}
