package runner

import (
	"encoding/json"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	WithheldToken = "OAuth 2.0 access token"
	anyOrigin     = "*"
)

type Confinement interface {
	Fills(origin, name, value string) bool
	Signs(origin string, identity engine.OAuth2) bool
	RunsScripts(origin string) bool
	Vet(request Request) (Request, []string)
}

type withheldError struct {
	message string
	names   []string
}

func (e *withheldError) Error() string {
	return e.message
}

type vouch struct {
	name   string
	value  string
	origin string
}

func (s *Session) Confine(confinement Confinement) {
	s.state.confine = confinement
}

func (c *shared) vouch(origin string, values map[string]string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for name, value := range values {
		c.vouched[vouch{name, value, origin}] = true
	}
}

func (c *shared) vouches(origin, name, value string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.vouched[vouch{name, value, anyOrigin}] || c.vouched[vouch{name, value, origin}]
}

func (s *session) vouch(origin string, values map[string]string) {
	if s.confine != nil {
		s.common.vouch(origin, values)
	}
}

func originOf(address string, scope variables) string {
	expansion, err := engine.NewExpansion(scope.text())
	if err != nil {
		return ""
	}
	return engine.Origin(expansion.Text(address))
}

func (s *session) mayFill(origin, name string, raw json.RawMessage) bool {
	value := plainText(raw)
	return s.confine.Fills(origin, name, value) || s.common.vouches(origin, name, value)
}

func (s *session) confined(origin string, scope variables) (variables, []string) {
	kept := variables{}
	var withheld []string
	for name, raw := range scope {
		if s.mayFill(origin, name, raw) {
			kept[name] = raw
			continue
		}
		withheld = append(withheld, name)
	}
	return kept, withheld
}

func (s *session) sendable(request Request) (variables, []string) {
	scope := s.scoped(request)
	if s.confine == nil {
		return scope, nil
	}
	return s.confined(originOf(request.URL, scope), scope)
}

func (s *session) tokenScope(config engine.OAuth2, request Request) (string, []string) {
	scope := s.scoped(request)
	if s.confine == nil {
		return scope.text(), nil
	}
	kept, withheld := s.confined(originOf(config.TokenURL, scope), scope)
	return kept.text(), placedIn(encodedConfig(config), withheld)
}

func encodedConfig(config engine.OAuth2) string {
	encoded, _ := json.Marshal(config)
	return string(encoded)
}

func placedIn(text string, names []string) []string {
	var placed []string
	for _, name := range names {
		if strings.Contains(text, "{{"+name+"}}") {
			placed = append(placed, name)
		}
	}
	return placed
}

func (s *session) signable(request Request) bool {
	if s.confine == nil {
		return true
	}
	effective := engine.InheritedAuth(request.Auth, request.layers())
	if effective.Type != authOAuth2 {
		return true
	}
	return s.confine.Signs(originOf(request.URL, s.scoped(request)), TokenIdentity(effective.OAuth2))
}

func (s *session) scriptLayers(request Request) []scriptLayer {
	layers := s.values.scriptLayers(request, s.once)
	if s.confine == nil {
		return layers
	}
	origin := originOf(request.URL, s.scoped(request))
	if s.confine.RunsScripts(origin) {
		return layers
	}
	for index := range layers {
		layers[index].Values, _ = s.confined(origin, layers[index].Values)
	}
	return layers
}

func (s *session) keepWrites(request Request, writes scopedWrites) {
	origin := ""
	if s.confine != nil {
		origin = originOf(request.URL, s.scoped(request))
	}
	s.values.write(request.Lineage, writes)
	for _, changes := range writes {
		s.vouch(origin, changes.withValues().plain())
	}
}

func (s *session) withheldFrom(request Request) ([]string, []string) {
	var certain []string
	if !s.signable(request) {
		certain = append(certain, WithheldToken)
	}
	_, possible := s.sendable(request)
	return certain, possible
}

func parted(unresolved, possible []string) ([]string, []string) {
	var missing, held []string
	for _, name := range unresolved {
		if slices.Contains(possible, name) {
			held = append(held, name)
			continue
		}
		missing = append(missing, name)
	}
	return missing, held
}

func (s *session) vetted(request Request) (Request, []string) {
	if s.confine == nil {
		return request, nil
	}
	return s.confine.Vet(request)
}

func cookieKey(cookie engine.CookieInfo) string {
	return strings.Join([]string{cookie.Domain, cookie.Path, cookie.Name}, "\n")
}

func (c *shared) tag(origin string, received []engine.CookieInfo) {
	if origin == "" {
		return
	}
	for _, cookie := range received {
		c.origins[cookieKey(cookie)] = origin
	}
}

func (c *shared) cookiesSetBy(origin string) []engine.CookieInfo {
	c.mu.Lock()
	defer c.mu.Unlock()
	own := []engine.CookieInfo{}
	for _, cookie := range c.cookies {
		if c.origins[cookieKey(cookie)] == origin {
			own = append(own, cookie)
		}
	}
	return own
}

func (s *session) cookieOrigin(request Request) string {
	if s.confine == nil {
		return ""
	}
	return originOf(request.URL, s.scoped(request))
}

func (s *session) cookiesFor(request Request) []engine.CookieInfo {
	if s.confine == nil {
		return s.common.cookieList()
	}
	return s.common.cookiesSetBy(s.cookieOrigin(request))
}
