package scan

import (
	"math"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	minRandomLength = 16
	maxRandomLength = 512
	minEntropy      = 3.5
	uuidLength      = 36
	assignment      = "="
	urlMarker       = "://"
)

var uuidDashes = map[int]bool{8: true, 13: true, 18: true, 23: true}

func entropy(value string) float64 {
	counts := map[rune]int{}
	total := 0
	for _, r := range value {
		counts[r]++
		total++
	}
	bits := 0.0
	for _, count := range counts {
		share := float64(count) / float64(total)
		bits -= share * math.Log2(share)
	}
	return bits
}

func isUUID(value string) bool {
	if len(value) != uuidLength {
		return false
	}
	for index, r := range value {
		if uuidDashes[index] != (r == '-') || (r != '-' && !isHexDigit(r)) {
			return false
		}
	}
	return true
}

func isHexDigit(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

func hasLetterAndDigit(value string) bool {
	return strings.IndexFunc(value, unicode.IsLetter) >= 0 && strings.IndexFunc(value, unicode.IsDigit) >= 0
}

func looksRandom(value string) bool {
	length := utf8.RuneCountInString(value)
	if length < minRandomLength || length > maxRandomLength {
		return false
	}
	if strings.Contains(value, urlMarker) || isUUID(value) || !hasLetterAndDigit(value) {
		return false
	}
	return entropy(value) >= minEntropy
}

func pieces(value string) []string {
	separated := strings.FieldsFunc(value, func(r rune) bool { return unicode.IsSpace(r) || r == ';' || r == ',' })
	for index, piece := range separated {
		separated[index] = assignedValue(piece)
	}
	return separated
}

func assignedValue(piece string) string {
	_, rest, found := strings.Cut(piece, assignment)
	if !found || strings.Trim(rest, assignment) == "" {
		return piece
	}
	return rest
}
