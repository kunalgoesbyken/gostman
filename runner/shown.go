package runner

import (
	"maps"
	"net/url"
	"strings"

	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	tokenLabel   = "oauth.accessToken"
	refreshLabel = "oauth.refreshToken"
	queryLabel   = "query."
)

func markedSecrets(stored Collection) map[string]bool {
	marked := workspace.SecretNames(stored.VariablesMeta)
	for _, environment := range stored.Environments {
		maps.Copy(marked, workspace.SecretNames(environment.Meta))
	}
	for _, folder := range stored.Folders {
		maps.Copy(marked, workspace.SecretNames(folder.CollectionVariablesMeta))
	}
	return marked
}

func (c *shared) keepMarked(names map[string]bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.marked = names
}

func (c *shared) addMarked(names map[string]bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	marked := maps.Clone(c.marked)
	if marked == nil {
		marked = map[string]bool{}
	}
	maps.Copy(marked, names)
	c.marked = marked
}

func (c *shared) isMarked(name string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.marked[name]
}

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
		if s.common.isMarked(name) || redact.IsSensitiveName(name) {
			guard.LearnSecret(name, value)
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
