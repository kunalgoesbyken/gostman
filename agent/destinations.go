package agent

import (
	"encoding/json"
	"net/url"
	"slices"
	"strings"
	"sync"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const AnyHost = "*"

type destinations struct {
	mu      sync.RWMutex
	allowed map[string]bool
	known   map[string]bool
}

type authorship struct {
	requests  map[string]bool
	variables workspace.AgentValues
}

func newDestinations(allowed []string) *destinations {
	hosts := map[string]bool{}
	for _, host := range allowed {
		hosts[strings.ToLower(strings.TrimSpace(host))] = true
	}
	return &destinations{allowed: hosts, known: map[string]bool{}}
}

func hostOf(address string) string {
	text := strings.TrimSpace(address)
	if text == "" {
		return ""
	}
	if !strings.Contains(text, "://") {
		text = "http://" + text
	}
	parsed, err := url.Parse(text)
	if err != nil {
		return ""
	}
	return strings.ToLower(parsed.Hostname())
}

func plainValue(raw json.RawMessage) (string, bool) {
	var text string
	return text, json.Unmarshal(raw, &text) == nil
}

func baseline(environment workspace.Environment, written map[string]string, startup map[string]string) string {
	values := map[string]json.RawMessage{}
	json.Unmarshal([]byte(environment.Variables), &values)
	for name, raw := range values {
		if text, isText := plainValue(raw); isText && written[name] == workspace.Fingerprint(text) {
			delete(values, name)
		}
	}
	for name, value := range startup {
		values[name], _ = json.Marshal(value)
	}
	encoded, _ := json.Marshal(values)
	return string(encoded)
}

func addressesOf(request workspace.Request) []string {
	return []string{request.URL, request.Auth.OAuth2.TokenURL, request.Auth.OAuth2.AuthURL}
}

func redirected(before, after workspace.Request) bool {
	return !slices.Equal(addressesOf(before), addressesOf(after))
}

func (d *destinations) forget() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.known = map[string]bool{}
}

func (d *destinations) learn(files workspace.Collection, authors authorship, startup map[string]string) {
	known := map[string]bool{}
	environments := files.Environments
	if len(environments) == 0 {
		environments = []workspace.Environment{{}}
	}
	for _, environment := range environments {
		expansion, err := engine.NewExpansion(baseline(environment, authors.variables[environment.Id], startup))
		if err != nil {
			continue
		}
		for _, request := range files.Requests {
			if authors.requests[request.Id] {
				continue
			}
			for _, address := range addressesOf(request) {
				if host := hostOf(expansion.Text(address)); host != "" {
					known[host] = true
				}
			}
		}
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	d.known = known
}

func (d *destinations) permit(host string) bool {
	name := strings.ToLower(host)
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.allowed[AnyHost] || d.allowed[name] || d.known[name] || loopback.IsName(name)
}
