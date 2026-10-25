package agent

import (
	"encoding/json"
	"maps"
	"net/url"
	"slices"
	"strings"
	"sync"

	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	AnyHost       = "*"
	authorityEnds = "/?#\\"
)

type destinations struct {
	mu      sync.RWMutex
	allowed map[string]bool
	survey  survey
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
	return &destinations{allowed: hosts, survey: newSurvey()}
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

const (
	collectionScope = "gostman.yaml"
	collectionList  = "/collection"
)

type scopeValues map[string]json.RawMessage

func plainValue(raw json.RawMessage) (string, bool) {
	var text string
	return text, json.Unmarshal(raw, &text) == nil
}

func personValues(variables string, written map[string]string) scopeValues {
	values := scopeValues{}
	json.Unmarshal([]byte(variables), &values)
	for name, raw := range values {
		if text, isText := plainValue(raw); isText && written[name] == workspace.Fingerprint(text) {
			delete(values, name)
		}
	}
	return values
}

func baseline(environment workspace.Environment, written map[string]string, startup map[string]string) scopeValues {
	values := personValues(environment.Variables, written)
	for name, value := range startup {
		values[name], _ = json.Marshal(value)
	}
	return values
}

func collectionListOf(folderID string) string {
	return folderID + collectionList
}

func lineageOf(folders []workspace.Folder, folderID string) []workspace.Folder {
	byID := map[string]workspace.Folder{}
	for _, folder := range folders {
		byID[folder.Id] = folder
	}
	var lineage []workspace.Folder
	visited := map[string]bool{}
	for id := folderID; id != "" && !visited[id]; {
		folder, found := byID[id]
		if !found {
			break
		}
		visited[id] = true
		lineage = append([]workspace.Folder{folder}, lineage...)
		id = folder.ParentId
	}
	return lineage
}

func requestValues(files workspace.Collection, authors authorship, folderID string, environment scopeValues) scopeValues {
	lineage := lineageOf(files.Folders, folderID)
	merged := personValues(files.Variables, authors.variables[collectionScope])
	for _, folder := range lineage {
		maps.Copy(merged, personValues(folder.CollectionVariables, authors.variables[collectionListOf(folder.Id)]))
	}
	maps.Copy(merged, environment)
	for _, folder := range lineage {
		maps.Copy(merged, personValues(folder.Variables, authors.variables[folder.Id]))
	}
	return merged
}

func addressesOf(request workspace.Request) []string {
	return []string{request.URL, request.Auth.OAuth2.TokenURL, request.Auth.OAuth2.AuthURL}
}

func authorityOf(address string) string {
	text := strings.TrimSpace(address)
	_, rest, schemed := strings.Cut(text, schemeSeparator)
	if !schemed {
		rest = text
	}
	if end := strings.IndexAny(rest, authorityEnds); end >= 0 {
		return text[:len(text)-len(rest)+end]
	}
	return text
}

func authorities(request workspace.Request) []string {
	var found []string
	for _, address := range addressesOf(request) {
		found = append(found, authorityOf(address))
	}
	return found
}

func redirected(before, after workspace.Request) bool {
	return !slices.Equal(authorities(before), authorities(after))
}

func placeholdersSent(request workspace.Request) map[string]bool {
	names := map[string]bool{}
	for _, text := range sentTexts(request, nil, request.Auth) {
		for _, name := range variablesIn(text) {
			names[name] = true
		}
	}
	return names
}

func addsPlaceholders(before, after workspace.Request) bool {
	known := placeholdersSent(before)
	for name := range placeholdersSent(after) {
		if !known[name] {
			return true
		}
	}
	return false
}

func (d *destinations) forget() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.survey = newSurvey()
}

func (d *destinations) learn(files workspace.Collection, authors authorship, startup map[string]string) {
	found := newSurvey()
	found.authored = authors.requests
	environments := files.Environments
	if len(environments) == 0 {
		environments = []workspace.Environment{{}}
	}
	for _, environment := range environments {
		values := baseline(environment, authors.variables[environment.Id], startup)
		folders := map[string]requestScope{}
		for _, request := range files.Requests {
			if authors.requests[request.Id] {
				continue
			}
			folder, seen := folders[request.FolderId]
			if !seen {
				folder = newRequestScope(requestValues(files, authors, request.FolderId, values))
				folders[request.FolderId] = folder
			}
			found.study(request, settingsOf(files, request.FolderId), folder.forRequest(request))
		}
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	d.survey = found
}

func (d *destinations) permit(host string) bool {
	name := strings.ToLower(host)
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.allowed[AnyHost] || d.allowed[name] || d.survey.hosts[name] || loopback.IsName(name)
}
