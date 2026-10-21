package loadtest

import (
	"net/url"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
)

const (
	headerLabelPrefix = "header:"
	queryLabelPrefix  = "query:"
	authLabelPrefix   = "auth:"
	schemeDivider     = " "
)

func Guard(request engine.Request) *redact.Redactor {
	guard := redact.New()
	learnAuth(guard, request.Auth)
	prepared, err := engine.Prepare(request)
	if err != nil {
		return guard
	}
	for _, header := range prepared.Headers {
		learnHeader(guard, header)
	}
	learnAddress(guard, prepared.URL)
	return guard
}

func learnAuth(guard *redact.Redactor, auth engine.Auth) {
	secrets := map[string]string{
		"password":     auth.Password,
		"token":        auth.Token,
		"value":        auth.Value,
		"clientSecret": auth.OAuth2.ClientSecret,
		"accessToken":  auth.OAuth2.AccessToken,
		"refreshToken": auth.OAuth2.RefreshToken,
		"oauthSecret":  auth.OAuth2.Password,
	}
	for name, secret := range secrets {
		if secret != "" {
			guard.LearnSecret(authLabelPrefix+name, secret)
		}
	}
}

func learnHeader(guard *redact.Redactor, header engine.HeaderEntry) {
	if !redact.IsSensitiveName(header.Key) {
		return
	}
	_, credential, found := strings.Cut(strings.TrimSpace(header.Value), schemeDivider)
	if !found {
		credential = header.Value
	}
	guard.LearnSecret(headerLabelPrefix+strings.ToLower(header.Key), credential)
}

func learnAddress(guard *redact.Redactor, address string) {
	parsed, err := url.Parse(address)
	if err != nil {
		return
	}
	for name, values := range parsed.Query() {
		learnQuery(guard, name, values)
	}
	if password, set := parsed.User.Password(); set {
		guard.LearnSecret(authLabelPrefix+"userinfo", password)
	}
}

func learnQuery(guard *redact.Redactor, name string, values []string) {
	if !redact.IsSensitiveName(name) {
		return
	}
	for _, value := range values {
		guard.LearnSecret(queryLabelPrefix+name, value)
	}
}
