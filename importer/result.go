package importer

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	untitledRequest     = "Untitled request"
	untitledFolder      = "Folder"
	untitledEnvironment = "Environment"
	defaultMethod       = "GET"
	shownNames          = 5
)

type Source struct {
	Name         string `json:"name"`
	Format       string `json:"format"`
	Requests     int    `json:"requests"`
	Folders      int    `json:"folders"`
	Environments int    `json:"environments"`
}

type Result struct {
	Sources      []Source                `json:"sources"`
	Requests     []workspace.Request     `json:"requests"`
	Folders      []workspace.Folder      `json:"folders"`
	Environments []workspace.Environment `json:"environments"`
	Variables    map[string]string       `json:"variables"`
	Warnings     []string                `json:"warnings"`
	Skipped      []string                `json:"skipped"`
}

type collector struct {
	Result
	flags     map[string][]string
	flagOrder []string
	full      bool
	scripts   scriptTally

	visitedNodes map[*insomniaNode]bool
}

func newCollector() *collector {
	return &collector{Result: Result{Variables: map[string]string{}}, flags: map[string][]string{}, visitedNodes: map[*insomniaNode]bool{}}
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func clip(text string, limit int) string {
	if runes := []rune(text); len(runes) > limit {
		return string(runes[:limit])
	}
	return text
}

func cleanName(name, fallback string) string {
	cleaned := strings.TrimFunc(name, unicode.IsSpace)
	if cleaned == "" {
		return fallback
	}
	return clip(cleaned, maxNameRunes)
}

func cleanMethod(method string) string {
	upper := strings.ToUpper(strings.TrimSpace(method))
	if upper == "" || len(upper) > maxMethodLength {
		return defaultMethod
	}
	for _, r := range upper {
		if r < 'A' || r > 'Z' {
			return defaultMethod
		}
	}
	return upper
}

func objectJSON(values map[string]string) string {
	encoded, err := json.Marshal(values)
	if err != nil {
		return "{}"
	}
	return string(encoded)
}

func newRequest(name, method, url string) workspace.Request {
	request := workspace.BlankRequest(newID())
	request.Name = cleanName(name, untitledRequest)
	request.Method = cleanMethod(method)
	request.URL = url
	return request
}

func (c *collector) addFolder(name, parentID string) string {
	folder := workspace.Folder{Id: newID(), Name: cleanName(name, untitledFolder), ParentId: parentID}
	c.Folders = append(c.Folders, folder)
	return folder.Id
}

func (c *collector) addRequest(request workspace.Request) {
	if len(c.Requests) >= maxRequests {
		c.full = true
		return
	}
	c.Requests = append(c.Requests, request)
}

func (c *collector) addEnvironment(name string, variables map[string]string) string {
	environment := workspace.Environment{Id: newID(), Name: cleanName(name, untitledEnvironment), Variables: objectJSON(variables)}
	c.Environments = append(c.Environments, environment)
	return environment.Id
}

func (c *collector) skip(format string, args ...any) {
	c.Skipped = append(c.Skipped, fmt.Sprintf(format, args...))
}

func (c *collector) flag(kind, name string) {
	if _, seen := c.flags[kind]; !seen {
		c.flagOrder = append(c.flagOrder, kind)
	}
	c.flags[kind] = append(c.flags[kind], name)
}

func (c *collector) flagUnique(kind, name string) {
	for _, existing := range c.flags[kind] {
		if existing == name {
			return
		}
	}
	c.flag(kind, name)
}

func (c *collector) read(name, format string, run func()) {
	requests, folders, environments := len(c.Requests), len(c.Folders), len(c.Environments)
	run()
	c.Sources = append(c.Sources, Source{
		Name:         name,
		Format:       format,
		Requests:     len(c.Requests) - requests,
		Folders:      len(c.Folders) - folders,
		Environments: len(c.Environments) - environments,
	})
}

func (c *collector) result() Result {
	result := c.Result
	result.Warnings = append([]string{}, c.Warnings...)
	for _, kind := range c.flagOrder {
		result.Warnings = append(result.Warnings, fmt.Sprintf(kind, listNames(c.flags[kind])))
	}
	if c.full {
		result.Warnings = append(result.Warnings, fmt.Sprintf(messageTooMany, maxRequests))
	}
	return result
}

func listNames(names []string) string {
	shown := names
	if len(shown) > shownNames {
		shown = shown[:shownNames]
	}
	quoted := make([]string, len(shown))
	for index, name := range shown {
		quoted[index] = `"` + name + `"`
	}
	text := strings.Join(quoted, ", ")
	if hidden := len(names) - len(shown); hidden > 0 {
		return fmt.Sprintf(messageAndMore, text, hidden)
	}
	return text
}
