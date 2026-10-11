package agent

import (
	"encoding/json"
	"net"
	"net/url"
	"strings"

	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/workspace"
)

const AnyHost = "*"

type destinations struct {
	allowed map[string]bool
	known   map[string]bool
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

func baseline(environment workspace.Environment, startup map[string]string) string {
	values := map[string]any{}
	json.Unmarshal([]byte(environment.Variables), &values)
	for name, value := range startup {
		values[name] = value
	}
	encoded, _ := json.Marshal(values)
	return string(encoded)
}

func addressesOf(request workspace.Request) []string {
	return []string{request.URL, request.Auth.OAuth2.TokenURL, request.Auth.OAuth2.AuthURL}
}

func (d *destinations) forget() {
	d.known = map[string]bool{}
}

func (d *destinations) learn(files workspace.Collection, authored map[string]bool, startup map[string]string) {
	known := map[string]bool{}
	environments := files.Environments
	if len(environments) == 0 {
		environments = []workspace.Environment{{}}
	}
	for _, environment := range environments {
		expansion, err := engine.NewExpansion(baseline(environment, startup))
		if err != nil {
			continue
		}
		for _, request := range files.Requests {
			if authored[request.Id] {
				continue
			}
			for _, address := range addressesOf(request) {
				if host := hostOf(expansion.Text(address)); host != "" {
					known[host] = true
				}
			}
		}
	}
	d.known = known
}

func isLoopback(host string) bool {
	if host == "localhost" {
		return true
	}
	address := net.ParseIP(host)
	return address != nil && address.IsLoopback()
}

func (d *destinations) permit(host string) bool {
	name := strings.ToLower(host)
	return d.allowed[AnyHost] || d.allowed[name] || d.known[name] || isLoopback(name)
}
