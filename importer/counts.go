package importer

import (
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	authNone    = "none"
	authInherit = "inherit"
)

var emptyRows = map[string]bool{"": true, "{}": true, "[]": true}

type Counts struct {
	Requests       int `json:"requests"`
	Folders        int `json:"folders"`
	Environments   int `json:"environments"`
	Globals        int `json:"globals"`
	Variables      int `json:"variables"`
	FolderSettings int `json:"folderSettings"`
}

func (r Result) Counts() Counts {
	counts := Counts{
		Requests:     len(r.Requests),
		Folders:      len(r.Folders),
		Environments: len(r.Environments),
		Globals:      len(r.Globals),
		Variables:    len(r.Variables),
	}
	for _, folder := range r.Folders {
		if CarriesSettings(folder.Settings) {
			counts.FolderSettings++
		}
	}
	return counts
}

func CarriesSettings(settings workspace.Settings) bool {
	switch {
	case strings.TrimSpace(settings.Description) != "":
		return true
	case !emptyRows[strings.TrimSpace(settings.Headers)]:
		return true
	case settings.Auth.Type != "" && settings.Auth.Type != authInherit:
		return true
	}
	return strings.TrimSpace(settings.PreScript+settings.PostScript+settings.Assertions) != ""
}
