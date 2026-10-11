package redact

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strings"
)

const (
	minimumLength   = 6
	minimumDistinct = 4
	bitsPerByte     = 8
	bitsPerSymbol   = 6
	alignments      = 3
	hexDigits       = 2
)

var literals = map[string]bool{"true": true, "false": true, "null": true, "undefined": true}

func distinctBytes(value string) int {
	seen := map[byte]bool{}
	for index := 0; index < len(value); index++ {
		seen[value[index]] = true
	}
	return len(seen)
}

func IsMeaningful(value string) bool {
	trimmed := strings.TrimSpace(value)
	return len(trimmed) >= minimumLength && distinctBytes(trimmed) >= minimumDistinct && !literals[strings.ToLower(trimmed)]
}

func isHexDigit(symbol byte) bool {
	return (symbol >= '0' && symbol <= '9') || (symbol >= 'A' && symbol <= 'F') || (symbol >= 'a' && symbol <= 'f')
}

func isEscape(text string, index int) bool {
	return text[index] == '%' && index+hexDigits < len(text) && isHexDigit(text[index+1]) && isHexDigit(text[index+2])
}

func lowerEscapes(escaped string) string {
	lowered := []byte(escaped)
	for index := 0; index < len(escaped); index++ {
		if isEscape(escaped, index) {
			copy(lowered[index+1:], strings.ToLower(escaped[index+1:index+1+hexDigits]))
		}
	}
	return string(lowered)
}

func percentEncoded(value string) []string {
	query, path := url.QueryEscape(value), url.PathEscape(value)
	return []string{query, path, lowerEscapes(query), lowerEscapes(path)}
}

func jsonQuoted(value string, escapeHTML bool) string {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(escapeHTML)
	if err := encoder.Encode(value); err != nil {
		return value
	}
	quoted := strings.TrimSpace(buffer.String())
	return quoted[1 : len(quoted)-1]
}

func jsonEscaped(value string) []string {
	plain := jsonQuoted(value, false)
	return []string{plain, jsonQuoted(value, true), strings.ReplaceAll(plain, "/", `\/`)}
}

func embedded(encoding *base64.Encoding, value []byte, offset int) string {
	shifted := append(make([]byte, offset), value...)
	encoded := encoding.EncodeToString(shifted)
	start := (bitsPerByte*offset + bitsPerSymbol - 1) / bitsPerSymbol
	end := bitsPerByte * len(shifted) / bitsPerSymbol
	return encoded[start:end]
}

func base64Encoded(value string) []string {
	var forms []string
	for _, encoding := range []*base64.Encoding{base64.StdEncoding, base64.URLEncoding} {
		forms = append(forms, encoding.EncodeToString([]byte(value)))
		unpadded := encoding.WithPadding(base64.NoPadding)
		for offset := 0; offset < alignments; offset++ {
			forms = append(forms, embedded(unpadded, []byte(value), offset))
		}
	}
	return forms
}

func variants(value string) []string {
	candidates := []string{value}
	candidates = append(candidates, percentEncoded(value)...)
	candidates = append(candidates, jsonEscaped(value)...)
	candidates = append(candidates, base64Encoded(value)...)
	seen := map[string]bool{}
	var kept []string
	for _, candidate := range candidates {
		if len(candidate) < minimumLength || seen[candidate] {
			continue
		}
		seen[candidate] = true
		kept = append(kept, candidate)
	}
	return kept
}
