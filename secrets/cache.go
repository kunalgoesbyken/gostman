package secrets

import (
	"sync"
	"time"
)

const (
	cacheLifetime = 5 * time.Minute
	cacheLimit    = 256
)

type cached struct {
	value   string
	expires time.Time
}

type cache struct {
	mu       sync.Mutex
	entries  map[string]cached
	lifetime time.Duration
	now      func() time.Time
}

func newCache() *cache {
	return &cache{entries: map[string]cached{}, lifetime: cacheLifetime, now: time.Now}
}

func (c *cache) get(key string) (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, found := c.entries[key]
	if !found {
		return "", false
	}
	if !c.now().Before(entry.expires) {
		delete(c.entries, key)
		return "", false
	}
	return entry.value, true
}

func (c *cache) put(key, value string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) >= cacheLimit {
		c.evict()
	}
	c.entries[key] = cached{value: value, expires: c.now().Add(c.lifetime)}
}

func (c *cache) evict() {
	for key, entry := range c.entries {
		if !c.now().Before(entry.expires) {
			delete(c.entries, key)
		}
	}
	if len(c.entries) >= cacheLimit {
		clear(c.entries)
	}
}
