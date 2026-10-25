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
	Collections        int `json:"collections"`
	Requests           int `json:"requests"`
	Folders            int `json:"folders"`
	Environments       int `json:"environments"`
	Globals            int `json:"globals"`
	Variables          int `json:"variables"`
	CollectionSettings int `json:"collectionSettings"`
	FolderSettings     int `json:"folderSettings"`
}

func (r Result) Counts() Counts {
	counts := Counts{
		Requests:     len(r.Requests),
		Environments: len(r.Environments),
		Globals:      len(r.Globals),
		Variables:    len(r.Variables),
	}
	top := topLevel(r.Folders)
	for _, folder := range r.Folders {
		owned, _ := workspace.ParseVariableEntries(folder.CollectionVariables)
		counts.Variables += len(owned)
		carries := oneIf(CarriesSettings(folder.Settings))
		if top[folder.Id] {
			counts.Collections++
			counts.CollectionSettings += carries
			continue
		}
		counts.Folders++
		counts.FolderSettings += carries
	}
	return counts
}

func oneIf(condition bool) int {
	if condition {
		return 1
	}
	return 0
}

func topLevel(folders []workspace.Folder) map[string]bool {
	known := map[string]bool{}
	for _, folder := range folders {
		known[folder.Id] = true
	}
	top := map[string]bool{}
	for _, folder := range folders {
		top[folder.Id] = !known[folder.ParentId]
	}
	return top
}

func countCollections(folders []workspace.Folder) int {
	count := 0
	for _, isTop := range topLevel(folders) {
		if isTop {
			count++
		}
	}
	return count
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
