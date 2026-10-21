package secrets

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
)

type Connection struct {
	Alias  string            `json:"alias"`
	Kind   string            `json:"kind"`
	Values map[string]string `json:"values"`
}

func (c Connection) value(name string) string {
	return strings.TrimSpace(c.Values[name])
}

func (c Connection) fingerprint() string {
	names := make([]string, 0, len(c.Values))
	for name := range c.Values {
		names = append(names, name)
	}
	sort.Strings(names)
	digest := sha256.New()
	for _, part := range []string{c.Alias, c.Kind} {
		digest.Write([]byte(part + "\x00"))
	}
	for _, name := range names {
		digest.Write([]byte(name + "\x00" + c.Values[name] + "\x00"))
	}
	return hex.EncodeToString(digest.Sum(nil))
}
