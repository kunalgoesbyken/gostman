package redact

import (
	_ "embed"
	"encoding/json"
	"strings"
)

const Masked = "***"

//go:embed sensitive_words.json
var sensitiveWordsJSON []byte

var sensitiveWords = loadSensitiveWords()

func loadSensitiveWords() []string {
	var words []string
	if err := json.Unmarshal(sensitiveWordsJSON, &words); err != nil {
		panic("redact: sensitive_words.json is invalid: " + err.Error())
	}
	return words
}

func IsSensitiveName(name string) bool {
	lowered := strings.ToLower(name)
	for _, word := range sensitiveWords {
		if strings.Contains(lowered, word) {
			return true
		}
	}
	return false
}
