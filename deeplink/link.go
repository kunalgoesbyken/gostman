package deeplink

import (
	"errors"
	"net/url"
	"strings"
)

const (
	Scheme   = "gostman"
	openHost = "open"
	queryKey = "url"
)

var errNotLink = errors.New("this is not a Gostman link")

func FindLink(args []string) (string, bool) {
	prefix := Scheme + ":"
	for _, arg := range args {
		if len(arg) >= len(prefix) && strings.EqualFold(arg[:len(prefix)], prefix) {
			return arg, true
		}
	}
	return "", false
}

func isOpenLink(parsed *url.URL) bool {
	return strings.EqualFold(parsed.Scheme, Scheme) &&
		strings.EqualFold(parsed.Host, openHost) &&
		(parsed.Path == "" || parsed.Path == "/") &&
		parsed.User == nil
}

func ParseLink(raw string) (Source, error) {
	if err := checkText(raw); err != nil {
		return Source{}, err
	}
	parsed, err := url.Parse(raw)
	if err != nil || !isOpenLink(parsed) {
		return Source{}, errNotLink
	}
	values, err := url.ParseQuery(parsed.RawQuery)
	if err != nil || len(values[queryKey]) != 1 {
		return Source{}, errNotLink
	}
	return ParseSource(values[queryKey][0])
}
