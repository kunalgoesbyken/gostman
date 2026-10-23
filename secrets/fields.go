package secrets

import (
	"fmt"
	"sort"
	"strings"
)

func pickField(fields map[string]string, field, fallback, hint string) (string, error) {
	if field == "" {
		field = fallback
	}
	value, found := fields[field]
	if !found {
		return "", fmt.Errorf("there is no field %q; the fields are %s%s", field, strings.Join(sortedNames(fields), ", "), hint)
	}
	if value == "" {
		return "", fmt.Errorf("the field %q is empty", field)
	}
	return value, nil
}

func readsOneTimeCode(ref Ref) bool {
	return ref.Field == entryTOTP
}

func sortedNames(fields map[string]string) []string {
	names := make([]string, 0, len(fields))
	for name := range fields {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
