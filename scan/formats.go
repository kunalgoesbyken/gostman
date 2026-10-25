package scan

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

type charset uint8

const (
	upper charset = 1 << iota
	lower
	digit
	dash
	underscore
	dot
)

const (
	alphanumeric = upper | lower | digit
	urlSafe      = alphanumeric | dash | underscore
)

type rule struct {
	ID       string
	Severity Severity
	Reason   locales.Message
}

func said(code locales.Code) locales.Message {
	return locales.New(code, nil)
}

type format struct {
	rule
	Prefixes []string
	MinBody  int
	MaxBody  int
	Charset  charset
	Segments int
}

type block struct {
	rule
	Opening string
	Closing string
	Trailer string
}

type scheme struct {
	rule
	Name   string
	MinLen int
}

var formats = []format{
	{rule: rule{"aws-access-key-id", High, said(locales.ScanAwsAccessKeyId)}, Prefixes: []string{"AKIA", "ASIA", "ABIA", "ACCA"}, MinBody: 16, MaxBody: 16, Charset: upper | digit},
	{rule: rule{"github-token", High, said(locales.ScanGithubToken)}, Prefixes: []string{"ghp_", "gho_", "ghu_", "ghs_", "ghr_"}, MinBody: 36, MaxBody: 36, Charset: alphanumeric},
	{rule: rule{"github-fine-grained-token", High, said(locales.ScanGithubFineGrainedToken)}, Prefixes: []string{"github_pat_"}, MinBody: 82, MaxBody: 82, Charset: alphanumeric | underscore},
	{rule: rule{"gitlab-token", High, said(locales.ScanGitlabToken)}, Prefixes: []string{"glpat-"}, MinBody: 20, MaxBody: 40, Charset: urlSafe},
	{rule: rule{"slack-token", High, said(locales.ScanSlackToken)}, Prefixes: []string{"xoxb-", "xoxp-", "xoxa-", "xoxr-", "xoxs-", "xapp-"}, MinBody: 20, MaxBody: 200, Charset: alphanumeric | dash},
	{rule: rule{"stripe-live-key", High, said(locales.ScanStripeLiveKey)}, Prefixes: []string{"sk_live_", "rk_live_"}, MinBody: 24, MaxBody: 99, Charset: alphanumeric},
	{rule: rule{"google-api-key", Medium, said(locales.ScanGoogleApiKey)}, Prefixes: []string{"AIza"}, MinBody: 35, MaxBody: 35, Charset: urlSafe},
	{rule: rule{"npm-token", High, said(locales.ScanNpmToken)}, Prefixes: []string{"npm_"}, MinBody: 36, MaxBody: 36, Charset: alphanumeric},
	{rule: rule{"pypi-token", High, said(locales.ScanPypiToken)}, Prefixes: []string{"pypi-AgEI"}, MinBody: 50, MaxBody: 400, Charset: urlSafe},
	{rule: rule{"jwt", Medium, said(locales.ScanJwt)}, Prefixes: []string{"eyJ"}, MinBody: 30, MaxBody: 8192, Charset: urlSafe | dot, Segments: 3},
}

var blocks = []block{
	{rule: rule{"private-key-block", High, said(locales.ScanPrivateKeyBlock)}, Opening: "-----BEGIN ", Closing: "PRIVATE KEY-----", Trailer: "-----END "},
}

var schemes = []scheme{
	{rule: rule{"bearer-literal", Medium, said(locales.ScanBearerLiteral)}, Name: "bearer", MinLen: 20},
}

var (
	entropyRule = rule{"high-entropy-value", Medium, said(locales.ScanHighEntropyValue)}
	literalRule = rule{"auth-literal", Medium, locales.New(locales.ScanAuthLiteral, locales.Params{"example": "{{variable}}"})}
	urlRule     = rule{"url-credentials", Medium, said(locales.ScanUrlCredentials)}
)

func (c charset) has(r rune) bool {
	switch {
	case r >= 'A' && r <= 'Z':
		return c&upper != 0
	case r >= 'a' && r <= 'z':
		return c&lower != 0
	case r >= '0' && r <= '9':
		return c&digit != 0
	case r == '-':
		return c&dash != 0
	case r == '_':
		return c&underscore != 0
	case r == '.':
		return c&dot != 0
	}
	return false
}

func (c charset) covers(text string) bool {
	return strings.IndexFunc(text, func(r rune) bool { return !c.has(r) }) < 0
}

func (f format) accepts(token string) bool {
	for _, prefix := range f.Prefixes {
		if f.acceptsAfter(token, prefix) {
			return true
		}
	}
	return false
}

func (f format) acceptsAfter(token, prefix string) bool {
	body, found := strings.CutPrefix(token, prefix)
	if !found || len(body) < f.MinBody || len(body) > f.MaxBody || !f.Charset.covers(body) {
		return false
	}
	return f.Segments == 0 || hasSegments(token, f.Segments)
}

func hasSegments(token string, count int) bool {
	parts := strings.Split(token, ".")
	if len(parts) != count {
		return false
	}
	for _, part := range parts {
		if part == "" {
			return false
		}
	}
	return true
}

func (s scheme) accepts(previous, token string) bool {
	return strings.EqualFold(previous, s.Name) && len(token) >= s.MinLen && looksRandom(token)
}
