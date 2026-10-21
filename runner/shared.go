package runner

import (
	"maps"
	"sync"

	"github.com/kunalgoesbyken/gostman/engine"
)

type shared struct {
	mu      sync.Mutex
	cookies []engine.CookieInfo
	tokens  tokenCache
	seen    map[string]string
	witness func(engine.Request)

	witnessMu sync.Mutex
	signInMu  sync.Mutex
}

func newShared() *shared {
	return &shared{cookies: []engine.CookieInfo{}, tokens: tokenCache{}, seen: map[string]string{}}
}

func (c *shared) cookieList() []engine.CookieInfo {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]engine.CookieInfo{}, c.cookies...)
}

func (c *shared) tokenList() []engine.OAuth2 {
	c.mu.Lock()
	defer c.mu.Unlock()
	tokens := make([]engine.OAuth2, 0, len(c.tokens))
	for _, token := range c.tokens {
		tokens = append(tokens, token)
	}
	return tokens
}

func (c *shared) publish(values map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	maps.Copy(c.seen, values)
}

func (c *shared) observedList() map[string]string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return maps.Clone(c.seen)
}

func (c *shared) recall(config engine.OAuth2) engine.OAuth2 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.tokens.recall(config)
}

func (c *shared) remember(config engine.OAuth2) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.tokens.remember(config)
}

func (c *shared) watch(witness func(engine.Request)) {
	c.witnessMu.Lock()
	defer c.witnessMu.Unlock()
	c.witness = witness
}

func (c *shared) announce(prepared engine.Request) {
	c.witnessMu.Lock()
	defer c.witnessMu.Unlock()
	if c.witness != nil {
		c.witness(prepared)
	}
}
