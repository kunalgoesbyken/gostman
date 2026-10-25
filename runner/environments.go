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
	var own, shared, offered []Environment
	for _, environment := range c.Environments {
		isOwn, isShared := scope.chain[environment.FolderID], scope.isShared(environment)
		if isOwn {
			own = append(own, environment)
		}
		if isShared {
			shared = append(shared, environment)
		}
		if isOwn || folderID == "" || isShared {
			offered = append(offered, environment)
		}
	}
	if name == "" {
		return firstOf(own, shared), nil
	}
	if matches := scope.named(own, name); len(matches) > 0 {
		return single(matches, name)
	}
	matches := scope.named(offered, name)
	labels := slices.Compact(slices.Sorted(slices.Values(scope.labels(matches))))
	switch {
	case len(matches) > 0 && len(labels) == 1:
		return single(matches, name)
	case len(labels) > 1:
		return Environment{}, fmt.Errorf("several collections have an environment named %q; pass one of %s to --env, or choose a collection with --folder", name, strings.Join(labels, ", "))
	case len(offered) == 0:
		return Environment{}, fmt.Errorf("there is no environment named %q: the collection has no environments", name)
	}
	return Environment{}, fmt.Errorf("there is no environment named %q; the collection has %s", name, strings.Join(scope.labels(offered), ", "))
}

func single(matches []Environment, name string) (Environment, error) {
	if len(matches) == 1 {
		return matches[0], nil
	}
	ids := make([]string, 0, len(matches))
	for _, environment := range matches {
		ids = append(ids, environment.ID)
	}
	return Environment{}, fmt.Errorf("%d environments are named %q (ids %s), so --env cannot tell which one you mean; rename one of them", len(matches), name, strings.Join(ids, ", "))
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

func (c Collection) collectionsWithEnvironments() []string {
	lineageOf := c.lineages()
	var ids []string
	for _, environment := range c.Environments {
		if id := collectionOf(lineageOf(environment.FolderID)); id != "" && !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return ids
}

func (c Collection) sharedEnvironment(name string) Environment {
	scope := newEnvironmentScope(c.Folders, "")
	for _, environment := range c.Environments {
		if scope.isShared(environment) && (name == "" || environment.Name == name) {
			return environment
		}
	}
	return Environment{}
}

func (c Collection) environmentsFor(folderID, name string) (Environment, map[string]Environment, error) {
	collections := c.collectionsWithEnvironments()
	if folderID != "" || len(collections) == 0 {
		chosen, err := c.ChooseEnvironment(folderID, name)
		return chosen, nil, err
	}
	lineageOf := c.lineages()
	byCollection := make(map[string]Environment, len(collections))
	for _, id := range collections {
		chosen, err := c.ChooseEnvironment(id, name)
		if err != nil {
			return Environment{}, nil, fmt.Errorf("collection %q: %w; pass --folder to run one collection", lineageOf(id)[1].Name, err)
		}
		byCollection[id] = chosen
	}
	return c.sharedEnvironment(name), byCollection, nil
}

func firstOf(groups ...[]Environment) Environment {
	for _, group := range groups {
		if len(group) > 0 {
			return group[0]
		}
	}
	return Environment{}
}
