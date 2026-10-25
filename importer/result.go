package importer

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"unicode"

	"github.com/kunalgoesbyken/gostman/locales"
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
	Collections  int    `json:"collections"`
	Requests     int    `json:"requests"`
	Folders      int    `json:"folders"`
	Environments int    `json:"environments"`
	Globals      int    `json:"globals"`
}

type Result struct {
	Sources       []Source                `json:"sources"`
	Requests      []workspace.Request     `json:"requests"`
	Folders       []workspace.Folder      `json:"folders"`
	Environments  []workspace.Environment `json:"environments"`
	Globals       []workspace.Environment `json:"globals,omitempty"`
	Variables     map[string]string       `json:"variables"`
	VariablesMeta string                  `json:"variablesMeta,omitempty"`
	Settings      *workspace.Settings     `json:"settings,omitempty"`
	Warnings      []string                `json:"warnings"`
	Notes         []string                `json:"notes,omitempty"`
	Remarks       []Remark                `json:"remarks,omitempty"`
	Skipped       []string                `json:"skipped"`
	SkippedSaid   []locales.Message       `json:"skippedLocalized,omitempty"`
	SharedOrder   bool                    `json:"sharedOrder"`
	Flows         []workspace.Flow        `json:"flows,omitempty"`
}

const (
	RemarkScripts = "scripts"
	RemarkOAuth   = "oauth"
	RemarkFiles   = "files"
	RemarkFlows   = "flows"
)

type Remark struct {
	Kind    string `json:"kind,omitempty"`
	Text    string `json:"text"`
	Warning bool   `json:"warning,omitempty"`

	Localized *locales.Message `json:"localized,omitempty"`
}

type collector struct {
	Result
	leading   []Remark
	remarks   []Remark
	flags     map[locales.Code][]string
	flagOrder []locales.Code
	full      bool
	inPlace   bool
	scripts   scriptTally

	visitedNodes map[*insomniaNode]bool
	scoped       map[string]scopedFolder
	protos       map[string]string
	places       map[string]int64

	postmanRoots        []string
	postmanEnvironments map[string]bool
}

var importOnlyNotes = map[locales.Code]bool{locales.ImporterScripts: true, locales.ImporterBrunoSecrets: true}

var flagKinds = map[locales.Code]string{
	locales.ImporterScripts:         RemarkScripts,
	locales.ImporterForeignCalls:    RemarkScripts,
	locales.ImporterHttpHandlerFile: RemarkScripts,
	locales.ImporterOauth:           RemarkOAuth,
	locales.ImporterOauthAudience:   RemarkOAuth,
}

