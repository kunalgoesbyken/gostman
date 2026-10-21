package redact

import "strings"

var sensitiveWords = []string{"auth", "bearer", "cookie", "credential", "key", "passw", "pwd", "secret", "session", "signature", "token"}

func IsSensitiveName(name string) bool {
	lowered := strings.ToLower(name)
	for _, word := range sensitiveWords {
		if strings.Contains(lowered, word) {
			return true
		}
	}
	return false
}
