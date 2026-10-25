package agent

import (
	"encoding/json"
	"maps"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type survey struct {
	hosts    map[string]bool
	secrets  map[string]map[string]bool
	tokens   map[string]map[engine.OAuth2]bool
	scripted map[string]bool
	authored map[string]bool
}

type requestScope struct {
	values    scopeValues
	expansion *engine.Expansion
}

type variableRow struct {
	Key     string `json:"key"`
	Value   string `json:"value"`
	Enabled *bool  `json:"enabled"`
}

func newSurvey() survey {
	return survey{
		hosts:    map[string]bool{},
		secrets:  map[string]map[string]bool{},
		tokens:   map[string]map[engine.OAuth2]bool{},
		scripted: map[string]bool{},
		authored: map[string]bool{},
	}
}

func newRequestScope(values scopeValues) requestScope {
	encoded, _ := json.Marshal(values)
	expansion, _ := engine.NewExpansion(string(encoded))
	return requestScope{values: values, expansion: expansion}
}

func ownVariables(text string) scopeValues {
	var rows []variableRow
	if json.Unmarshal([]byte(text), &rows) != nil {
		return nil
	}
	own := scopeValues{}
	for _, row := range rows {
		if strings.TrimSpace(row.Key) == "" || (row.Enabled != nil && !*row.Enabled) {
			continue
		}
		own[row.Key], _ = json.Marshal(row.Value)
	}
	return own
}

func (s requestScope) forRequest(request workspace.Request) requestScope {
	own := ownVariables(request.Vars)
	if len(own) == 0 {
		return s
	}
	values := maps.Clone(s.values)
	maps.Copy(values, own)
	return newRequestScope(values)
}

func settingsOf(files workspace.Collection, folderID string) []workspace.Settings {
	chain := []workspace.Settings{files.Settings}
	for _, folder := range lineageOf(files.Folders, folderID) {
		chain = append(chain, folder.Settings)
	}
	return chain
}

func layersOf(chain []workspace.Settings) []engine.Layer {
	layers := make([]engine.Layer, len(chain))
	for index, settings := range chain {
		layers[index] = engine.Layer{Headers: settings.Headers, Auth: settings.Auth}
	}
	return layers
}

func runsScripts(request workspace.Request, chain []workspace.Settings) bool {
	scripted := hasText(request.PreScript) || hasText(request.PostScript)
	for _, settings := range chain {
		scripted = scripted || hasText(settings.PreScript) || hasText(settings.PostScript)
	}
	return scripted
}

func encodedText(value any) string {
	encoded, _ := json.Marshal(value)
	return string(encoded)
}

func sentTexts(request workspace.Request, chain []workspace.Settings, auth engine.Auth) []string {
	texts := []string{request.URL, request.Headers, request.Body, request.GraphqlQuery, request.GraphqlVariables, request.GrpcMessage, request.McpArguments}
	for _, settings := range chain {
		texts = append(texts, settings.Headers)
	}
	if auth.Type != authOAuth2 {
		texts = append(texts, encodedText(auth))
	}
	return texts
}

func variablesIn(text string) []string {
	var names []string
	for _, span := range engine.PlaceholderSpans(text) {
		name := strings.TrimSpace(text[span[0]+2 : span[1]-2])
		if asked, prompted := engine.PromptName(name); prompted {
			name = asked
		}
		if !strings.HasPrefix(name, dynamicPrefix) {
			names = append(names, name)
		}
	}
	return names
}

func (s requestScope) variablesSent(texts ...string) []string {
	var pending, found []string
	for _, text := range texts {
		pending = append(pending, variablesIn(text)...)
	}
	visited := map[string]bool{}
	for len(pending) > 0 {
		name := pending[len(pending)-1]
		pending = pending[:len(pending)-1]
		if visited[name] {
			continue
		}
		visited[name] = true
		found = append(found, name)
		if value, isText := plainValue(s.values[name]); isText {
			pending = append(pending, variablesIn(value)...)
		}
	}
	return found
}

func (s requestScope) originOf(address string) string {
	return engine.Origin(s.expansion.Text(address))
}

func (s survey) note(origin string, names []string) {
	if origin == "" || len(names) == 0 {
		return
	}
	if s.secrets[origin] == nil {
		s.secrets[origin] = map[string]bool{}
	}
	for _, name := range names {
		s.secrets[origin][name] = true
	}
}

func (s survey) sign(origin string, identity engine.OAuth2) {
	if s.tokens[origin] == nil {
		s.tokens[origin] = map[engine.OAuth2]bool{}
	}
	s.tokens[origin][identity] = true
}

func (s survey) study(request workspace.Request, chain []workspace.Settings, scope requestScope) {
	if scope.expansion == nil {
		return
	}
	for _, address := range addressesOf(request) {
		if host := hostOf(scope.expansion.Text(address)); host != "" {
			s.hosts[host] = true
		}
	}
	origin := scope.originOf(request.URL)
	auth := engine.InheritedAuth(request.Auth, layersOf(chain))
	s.note(origin, scope.variablesSent(sentTexts(request, chain, auth)...))
	if auth.Type == authOAuth2 {
		s.sign(origin, runner.TokenIdentity(auth.OAuth2))
		s.note(scope.originOf(auth.OAuth2.TokenURL), scope.variablesSent(encodedText(auth.OAuth2)))
	}
	if runsScripts(request, chain) && origin != "" {
		s.scripted[origin] = true
	}
}

type secretScope struct {
	client *Client
	reach  *destinations
}

func (s secretScope) Fills(origin, name, value string) bool {
	if s.reach.sends(origin, name) {
		return true
	}
	for _, secret := range s.client.secretsHeldBy(name, value) {
		if !s.reach.sends(origin, secret) {
			return false
		}
	}
	return true
}

func (s secretScope) Signs(origin string, identity engine.OAuth2) bool {
	s.reach.mu.RLock()
	defer s.reach.mu.RUnlock()
	return s.reach.survey.tokens[origin][identity]
}

func (s secretScope) RunsScripts(origin string) bool {
	s.reach.mu.RLock()
	defer s.reach.mu.RUnlock()
	return s.reach.survey.scripted[origin]
}

func (d *destinations) sends(origin, name string) bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.survey.secrets[origin][name]
}

type labelMemo struct {
	size   int
	labels []string
}

func (c *Client) labelsIn(value string) []string {
	size := c.guard.Size()
	if memo, found := c.labels.Load(value); found && memo.(labelMemo).size == size {
		return memo.(labelMemo).labels
	}
	labels := c.guard.Labels(value)
	c.labels.Store(value, labelMemo{size: size, labels: labels})
	return labels
}

func (c *Client) secretsHeldBy(name, value string) []string {
	var held []string
	if c.isSecretName(name) {
		held = append(held, name)
	}
	for _, label := range c.labelsIn(value) {
		if label != name && (c.isSecretName(label) || strings.HasPrefix(label, hiddenPrefix)) {
			held = append(held, label)
		}
	}
	return held
}
