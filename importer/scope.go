package importer

import (
	"encoding/json"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

type scope struct {
	headers     []row
	vars        []row
	collection  []row
	secrets     []string
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
	if parentID == "" {
		folder.CollectionVariables = collectionVariables(settings.collection)
		folder.CollectionVariablesMeta = workspace.MarkSecret("", settings.secrets...)
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
			c.markSecret(settings.secrets, variable.Key)
		}
	}
	settings.collection = settings.vars
	settings.vars = nil
	return settings
}

func (c *collector) markSecret(secrets []string, name string) {
	if slices.Contains(secrets, name) {
		c.VariablesMeta = workspace.MarkSecret(c.VariablesMeta, name)
	}
}

func (c *collector) ownCollectionVariables(folderID string, values map[string]string) {
	for index := range c.Folders {
		if c.Folders[index].Id != folderID {
			continue
		}
		owned := map[string]string{}
		_ = json.Unmarshal([]byte(c.Folders[index].CollectionVariables), &owned)
		for name, value := range values {
			if _, taken := owned[name]; !taken {
				owned[name] = value
			}
		}
		c.Folders[index].CollectionVariables = objectJSON(owned)
	}
}

func (c *collector) addCollectionVariables(folderID string, variables []envVariable) {
	values := map[string]string{}
	marks, shared := map[string]variableFlags{}, map[string]variableFlags{}
	for _, variable := range variables {
		if variable.name == "" {
			continue
		}
		values[variable.name] = variable.value
		flags := variable.flags()
		if flags != (variableFlags{}) {
			marks[variable.name] = flags
		}
		if _, taken := c.Variables[variable.name]; !taken {
			c.Variables[variable.name] = variable.value
			shared[variable.name] = flags
		}
	}
	c.keepMarks(marksText(shared))
	for index := range c.Folders {
		if c.Folders[index].Id == folderID {
			c.Folders[index].CollectionVariables = objectJSON(values)
			c.Folders[index].CollectionVariablesMeta = marksText(marks)
		}
	}
}

func marksText(marks map[string]variableFlags) string {
	if len(marks) == 0 {
		return ""
	}
	encoded, _ := json.Marshal(marks)
	return string(encoded)
}

func collectionVariables(rows []row) string {
	if text := enabledVariables(rows); text != "" {
		return text
	}
	return "{}"
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

var foreignRoots = setOf(postmanRoot, brunoRoot, insomniaRoot)

func callsForeignAPI(script string) bool {
	read, ok := readScript(script)
	return ok && read.reaches(func(path chain) bool {
		_, native := brunoDialect.nativePath(path)
		return foreignRoots[path.root] && !native
	})
}

func isIdentifierByte(b byte) bool {
	return b == '_' || b == '$' || b >= '0' && b <= '9' || b >= 'a' && b <= 'z' || b >= 'A' && b <= 'Z' || b >= 0x80
}
