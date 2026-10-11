package workspace

import (
	"path"
	"strings"
	"unicode"
)

const (
	maxStemRunes        = 60
	wordSeparator       = "-"
	deviceNamePrefix    = "_"
	requestFallbackStem = "request"
	folderFallbackStem  = "folder"
	environmentFallback = "environment"
)

func isNameRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsMark(r) || r == '_'
}

func isWordBreak(r rune) bool {
	return !isNameRune(r)
}

func truncateStem(stem string) string {
	runes := []rune(stem)
	if len(runes) > maxStemRunes {
		runes = runes[:maxStemRunes]
	}
	return strings.TrimRight(string(runes), wordSeparator)
}

func isNumberedDevice(stem string) bool {
	if len(stem) != 4 {
		return false
	}
	prefix, digit := stem[:3], stem[3]
	return (prefix == "com" || prefix == "lpt") && digit >= '0' && digit <= '9'
}

func isDeviceName(stem string) bool {
	switch stem {
	case "con", "prn", "aux", "nul":
		return true
	}
	return isNumberedDevice(stem)
}

func fileStem(name, fallback string) string {
	words := strings.FieldsFunc(strings.ToLower(name), isWordBreak)
	stem := truncateStem(strings.Join(words, wordSeparator))
	if stem == "" {
		return fallback
	}
	if isDeviceName(stem) {
		return deviceNamePrefix + stem
	}
	return stem
}

func stemOf(relative string) string {
	name := path.Base(relative)
	return strings.TrimSuffix(name, path.Ext(name))
}

func sameStem(first, second, fallback string) bool {
	return fileStem(first, fallback) == fileStem(second, fallback)
}
