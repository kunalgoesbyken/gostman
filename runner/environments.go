package runner

import (
	"fmt"
	"slices"
	"strings"
)

type environmentScope struct {
	folders map[string]Folder
	chain   map[string]bool
}

func newEnvironmentScope(folders []Folder, folderID string) environmentScope {
	byID := make(map[string]Folder, len(folders))
	for _, folder := range folders {
		byID[folder.ID] = folder
	}
	chain := map[string]bool{}
	for id := folderID; !chain[id]; id = byID[id].ParentID {
		if _, known := byID[id]; !known {
			break
		}
		chain[id] = true
	}
	return environmentScope{folders: byID, chain: chain}
}

func (s environmentScope) isShared(environment Environment) bool {
	_, known := s.folders[environment.FolderID]
	return environment.FolderID == "" || !known
}

func (s environmentScope) label(environment Environment) string {
	if s.isShared(environment) {
		return environment.Name
	}
	return s.folders[environment.FolderID].Name + pathSeparator + environment.Name
}

func (s environmentScope) labels(environments []Environment) []string {
	labels := make([]string, 0, len(environments))
	for _, environment := range environments {
		labels = append(labels, s.label(environment))
	}
	return labels
}

func (s environmentScope) named(environments []Environment, name string) []Environment {
	var labelled, plain []Environment
	for _, environment := range environments {
		if s.label(environment) == name {
			labelled = append(labelled, environment)
		}
		if environment.Name == name {
			plain = append(plain, environment)
		}
	}
	if len(labelled) > 0 {
		return labelled
	}
	return plain
}

func (c Collection) ChooseEnvironment(folderID, name string) (Environment, error) {
	scope := newEnvironmentScope(c.Folders, folderID)
	var own, offered []Environment
	for _, environment := range c.Environments {
		isOwn := scope.chain[environment.FolderID]
		if isOwn {
			own = append(own, environment)
		}
		if isOwn || folderID == "" || scope.isShared(environment) {
			offered = append(offered, environment)
		}
	}
	if name == "" {
		return firstOf(own, offered), nil
	}
	if matches := scope.named(own, name); len(matches) == 1 {
		return matches[0], nil
	}
	matches := scope.named(offered, name)
	labels := slices.Compact(slices.Sorted(slices.Values(scope.labels(matches))))
	switch {
	case len(matches) > 0 && len(labels) == 1:
		return matches[0], nil
	case len(labels) > 1:
		return Environment{}, fmt.Errorf("several collections have an environment named %q; pass one of %s to --env, or choose a collection with --folder", name, strings.Join(labels, ", "))
	case len(offered) == 0:
		return Environment{}, fmt.Errorf("there is no environment named %q: the collection has no environments", name)
	}
	return Environment{}, fmt.Errorf("there is no environment named %q; the collection has %s", name, strings.Join(scope.labels(offered), ", "))
}

func (s *Session) folderID(folders []Folder, wanted string) (string, error) {
	if strings.Trim(wanted, pathSeparator) == "" {
		return "", nil
	}
	var paths []folderPath
	if err := s.state.scripts.Call("folderPaths", &paths, append([]Folder{}, folders...)); err != nil {
		return "", err
	}
	return chooseFolder(paths, wanted)
}

func (s *Session) collectionLayers(stored Collection, folder string) ([]variables, error) {
	folderID, err := s.folderID(stored.Folders, folder)
	if err != nil || folderID == "" {
		return nil, err
	}
	return Request{Lineage: stored.lineages()(folderID)}.collectionScopes(), nil
}

func firstOf(groups ...[]Environment) Environment {
	for _, group := range groups {
		if len(group) > 0 {
			return group[0]
		}
	}
	return Environment{}
}
