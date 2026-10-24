package loopback

import (
	"errors"
	"net/url"
	"strings"
)

type Origin struct {
	Canonical string
	IsLocal   bool
}

func ParseOrigin(raw string) (Origin, error) {
	parsed, err := url.Parse(raw)
	if err != nil {
		return Origin{}, err
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return Origin{}, errors.New("use http or https")
	}
	if parsed.Hostname() == "" || parsed.User != nil || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Opaque != "" {
		return Origin{}, errors.New("give only a scheme, host and optional port")
	}
	return Origin{Canonical: parsed.Scheme + "://" + strings.ToLower(parsed.Host), IsLocal: IsName(parsed.Hostname())}, nil
}
