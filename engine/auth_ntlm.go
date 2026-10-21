package engine

import (
	"net/http"
	"strings"

	"github.com/Azure/go-ntlmssp"
)

const authNTLM = "ntlm"

type ntlmRoundTripper struct {
	base     http.RoundTripper
	username string
	password string
}

func ntlmRoute(base http.RoundTripper, username, password, domain string) http.RoundTripper {
	if domain = strings.TrimSpace(domain); domain != "" && !strings.ContainsAny(username, `\@`) {
		username = domain + `\` + username
	}
	return ntlmRoundTripper{base: &ntlmssp.Negotiator{RoundTripper: base}, username: username, password: password}
}

func (t ntlmRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	next := req.Clone(req.Context())
	next.SetBasicAuth(t.username, t.password)
	return t.base.RoundTrip(next)
}
