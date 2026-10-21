package lint

import "fmt"

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
	return []Issue{{Path: op.Pointer, Message: "the operation has no operationId"}}
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
		issues = append(issues, Issue{Path: op.Pointer + "/operationId", Message: fmt.Sprintf("operationId %q is already used by %s", id, earlier)})
	}
	return issues
}

func operationSummary(_ *Spec, op Operation) []Issue {
	if !blank(op.Data["summary"]) || !blank(op.Data["description"]) {
		return nil
	}
	return []Issue{{Path: op.Pointer, Message: "the operation has neither a summary nor a description"}}
}

func declaredTags(s *Spec) map[string]bool {
	declared := map[string]bool{}
	for _, raw := range asList(s.Root["tags"]) {
		declared[asString(asMap(raw)["name"])] = true
	}
	return declared
}

func operationTagsDeclared(s *Spec, op Operation) []Issue {
	declared := declaredTags(s)
	var issues []Issue
	for index, raw := range asList(op.Data["tags"]) {
		if tag := asString(raw); !declared[tag] {
			issues = append(issues, Issue{Path: fmt.Sprintf("%s/tags/%d", op.Pointer, index), Message: fmt.Sprintf("tag %q is not declared in the top-level tags", tag)})
		}
	}
	return issues
}

func deprecatedDescription(_ *Spec, op Operation) []Issue {
	if !asBool(op.Data["deprecated"]) || !blank(op.Data["description"]) {
		return nil
	}
	return []Issue{{Path: op.Pointer + "/deprecated", Message: "the operation is deprecated but has no description saying what to use instead"}}
}
