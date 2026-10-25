package runner

import (
	"net/url"
	"strings"

	"github.com/kunalgoesbyken/gostman/redact"
)

const (
	tokenLabel   = "oauth.accessToken"
	refreshLabel = "oauth.refreshToken"
	queryLabel   = "query."
)

func learnQuery(guard *redact.Redactor, address string) {
	parsed, err := url.Parse(address)
	if err != nil {
		return
	}
	for name, values := range parsed.Query() {
		if !redact.IsSensitiveName(name) {
			continue
		}
		for _, value := range values {
			guard.LearnSecret(queryLabel+name, value)
		}
	}
}

func (s *session) shownURL(request Request, address string) string {
	if strings.TrimSpace(address) == "" {
		return ""
	}
	guard := redact.New()
	for name, value := range s.scoped(request).plain() {
		if redact.IsSensitiveName(name) {
			guard.Learn(name, value)
		}
	}
	for name, value := range s.common.secretList() {
		guard.LearnSecret(name, value)
	}
	guard.LearnSecret(tokenLabel, s.common.signIn.AccessToken)
	for _, token := range s.common.tokenList() {
		guard.LearnSecret(tokenLabel, token.AccessToken)
		guard.LearnSecret(refreshLabel, token.RefreshToken)
	}
	learnQuery(guard, address)
	return guard.Text(address)
}
