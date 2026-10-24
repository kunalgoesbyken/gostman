package mock

import (
	"fmt"
	"net/http"

	"github.com/kunalgoesbyken/gostman/loopback"
)

const (
	headerOrigin           = "Origin"
	headerRequestMethod    = "Access-Control-Request-Method"
	headerRequestHeaders   = "Access-Control-Request-Headers"
	headerAllowOrigin      = "Access-Control-Allow-Origin"
	headerAllowCredentials = "Access-Control-Allow-Credentials"
	headerAllowMethods     = "Access-Control-Allow-Methods"
	headerAllowHeaders     = "Access-Control-Allow-Headers"
	headerMaxAge           = "Access-Control-Max-Age"
	headerVary             = "Vary"
	preflightMaxAgeSeconds = "600"
)

func isPreflight(r *http.Request) bool {
	return r.Method == http.MethodOptions && r.Header.Get(headerOrigin) != "" && r.Header.Get(headerRequestMethod) != ""
}

func preflightAnswer(r *http.Request, settings Settings) answer {
	if !settings.allowsOrigin(r.Header.Get(headerOrigin)) {
		return problem(http.StatusForbidden, "This origin is not allowed by the mock server's CORS settings.")
	}
	headers := []Header{
		{Key: headerAllowMethods, Value: r.Header.Get(headerRequestMethod)},
		{Key: headerMaxAge, Value: preflightMaxAgeSeconds},
		{Key: headerVary, Value: headerRequestMethod},
		{Key: headerVary, Value: headerRequestHeaders},
	}
	if requested := r.Header.Get(headerRequestHeaders); requested != "" {
		headers = append(headers, Header{Key: headerAllowHeaders, Value: requested})
	}
	return answer{status: http.StatusNoContent, headers: headers}
}

func (s Settings) validateOrigins() error {
	for _, origin := range s.CORSOrigins {
		if _, err := loopback.ParseOrigin(origin); err != nil {
			return fmt.Errorf("--cors-origin %q is not an origin: %w", origin, err)
		}
	}
	return nil
}

func (s Settings) allowsOrigin(origin string) bool {
	parsed, err := loopback.ParseOrigin(origin)
	if err != nil {
		return false
	}
	if parsed.IsLocal {
		return true
	}
	for _, extra := range s.CORSOrigins {
		if wanted, err := loopback.ParseOrigin(extra); err == nil && wanted.Canonical == parsed.Canonical {
			return true
		}
	}
	return false
}

func allowOrigin(header http.Header, r *http.Request, settings Settings) {
	header.Add(headerVary, headerOrigin)
	origin := r.Header.Get(headerOrigin)
	if origin == "" || !settings.allowsOrigin(origin) {
		return
	}
	header.Set(headerAllowOrigin, origin)
	header.Set(headerAllowCredentials, "true")
}
