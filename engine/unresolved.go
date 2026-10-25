package engine

import (
	"errors"
	"slices"
	"strings"
)

type unresolvedError struct {
	err   error
	names []string
}

func (e *unresolvedError) Error() string {
	return e.err.Error()
}

func (e *unresolvedError) Unwrap() error {
	return e.err
}

func withUnresolved(err error, names []string) error {
	if len(names) == 0 {
		return err
	}
	return &unresolvedError{err, names}
}

func UnresolvedIn(err error) []string {
	var unresolved *unresolvedError
	if errors.As(err, &unresolved) {
		return unresolved.names
	}
	return nil
}

func JoinUnresolved(lists ...[]string) []string {
	var joined []string
	for _, list := range lists {
		for _, name := range list {
			if !slices.Contains(joined, name) {
				joined = append(joined, name)
			}
		}
	}
	return joined
}

func NotDefined(names []string) string {
	placeholders := make([]string, len(names))
	for i, name := range names {
		placeholders[i] = "{{" + name + "}}"
	}
	switch last := len(placeholders) - 1; {
	case last < 0:
		return ""
	case last == 0:
		return placeholders[0] + " is not defined"
	default:
		return strings.Join(placeholders[:last], ", ") + " and " + placeholders[last] + " are not defined"
	}
}
