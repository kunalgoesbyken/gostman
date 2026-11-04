package main

import (
	"crypto/ed25519"
	_ "embed"
	"encoding/base64"
	"errors"
	"strings"
)

const badSignature = "SHA256SUMS is not signed with the Gostman release key"

//go:embed release-key.pub
var releaseKeyText string

func parseKey(text string) ed25519.PublicKey {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(text))
	if err != nil || len(decoded) != ed25519.PublicKeySize {
		return nil
	}
	return decoded
}

func releaseKey() ed25519.PublicKey {
	return parseKey(releaseKeyText)
}

func verifySigned(key ed25519.PublicKey, message, signature []byte) error {
	if len(key) != ed25519.PublicKeySize || !ed25519.Verify(key, message, signature) {
		return errors.New(badSignature)
	}
	return nil
}
