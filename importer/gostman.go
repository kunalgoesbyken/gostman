package importer

import (
	"encoding/json"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type gostmanExportFile struct {
	Gostman *gostmanBackup `json:"gostman"`
}

type gostmanBackup struct {
	Requests      []json.RawMessage `json:"requests"`
	Folders       []json.RawMessage `json:"folders"`
	Environments  []json.RawMessage `json:"environments"`
	Variables     json.RawMessage   `json:"variables"`
	VariablesMeta string            `json:"variablesMeta"`
	Settings      json.RawMessage   `json:"settings"`
	SharedOrder   bool              `json:"sharedOrder"`
}

type idMap map[string]string

func (m idMap) fresh(old string) string {
	id := newID()
	if old != "" {
		m[old] = id
	}
	return id
}

func (m idMap) resolve(old string) string {
	return m[old]
}

func (c *collector) readGostman(doc document) {
	name := cleanName(strings.TrimSuffix(doc.file.Name, ".json"), "Gostman")
	var parsed gostmanExportFile
	if err := json.Unmarshal([]byte(doc.file.Text), &parsed); err != nil || parsed.Gostman == nil {
		c.skip(messageGostmanInvalid, doc.file.Name)
		return
	}
	c.read(name, FormatGostman, func() { c.importGostman(parsed.Gostman, name) })
}

func (c *collector) importGostman(backup *gostmanBackup, name string) {
	folders := idMap{}
	firstFolder, firstRequest := len(c.Folders), len(c.Requests)
	c.gostmanFolders(backup.Folders, folders)
	c.gostmanRequests(backup.Requests, folders)
	if !backup.SharedOrder {
		workspace.ShareOrder(c.Folders[firstFolder:], c.Requests[firstRequest:])
	}
	c.gostmanEnvironments(backup.Environments, folders)
	c.gostmanSettings(backup.Settings, name)
	for key, value := range exportedVariables(backup.Variables) {
		c.Variables[key] = text(value)
	}
	c.keepMarks(c.withoutReferences(name, backup.VariablesMeta))
}

func (c *collector) gostmanSettings(raw json.RawMessage, name string) {
	var settings workspace.Settings
	if c.Settings != nil || len(raw) == 0 || string(raw) == "null" {
		return
	}
	if err := json.Unmarshal(raw, &settings); err != nil {
		c.skip(messageGostmanItem, "settings")
		return
	}
	settings.Auth = withoutTokens(settings.Auth)
	c.flagScripts(name, settings.PreScript, settings.PostScript)
	if settings.Auth.Type == authOAuth2 {
		c.flag(messageOAuth, name)
	}
	c.Settings = &settings
}

func (c *collector) withoutReferences(owner, meta string) string {
	var marks map[string]variableFlags
	if strings.TrimSpace(meta) == "" || json.Unmarshal([]byte(meta), &marks) != nil {
		return ""
	}
	kept := map[string]variableFlags{}
	for _, name := range sortedKeys(marks) {
		if marks[name].Ref != nil {
			c.flag(messageReferencesDropped, owner+"/"+name)
		}
		if mark := plainMark(marks[name]); mark != (variableFlags{}) {
			kept[name] = mark
		}
	}
	return marksText(kept)
}

func plainMark(flags variableFlags) variableFlags {
	kept := variableFlags{Secret: flags.Secret}
	if switchedOff(flags) {
		kept.Enabled = flags.Enabled
	}
	return kept
}

func (c *collector) keepMarks(meta string) {
	var incoming, current map[string]variableFlags
	if json.Unmarshal([]byte(meta), &incoming) != nil || len(incoming) == 0 {
		return
	}
	if json.Unmarshal([]byte(c.VariablesMeta), &current) != nil || current == nil {
		current = map[string]variableFlags{}
	}
	for name, flags := range incoming {
		if kept := plainMark(flags); kept != (variableFlags{}) {
			current[name] = kept
		}
	}
	encoded, _ := json.Marshal(current)
	c.VariablesMeta = string(encoded)
}

func exportedVariables(raw json.RawMessage) map[string]any {
	var values map[string]any
	var encoded string
	if json.Unmarshal(raw, &encoded) == nil {
		raw = json.RawMessage(encoded)
	}
	_ = json.Unmarshal(raw, &values)
	return values
}

func withoutTokens(auth engine.Auth) engine.Auth {
	auth.OAuth2 = auth.OAuth2.WithoutTokens()
	return auth
}

func (c *collector) gostmanFolders(raw []json.RawMessage, ids idMap) {
	decoded := make([]workspace.Folder, 0, len(raw))
	for _, item := range raw {
		var folder workspace.Folder
		if err := json.Unmarshal(item, &folder); err != nil {
			c.skip(messageGostmanItem, "folder")
			continue
		}
		decoded = append(decoded, folder)
	}
	for index := range decoded {
		decoded[index].Id = ids.fresh(decoded[index].Id)
	}
	for _, folder := range decoded {
		folder.Name = cleanName(folder.Name, untitledFolder)
		folder.ParentId = ids.resolve(folder.ParentId)
		folder.Auth = withoutTokens(folder.Auth)
		folder.CollectionVariablesMeta = c.withoutReferences(folder.Name, folder.CollectionVariablesMeta)
		c.flagScripts(folder.Name, folder.PreScript, folder.PostScript)
		c.Folders = append(c.Folders, folder)
	}
}

func (c *collector) gostmanRequests(raw []json.RawMessage, folders idMap) {
	for _, item := range raw {
		var request workspace.Request
		if err := json.Unmarshal(item, &request); err != nil {
			c.skip(messageGostmanItem, "request")
			continue
		}
		request.Id = newID()
		request.Name = cleanName(request.Name, untitledRequest)
		request.Method = cleanMethod(request.Method)
		request.FolderId = folders.resolve(request.FolderId)
		request.Options.InsecureTLS = false
		request.Auth = withoutTokens(request.Auth)
		request.Timestamp = ""
		c.flagScripts(request.Name, request.PreScript, request.PostScript)
		if request.Auth.Type == authOAuth2 {
			c.flag(messageOAuth, request.Name)
		}
		c.keepRequest(request)
	}
}

func (c *collector) gostmanEnvironments(raw []json.RawMessage, folders idMap) {
	decoded := make([]workspace.Environment, 0, len(raw))
	for _, item := range raw {
		var environment workspace.Environment
		if err := json.Unmarshal(item, &environment); err != nil {
			c.skip(messageGostmanItem, "environment")
			continue
		}
		decoded = append(decoded, environment)
	}
	ids := idMap{}
	for index := range decoded {
		decoded[index].Id = ids.fresh(decoded[index].Id)
	}
	for _, environment := range decoded {
		environment.Name = cleanName(environment.Name, untitledEnvironment)
		environment.Extends = ids.resolve(environment.Extends)
		environment.FolderId = folders.resolve(environment.FolderId)
		environment.Meta = c.withoutReferences(environment.Name, environment.Meta)
		c.Environments = append(c.Environments, environment)
	}
}
