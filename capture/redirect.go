package capture

import (
	"net/http"
	"net/url"
	"strings"
)

const (
	headerLocation = "Location"
	pathDivider    = "/"
)

func (s *Server) pointsUpstream(target *url.URL) bool {
	return strings.EqualFold(target.Scheme, s.upstream.Scheme) && strings.EqualFold(target.Host, s.upstream.Host)
}

func (s *Server) pathBelowUpstream(target *url.URL) (string, bool) {
	base := strings.TrimSuffix(s.upstream.EscapedPath(), pathDivider)
	below, found := strings.CutPrefix(target.EscapedPath(), base)
	if !found || (below != "" && !strings.HasPrefix(below, pathDivider)) {
		return "", false
	}
	return below, true
}

func (s *Server) localize(header http.Header, localHost string) {
	target, err := url.Parse(header.Get(headerLocation))
	if err != nil || !s.pointsUpstream(target) {
		return
	}
	below, found := s.pathBelowUpstream(target)
	if !found {
		return
	}
	path, err := url.PathUnescape(below)
	if err != nil {
		return
	}
	local := url.URL{Scheme: "http", Host: localHost, Path: path, RawPath: below, RawQuery: target.RawQuery, Fragment: target.Fragment}
	header.Set(headerLocation, local.String())
}
