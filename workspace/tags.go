package workspace

import (
	"strings"

	"golang.org/x/text/cases"
)

func foldTag(tag string) string {
	return cases.Fold().String(tag)
}

func NormalizeTags(tags []string) []string {
	seen := map[string]bool{}
	var kept []string
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		key := foldTag(tag)
		if tag == "" || seen[key] {
			continue
		}
		seen[key] = true
		kept = append(kept, tag)
	}
	return kept
}

func SharesTag(tags, wanted []string) bool {
	held := map[string]bool{}
	for _, tag := range tags {
		held[foldTag(tag)] = true
	}
	for _, tag := range wanted {
		if held[foldTag(tag)] {
			return true
		}
	}
	return false
}
