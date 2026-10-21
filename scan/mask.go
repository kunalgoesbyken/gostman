package scan

import (
	"crypto/sha256"
	"encoding/hex"
)

const (
	maskSuffix       = "****"
	revealedRunes    = 4
	minRevealRunes   = 16
	fingerprintBytes = 4
)

func mask(value string) string {
	runes := []rune(value)
	if len(runes) < minRevealRunes {
		return maskSuffix
	}
	return string(runes[:revealedRunes]) + maskSuffix
}

func fingerprint(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:fingerprintBytes])
}
