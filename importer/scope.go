package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

type scope struct {
	headers     []row
	vars        []row
	auth        *engine.Auth
	pre         string
	post        string
	description string
}

type scopedFolder struct {
	parent string
	auth   *engine.Auth
}

func (c *collector) addScopedFolder(name, parentID string, settings scope) string {
	id := c.addFolder(name, parentID)
	folder := &c.Folders[len(c.Folders)-1]
	folder.Description = settings.description
	folder.Headers = jsonList(settings.headers)
	folder.Variables = enabledVariables(settings.vars)
	folder.PreScript = joinScripts([]string{settings.pre})
	folder.PostScript = joinScripts([]string{settings.post})
	if settings.auth != nil {
		folder.Auth = folderAuth(*settings.auth)
	}
	c.scoped[id] = scopedFolder{parent: parentID, auth: settings.auth}
	c.flagScripts(folder.Name, folder.PreScript, folder.PostScript)
	if folder.Auth.Type == authOAuth2 {
		c.flag(messageOAuth, folder.Name)
	}
	return id
}

func folderAuth(auth engine.Auth) engine.Auth {
	if auth.Type == "" {
		return engine.Auth{Type: authNone}
	}
	return auth
}

func (c *collector) collectionScope(settings scope) scope {
	for _, variable := range settings.vars {
		if _, taken := c.Variables[variable.Key]; variable.Enabled && !taken {
			c.Variables[variable.Key] = variable.Value
		}
	}
	settings.vars = nil
	return settings
}

func enabledVariables(rows []row) string {
	values := map[string]string{}
	for _, candidate := range rows {
		if candidate.Enabled {
			values[candidate.Key] = candidate.Value
		}
	}
	if len(values) == 0 {
		return ""
	}
	return objectJSON(values)
}

func (c *collector) requestAuth(own *engine.Auth, folderID string) engine.Auth {
	switch {
	case own != nil:
		return *own
	case c.inheritsAuth(folderID):
		return engine.Auth{Type: engine.AuthInherit}
	}
	return engine.Auth{}
}

func (c *collector) inheritsAuth(folderID string) bool {
	for depth := 0; depth <= maxFolderDepth; depth++ {
		folder, scoped := c.scoped[folderID]
		switch {
		case !scoped:
			return false
		case folder.auth != nil:
			return true
		}
		folderID = folder.parent
	}
	return false
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
		if (at == 0 || !isIdentifierByte(script[at-1])) && !startsNative(script[at:]) {
			return true
		}
		offset = at + len(api)
	}
	return false
}

func startsNative(text string) bool {
	for prefix := range brunoDialect.native {
		rest, found := strings.CutPrefix(text, prefix)
		if found && (rest == "" || !isIdentifierByte(rest[0])) {
			return true
		}
	}
	return false
}

func isIdentifierByte(b byte) bool {
	return b == '_' || b == '$' || b >= '0' && b <= '9' || b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= 0x80
}
