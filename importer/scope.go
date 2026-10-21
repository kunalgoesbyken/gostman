package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

type scope struct {
	headers []row
	vars    []row
	auth    *engine.Auth
	pre     []string
	post    []string
}

func (s scope) within(inner scope) scope {
	merged := scope{
		headers: mergeRows(s.headers, inner.headers),
		vars:    mergeRows(s.vars, inner.vars),
		auth:    s.auth,
		pre:     append(append([]string{}, s.pre...), inner.pre...),
		post:    append(append([]string{}, s.post...), inner.post...),
	}
	if inner.auth != nil {
		merged.auth = inner.auth
	}
	return merged
}

func (s scope) authFor(own *engine.Auth) engine.Auth {
	switch {
	case own != nil:
		return *own
	case s.auth != nil:
		return *s.auth
	}
	return engine.Auth{}
}

func (s scope) preScript(own string) string {
	return joinScripts(append(append([]string{}, s.pre...), own))
}

func (s scope) postScript(own string) string {
	return joinScripts(append([]string{own}, s.post...))
}

func mergeRows(outer, inner []row) []row {
	known := map[string]bool{}
	for _, candidate := range inner {
		known[strings.ToLower(candidate.Key)] = true
	}
	var merged []row
	for _, candidate := range outer {
		if !known[strings.ToLower(candidate.Key)] {
			merged = append(merged, candidate)
		}
	}
	return append(merged, inner...)
}

func joinScripts(scripts []string) string {
	var kept []string
	for _, script := range scripts {
		if strings.TrimSpace(script) != "" {
			kept = append(kept, script)
		}
	}
	return strings.Join(kept, "\n\n")
}

func (c *collector) flagScripts(name, pre, post string) {
	if strings.TrimSpace(pre) == "" && strings.TrimSpace(post) == "" {
		return
	}
	c.flag(messageScripts, name)
	if callsForeignAPI(pre) || callsForeignAPI(post) {
		c.flag(messageForeignCalls, name)
	}
}

var foreignAPIs = []string{"pm.", "bru.", "insomnia."}

func callsForeignAPI(script string) bool {
	for _, api := range foreignAPIs {
		if mentions(script, api) {
			return true
		}
	}
	return false
}

func mentions(script, api string) bool {
	for offset := 0; offset < len(script); {
		index := strings.Index(script[offset:], api)
		if index < 0 {
			return false
		}
		at := offset + index
		if at == 0 || !isIdentifierByte(script[at-1]) {
			return true
		}
		offset = at + len(api)
	}
	return false
}

func isIdentifierByte(b byte) bool {
	return b == '_' || b == '$' || b >= '0' && b <= '9' || b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= 0x80
}
