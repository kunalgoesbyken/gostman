package engine

import (
	"encoding/base64"
	"net/url"
	"strings"
)

var encoders = map[string]func(string) string{
	"$base64":    func(text string) string { return base64.StdEncoding.EncodeToString([]byte(text)) },
	"$base64Url": func(text string) string { return base64.RawURLEncoding.EncodeToString([]byte(text)) },
	"$urlEncode": url.QueryEscape,
}

func UnencodedName(name string) string {
	invocation, isCall := parseCall(name)
	if !isCall {
		return name
	}
	if _, isEncoder := encoders[invocation.name]; !isEncoder {
		return name
	}
	return UnencodedName(strings.TrimSpace(invocation.argument))
}
