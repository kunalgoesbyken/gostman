package scan

import (
	_ "embed"
	"encoding/json"
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

//go:embed token_formats.json
var tokenFormatsJSON []byte

type tokenFormat struct {
	ID       string   `json:"id"`
	Prefixes []string `json:"prefixes"`
	MinBody  int      `json:"minBody"`
	MaxBody  int      `json:"maxBody"`
	Charset  []string `json:"charset"`
	Segments int      `json:"segments"`
}

var charsets = map[string]charset{"upper": upper, "lower": lower, "digit": digit, "dash": dash, "underscore": underscore, "dot": dot}

var formatRules = map[string]rule{
	"aws-access-key-id":         {Severity: High, Reason: said(locales.ScanAwsAccessKeyId)},
	"github-token":              {Severity: High, Reason: said(locales.ScanGithubToken)},
	"github-fine-grained-token": {Severity: High, Reason: said(locales.ScanGithubFineGrainedToken)},
	"gitlab-token":              {Severity: High, Reason: said(locales.ScanGitlabToken)},
	"slack-token":               {Severity: High, Reason: said(locales.ScanSlackToken)},
	"stripe-live-key":           {Severity: High, Reason: said(locales.ScanStripeLiveKey)},
	"google-api-key":            {Severity: Medium, Reason: said(locales.ScanGoogleApiKey)},
	"npm-token":                 {Severity: High, Reason: said(locales.ScanNpmToken)},
	"pypi-token":                {Severity: High, Reason: said(locales.ScanPypiToken)},
	"jwt":                       {Severity: Medium, Reason: said(locales.ScanJwt)},
}

var formats = loadFormats()

func loadFormats() []format {
	var entries []tokenFormat
	if err := json.Unmarshal(tokenFormatsJSON, &entries); err != nil {
		panic("scan: token_formats.json is invalid: " + err.Error())
	}
	loaded := make([]format, 0, len(entries))
	for _, entry := range entries {
		var allowed charset
		for _, name := range entry.Charset {
			allowed |= charsets[name]
		}
		found := formatRules[entry.ID]
		found.ID = entry.ID
		loaded = append(loaded, format{rule: found, Prefixes: entry.Prefixes, MinBody: entry.MinBody, MaxBody: entry.MaxBody, Charset: allowed, Segments: entry.Segments})
	}
	return loaded
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
