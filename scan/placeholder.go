package scan

import (
	_ "embed"
	"encoding/json"
	"strings"
)

const (
	minRepeatLength  = 8
	maxRepeatSymbols = 3
)

//go:embed placeholder_words.json
var placeholderWordsJSON []byte

var placeholderWords = loadPlaceholderWords()

var wrappers = map[rune]rune{'<': '>', '[': ']', '(': ')'}

func loadPlaceholderWords() []string {
	var words []string
	if err := json.Unmarshal(placeholderWordsJSON, &words); err != nil {
		panic("scan: placeholder_words.json is invalid: " + err.Error())
	}
	return words
}

func isPlaceholder(value string) bool {
	trimmed := strings.TrimSpace(value)
	return trimmed == "" || isWrapped(trimmed) || isRepetition(trimmed) || hasPlaceholderWord(trimmed)
}

func isWrapped(value string) bool {
	runes := []rune(value)
	closing, found := wrappers[runes[0]]
	return found && runes[len(runes)-1] == closing
}

func isRepetition(value string) bool {
	runes := []rune(value)
	if len(runes) < minRepeatLength {
		return false
	}
	distinct := map[rune]bool{}
	for _, r := range runes {
		distinct[r] = true
	}
	return len(distinct) <= maxRepeatSymbols
}

func hasPlaceholderWord(value string) bool {
	lowered := strings.ToLower(value)
	for _, word := range placeholderWords {
		if strings.Contains(lowered, word) {
			return true
		}
	}
	return false
}
