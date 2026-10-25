package importer

import (
	"encoding/json"
	"fmt"

	"github.com/kunalgoesbyken/gostman/workspace"
)

type secretRef struct {
	Provider string `json:"provider"`
	Path     string `json:"path"`
	Field    string `json:"field,omitempty"`
	Version  string `json:"version,omitempty"`
}

type envVariable struct {
	name    string
	value   string
	enabled bool
	secret  bool
	ref     *secretRef
}

type variableFlags struct {
	Secret  bool       `json:"secret,omitempty"`
	Enabled *bool      `json:"enabled,omitempty"`
	Ref     *secretRef `json:"ref,omitempty"`
}

type environmentDraft struct {
	name      string
	color     string
	extends   string
	global    bool
	folder    string
	variables []envVariable
}

func (v envVariable) flags() variableFlags {
	flags := variableFlags{Secret: v.secret || v.ref != nil}
	if !v.enabled {
		disabled := false
		flags.Enabled = &disabled
	}
	return flags
}

func inFolder(drafts []environmentDraft, folderID string) []environmentDraft {
	for index := range drafts {
		drafts[index].folder = folderID
	}
	return drafts
}

func (c *collector) addDraftEnvironments(drafts []environmentDraft) {
	ids := make([]string, len(drafts))
	named := map[string]string{}
	for index, draft := range drafts {
		ids[index] = newID()
		named[draft.name] = ids[index]
	}
	var orphans []string
	for index, draft := range drafts {
		parent := ""
		if draft.extends != "" {
			parent = named[draft.extends]
		}
		if draft.extends != "" && parent == "" {
			orphans = append(orphans, fmt.Sprintf(messageEnvironmentExtends, draft.name, draft.extends))
		}
		c.addDraftEnvironment(draft, ids[index], parent)
	}
	c.Warnings = append(c.Warnings, orphans...)
}

func (c *collector) addDraftEnvironment(draft environmentDraft, id, parent string) {
	values := map[string]string{}
	flags := map[string]variableFlags{}
	for _, variable := range draft.variables {
		if variable.name == "" {
			continue
		}
		values[variable.name] = variable.value
		if entry := variable.flags(); entry != (variableFlags{}) {
			flags[variable.name] = entry
		}
	}
	environment := workspace.Environment{Id: id, Name: cleanName(draft.name, untitledEnvironment), Variables: objectJSON(values), Meta: objectJSON(map[string]string{}), Color: draft.color, Extends: parent}
	if len(flags) > 0 {
		encoded, err := json.Marshal(flags)
		if err == nil {
			environment.Meta = string(encoded)
		}
	}
	c.noteReferences(environment.Name, draft.variables)
	if draft.global {
		c.Globals = append(c.Globals, environment)
		return
	}
	environment.FolderId = draft.folder
	c.Environments = append(c.Environments, environment)
}

func (c *collector) noteReferences(environment string, variables []envVariable) {
	byProvider := map[string][]string{}
	var providers []string
	for _, variable := range variables {
		if variable.ref == nil {
			continue
		}
		if _, seen := byProvider[variable.ref.Provider]; !seen {
			providers = append(providers, variable.ref.Provider)
		}
		byProvider[variable.ref.Provider] = append(byProvider[variable.ref.Provider], variable.name+" ("+variable.ref.place()+")")
	}
	for _, provider := range providers {
		c.Warnings = append(c.Warnings, fmt.Sprintf(messageExternalSecrets, environment, listNames(byProvider[provider]), provider))
	}
}
