package agent

import (
	"encoding/json"
	"net/url"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	hiddenPrefix  = "redacted:"
	headerPrefix  = hiddenPrefix + "header."
	cookiePrefix  = hiddenPrefix + "cookie."
	queryPrefix   = hiddenPrefix + "query."
	bodyPrefix    = hiddenPrefix + "body."
	schemeDivider = " "
	cookieDivider = ";"
	cookieHeader  = "cookie"
	queryStart    = "?"
	fragmentStart = "#"
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
		{hiddenPrefix + "aws.secretKey", &auth.AWS.SecretKey},
		{hiddenPrefix + "aws.sessionToken", &auth.AWS.SessionToken},
		{hiddenPrefix + "oauth1.consumerSecret", &auth.OAuth1.ConsumerSecret},
		{hiddenPrefix + "oauth1.tokenSecret", &auth.OAuth1.TokenSecret},
		{hiddenPrefix + "oauth1.token", &auth.OAuth1.Token},
		{hiddenPrefix + "oauth1.privateKey", &auth.OAuth1.PrivateKey},
		{hiddenPrefix + "edgegrid.clientSecret", &auth.EdgeGrid.ClientSecret},
		{hiddenPrefix + "edgegrid.accessToken", &auth.EdgeGrid.AccessToken},
		{hiddenPrefix + "jwt.secret", &auth.JWT.Secret},
		{hiddenPrefix + "jwt.privateKey", &auth.JWT.PrivateKey},
		{hiddenPrefix + "asap.privateKey", &auth.ASAP.PrivateKey},
		{hiddenPrefix + "hawk.key", &auth.Hawk.Key},
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

func (c *Client) learnAll(values map[string]string) {
	for name, value := range values {
		c.guard.Learn(name, value)
	}
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
	case redact.IsSensitiveName(name):
		c.learnResolved(headerLabel(name), header.Value)
	}
}

func (c *Client) learnBody(body, variables string) {
	expansion, err := engine.NewExpansion(variables)
	if err != nil {
		return
	}
	var document any
	if json.Unmarshal([]byte(expansion.Text(body)), &document) != nil {
		return
	}
	redact.MapSensitive(document, func(name, value string) string {
		c.learnResolved(bodyPrefix+name, value)
		return value
	})
}

func (c *Client) learnQuery(address, variables string) {
	expansion, err := engine.NewExpansion(variables)
	if err != nil {
		return
	}
	_, query, found := strings.Cut(expansion.Text(address), queryStart)
	if !found {
		return
	}
	query, _, _ = strings.Cut(query, fragmentStart)
	parsed, _ := url.ParseQuery(query)
	for name, values := range parsed {
		if !redact.IsSensitiveName(name) {
			continue
		}
		for _, value := range values {
			c.learnResolved(queryPrefix+name, value)
		}
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
	c.learnQuery(sent.URL, sent.Variables)
	c.learnBody(sent.Body, sent.Variables)
}

func (c *Client) Study(stored runner.Collection) error {
	for _, environment := range stored.Environments {
		c.learnEnvironment(environment)
	}
	c.learnEnvironment(runner.Environment{Variables: stored.Variables})
	c.learnCredentials(stored.Settings.Headers, stored.Settings.Auth, stored.Variables)
	for _, folder := range stored.Folders {
		c.learnEnvironment(runner.Environment{Variables: folder.Variables})
		c.learnCredentials(folder.Headers, folder.Auth, folder.Variables)
	}
	listed, err := c.session.Catalog(stored, "")
	if err != nil {
		return err
	}
	for _, entry := range listed {
		c.learnCredentials(entry.Request.Headers, entry.Request.Auth, "")
		c.learnQuery(entry.Request.URL, "")
		c.learnBody(entry.Request.Body, "")
	}
	return nil
}

func (c *Client) absorb() {
	c.learnAll(c.session.Variables())
	c.absorbShared()
}

func (c *Client) absorbShared() {
	c.learnAll(c.session.Observed())
	for name, value := range c.session.Resolved() {
		c.learnResolved(name, value)
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
