package lint

import (
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

type Issue struct {
	Path      string
	Operation string
	Message   string
	Localized *locales.Message
}

func issueAt(path string, code locales.Code, params locales.Params) Issue {
	message := locales.New(code, params)
	return Issue{Path: path, Message: message.English(), Localized: &message}
}

func issueFrom(path string, code locales.Code, params locales.Params, err error) Issue {
	message := locales.New(code, params).WithDetail(err.Error())
	return Issue{Path: path, Message: message.English(), Localized: &message}
}

type Rule struct {
	ID          string
	Severity    Severity
	Description string
	Check       func(*Spec) []Issue
}

func Rules() []Rule {
	groups := [][]Rule{infoRules(), pathRules(), operationRules(), responseRules(), securityRules(), componentRules()}
	var all []Rule
	for _, group := range groups {
		all = append(all, group...)
	}
	return all
}

func eachOperation(check func(*Spec, Operation) []Issue) func(*Spec) []Issue {
	return func(s *Spec) []Issue {
		var issues []Issue
		for _, op := range s.Operations {
			if s.ctx.Err() != nil {
				return issues
			}
			issues = append(issues, check(s, op)...)
		}
		return issues
	}
}

func sortedKeys(m map[string]any) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func operationAt(path string) string {
	tokens := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(tokens) < 3 || tokens[0] != "paths" || !isMethod(tokens[2]) {
		return ""
	}
	return strings.ToUpper(tokens[2]) + " " + unescapeToken(tokens[1])
}

func isMethod(name string) bool {
	for _, method := range methods {
		if method == name {
			return true
		}
	}
	return false
}
