package engine

import "net/http"

func (p Policy) Transport(insecureTLS bool) http.RoundTripper {
	return p.route(insecureTLS)
}
