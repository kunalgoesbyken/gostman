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
	Requests     []json.RawMessage `json:"requests"`
	Folders      []json.RawMessage `json:"folders"`
	Environments []json.RawMessage `json:"environments"`
	Variables    map[string]any    `json:"variables"`
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
	c.read(name, FormatGostman, func() { c.importGostman(parsed.Gostman) })
}

func (c *collector) importGostman(backup *gostmanBackup) {
	folders := idMap{}
	c.gostmanFolders(backup.Folders, folders)
	c.gostmanRequests(backup.Requests, folders)
	c.gostmanEnvironments(backup.Environments)
	for key, value := range backup.Variables {
		c.Variables[key] = text(value)
	}
}

func withoutTokens(auth engine.Auth) engine.Auth {
	auth.OAuth2.AccessToken, auth.OAuth2.RefreshToken, auth.OAuth2.ExpiresAt = "", "", 0
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
		c.addRequest(request)
	}
}

func (c *collector) gostmanEnvironments(raw []json.RawMessage) {
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
		c.Environments = append(c.Environments, environment)
	}
}