func newCollector() *collector {
	return &collector{Result: Result{Variables: map[string]string{}}, flags: map[locales.Code][]string{}, visitedNodes: map[*insomniaNode]bool{}, scoped: map[string]scopedFolder{}, places: map[string]int64{}}
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

func (c *collector) nextPlace(parentID string) int64 {
	c.places[parentID]++
	return c.places[parentID]
}

func (c *collector) addFolder(name, parentID string) string {
	folder := workspace.Folder{Id: newID(), Name: cleanName(name, untitledFolder), ParentId: parentID, SortOrder: c.nextPlace(parentID)}
	c.Folders = append(c.Folders, folder)
	return folder.Id
}

func (c *collector) addRequest(request workspace.Request) {
	request.SortOrder = c.nextPlace(request.FolderId)
	c.keepRequest(request)
}

func (c *collector) keepRequest(request workspace.Request) {
	if len(c.Requests) >= maxRequests {
		c.full = true
		return
	}
	c.Requests = append(c.Requests, request)
}

func (c *collector) skip(code locales.Code, params locales.Params) {
	said := locales.New(code, params)
	c.Skipped = append(c.Skipped, said.String())
	c.SkippedSaid = append(c.SkippedSaid, said)
}

func (c *collector) flag(code locales.Code, name string) {
	if _, seen := c.flags[code]; !seen {
		c.flagOrder = append(c.flagOrder, code)
	}
	c.flags[code] = append(c.flags[code], name)
}

func (c *collector) flagUnique(code locales.Code, name string) {
	if !slices.Contains(c.flags[code], name) {
		c.flag(code, name)
	}
}

func (c *collector) warnDepth() {
	c.leadOnce(locales.New(locales.ImporterDepth, locales.Params{"count": maxFolderDepth}))
}

func (c *collector) read(name, format string, run func()) {
	requests, folders, environments, globals := len(c.Requests), len(c.Folders), len(c.Environments), len(c.Globals)
	run()
	collections := countCollections(c.Folders[folders:])
	c.Sources = append(c.Sources, Source{
		Name:         name,
		Format:       format,
		Collections:  collections,
		Requests:     len(c.Requests) - requests,
		Folders:      len(c.Folders) - folders - collections,
		Environments: len(c.Environments) - environments,
		Globals:      len(c.Globals) - globals,
	})
}

func appendUnique(items []string, item string) []string {
	if slices.Contains(items, item) {
		return items
	}
	return append(items, item)
}

func remarkOf(kind string, said locales.Message, warning bool) Remark {
	return Remark{Kind: kind, Text: said.String(), Warning: warning, Localized: &said}
}

func (c *collector) warn(kind string, said locales.Message) {
	c.remarks = append(c.remarks, remarkOf(kind, said, true))
}

func (c *collector) warnOnce(kind string, said locales.Message) {
	if !slices.ContainsFunc(c.remarks, func(remark Remark) bool { return remark.Text == said.String() }) {
		c.warn(kind, said)
	}
}

func (c *collector) note(kind string, said locales.Message) {
	c.remarks = append(c.remarks, remarkOf(kind, said, false))
}

func (c *collector) lead(said locales.Message) {
	c.leading = append(c.leading, remarkOf("", said, true))
}

func (c *collector) leadOnce(said locales.Message) {
	if !slices.ContainsFunc(c.leading, func(remark Remark) bool { return remark.Text == said.String() }) {
		c.lead(said)
	}
}

func (c *collector) leadText(texts []string) {
	c.leading = append(c.leading, plainRemarks(texts, true)...)
}

func (c *collector) result() Result {
	result := c.Result
	result.SharedOrder = true
	remarks := append(slices.Clone(c.leading), c.remarks...)
	for _, code := range c.flagOrder {
		if c.inPlace && importOnlyNotes[code] {
			continue
		}
		names := c.flags[code]
		remarks = append(remarks, remarkOf(flagKinds[code], locales.New(code, locales.Params{"names": listNames(names), "count": len(names)}), true))
	}
	if c.full {
		remarks = append(remarks, remarkOf("", locales.New(locales.ImporterTooMany, locales.Params{"count": maxRequests}), true))
	}
	result.Remarks = append(remarks, plainRemarks(c.Notes, false)...)
	result.Warnings, result.Notes = remarkTexts(result.Remarks, true), remarkTexts(result.Remarks, false)
	return result
}

func plainRemarks(texts []string, warning bool) []Remark {
	remarks := make([]Remark, len(texts))
	for index, text := range texts {
		remarks[index] = Remark{Text: text, Warning: warning}
	}
	return remarks
}

func remarkTexts(remarks []Remark, warning bool) []string {
	texts := []string{}
	for _, remark := range remarks {
		if remark.Warning == warning {
			texts = append(texts, remark.Text)
		}
	}
	return texts
}

func flagged(code locales.Code, names []string) locales.Message {
	params := locales.Params{"names": listNames(names), "count": len(names)}
	if code == locales.ImporterHttpProcessEnv {
		params["example"] = "{{process.env.NAME}}"
	}
	return locales.New(code, params)
}

func listNames(names []string) any {
	shown := names
	if len(shown) > shownNames {
		shown = shown[:shownNames]
	}
	listed := locales.Unit(quotedNames(shown))
	if hidden := len(names) - len(shown); hidden > 0 {
		return locales.New(locales.ImporterAndMore, locales.Params{"names": listed, "count": hidden})
	}
	return listed
}

func quotedNames(names []string) []string {
	quoted := make([]string, len(names))
	for index, name := range names {
		quoted[index] = `"` + name + `"`
	}
	return quoted
}
