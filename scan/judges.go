package scan

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/redact"
)

func named(name string) judge {
	if redact.IsSensitiveName(name) {
		return randomValues
	}
	return nil
}

func randomValues(value string) []match {
	if hasReference(value) {
		return nil
	}
	var found []match
	for _, piece := range pieces(value) {
		if !isPlaceholder(piece) && looksRandom(piece) {
			found = append(found, match{entropyRule, piece})
		}
	}
	return found
}

func literal(kind rule) judge {
	return func(value string) []match {
		trimmed := strings.TrimSpace(value)
		if hasReference(trimmed) || isPlaceholder(trimmed) {
			return nil
		}
		return []match{{kind, trimmed}}
	}
}
