package deeplink

import (
	"errors"
	"net"
	"net/netip"
	"net/url"
	"strings"
	"unicode"

	"golang.org/x/net/idna"
)

const (
	MaxURLLength = 2048

	secureScheme = "https"
)

var (
	errAddress     = errors.New("this is not a web address Gostman can open")
	errTooLong     = errors.New("this address is too long")
	errCredentials = errors.New("addresses that contain a user name or password are not allowed")
	errHost        = errors.New("the address has no valid host name")
	errScheme      = errors.New("only https addresses are allowed")
)

type Source struct {
	URL  string `json:"url"`
	Host string `json:"host"`
}

func checkText(raw string) error {
	if len(raw) > MaxURLLength {
		return errTooLong
	}
	for _, r := range raw {
		if unicode.IsControl(r) || unicode.IsSpace(r) {
			return errAddress
		}
	}
	return nil
}

func hasCredentials(parsed *url.URL) bool {
	return parsed.User != nil || strings.Contains(parsed.Host, "@")
}

func asciiHost(name string) (string, error) {
	if name == "" {
		return "", errHost
	}
	if address, err := netip.ParseAddr(name); err == nil {
		return canonicalAddress(address)
	}
	ascii, err := idna.Lookup.ToASCII(name)
	if err != nil || ascii == "" {
		return "", errHost
	}
	return ascii, nil
}

func canonicalAddress(address netip.Addr) (string, error) {
	if address.Zone() != "" {
		return "", errHost
	}
	if address.Is6() {
		return "[" + address.String() + "]", nil
	}
	return address.String(), nil
}

func joinPort(host, port string) string {
	if port == "" {
		return host
	}
	return net.JoinHostPort(strings.Trim(host, "[]"), port)
}

func ParseSource(raw string) (Source, error) {
	if err := checkText(raw); err != nil {
		return Source{}, err
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return Source{}, errAddress
	}
	if hasCredentials(parsed) {
		return Source{}, errCredentials
	}
	host, err := asciiHost(parsed.Hostname())
	if err != nil {
		return Source{}, err
	}
	if parsed.Scheme != secureScheme {
		return Source{}, errScheme
	}
	parsed.Host = joinPort(host, parsed.Port())
	parsed.Fragment, parsed.RawFragment = "", ""
	return Source{URL: parsed.String(), Host: parsed.Host}, nil
}
