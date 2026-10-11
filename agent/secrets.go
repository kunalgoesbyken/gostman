package agent

import (
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/redact"
	"github.com/krockxz/gostman/runner"
)

const (
	hiddenPrefix  = "redacted:"
	headerPrefix  = hiddenPrefix + "header."
	cookiePrefix  = hiddenPrefix + "cookie."
	schemeDivider = " "
	cookieDivider = ";"
	cookieHeader  = "cookie"
)

var credentialHeaders = map[string]bool{
	"authorization":       true,
	"proxy-authorization": true,
	"cookie":              true,
	"set-cookie":          true,
}

type secretField struct {
	label string
	value *string
}

func isCredentialHeader(name string) bool {
	return credentialHeaders[strings.ToLower(strings.TrimSpace(name))]
}

func headerLabel(name string) string {
	return headerPrefix + strings.ToLower(strings.TrimSpace(name))
}

func hasPlaceholder(text string) bool {
	return len(engine.PlaceholderSpans(text)) > 0
}

func authFields(auth *engine.Auth) []secretField {
	return append([]secretField{
		{hiddenPrefix + "auth.password", &auth.Password},
		{hiddenPrefix + "auth.token", &auth.Token},
		{hiddenPrefix + "auth.apiKey", &auth.Value},
	}, tokenFields(&auth.OAuth2)...)
}

func tokenFields(config *engine.OAuth2) []secretField {
	return []secretField{
		{hiddenPrefix + "oauth.clientSecret", &config.ClientSecret},
		{hiddenPrefix + "oauth.password", &config.Password},
		{hiddenPrefix + "oauth.accessToken", &config.AccessToken},
		{hiddenPrefix + "oauth.refreshToken", &config.RefreshToken},
	}
}

func isLiteral(value string) bool {
	return value != "" && !hasPlaceholder(value)
}

func maskAuth(auth engine.Auth) engine.Auth {
	for _, field := range authFields(&auth) {
		if isLiteral(*field.value) {
			*field.value = redact.Marker(field.label)
		}
	}
	return auth
}

func variableNames(environment runner.Environment) []string {
	values, _ := environment.Values()
	names := make([]string, 0, len(values))
	for name := range values {
		names = append(names, name)
	}
	return sorted(names)
}

func (c *Client) learnResolved(label, value string) {
	if hasPlaceholder(value) {
		return
	}
	c.guard.LearnSecret(label, value)
}

func (c *Client) learnEnvironment(environment runner.Environment) {
	values, _ := environment.Values()
	for name, value := range values {
		c.guard.Learn(name, value)
	}
}

func credentialOf(value string) string {
	_, credential, found := strings.Cut(strings.TrimSpace(value), schemeDivider)
	if !found {
		return value
	}
	return credential
}

func (c *Client) learnCookiePairs(header string) {
	for _, pair := range strings.Split(header, cookieDivider) {
		name, value, _ := strings.Cut(strings.TrimSpace(pair), "=")
		c.learnResolved(cookiePrefix+name, value)
	}
}

func (c *Client) learnHeader(header engine.HeaderEntry) {
	name := strings.ToLower(strings.TrimSpace(header.Key))
	switch {
	case name == cookieHeader:
		c.learnCookiePairs(header.Value)
	case credentialHeaders[name]:
		c.learnResolved(headerLabel(name), credentialOf(header.Value))
	}
}

func (c *Client) learnCredentials(headers string, auth engine.Auth, variables string) {
	expansion, err := engine.NewExpansion(variables)
	if err != nil {
		return
	}
	for _, field := range authFields(&auth) {
		c.learnResolved(field.label, expansion.Text(*field.value))
	}
	sent, err := expansion.Headers(headers, auth)
	if err != nil {
		return
	}
	for _, header := range sent {
		c.learnHeader(header)
	}
}

func (c *Client) witness(sent engine.Request) {
	c.learnCredentials(sent.Headers, sent.Auth, sent.Variables)
}

func (c *Client) Study(stored runner.Collection) error {
	for _, environment := range stored.Environments {
		c.learnEnvironment(environment)
	}
	listed, err := c.session.Catalog(stored, "")
	if err != nil {
		return err
	}
	for _, entry := range listed {
		c.learnCredentials(entry.Request.Headers, entry.Request.Auth, "")
	}
	return nil
}

func (c *Client) absorb() {
	for name, value := range c.session.Variables() {
		c.guard.Learn(name, value)
	}
	for _, cookie := range c.session.Cookies() {
		c.guard.Learn(cookiePrefix+cookie.Name, cookie.Value)
	}
	for _, token := range c.session.Tokens() {
		for _, field := range tokenFields(&token) {
			c.learnResolved(field.label, *field.value)
		}
	}
}

func maskHeaders(headers []engine.HeaderEntry, isHidden func(string) bool) []engine.HeaderEntry {
	masked := make([]engine.HeaderEntry, 0, len(headers))
	for _, header := range headers {
		if isCredentialHeader(header.Key) && isHidden(header.Value) {
			header.Value = redact.Marker(headerLabel(header.Key))
		}
		masked = append(masked, header)
	}
	return masked
}

func always(string) bool {
	return true
}
