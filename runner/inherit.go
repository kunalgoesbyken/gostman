package runner

import (
	"slices"

	"github.com/krockxz/gostman/engine"
)

const (
	collectionLabel = "collection"
	maxLineageDepth = 64
)

type step struct {
	label      string
	script     string
	assertions string
}

func (c Collection) root() Folder {
	return Folder{Name: collectionLabel, Settings: c.Settings}
}

func (c Collection) lineages() func(folderID string) []Folder {
	byID := make(map[string]Folder, len(c.Folders))
	for _, folder := range c.Folders {
		byID[folder.ID] = folder
	}
	return func(folderID string) []Folder {
		chain := []Folder{}
		visited := map[string]bool{}
		for id := folderID; id != "" && !visited[id] && len(chain) < maxLineageDepth; {
			folder, found := byID[id]
			if !found {
				break
			}
			visited[id] = true
			chain = append(chain, folder)
			id = folder.ParentID
		}
		slices.Reverse(chain)
		return append([]Folder{c.root()}, chain...)
	}
}

func (r Request) layers() []engine.Layer {
	layers := make([]engine.Layer, len(r.Lineage))
	for i, folder := range r.Lineage {
		layers[i] = engine.Layer{Headers: folder.Headers, Auth: folder.Auth}
	}
	return layers
}

func (r Request) folderScopes() []variables {
	scopes := make([]variables, 0, len(r.Lineage))
	for _, folder := range r.Lineage {
		scope, err := parseVariables(folder.Variables)
		if err == nil {
			scopes = append(scopes, scope)
		}
	}
	return scopes
}

func (f Folder) label(stage string) string {
	return stage + " (" + f.Name + ")"
}

func (r Request) preSteps() []step {
	var steps []step
	for _, folder := range r.Lineage {
		steps = appendScripted(steps, step{label: folder.label(preRequest), script: folder.PreScript})
	}
	return appendScripted(steps, step{label: preRequest, script: r.PreScript})
}

func (r Request) postSteps() []step {
	steps := appendScripted(nil, step{label: postResponse, script: r.PostScript, assertions: r.Assertions})
	for _, folder := range slices.Backward(r.Lineage) {
		steps = appendScripted(steps, step{label: folder.label(postResponse), script: folder.PostScript, assertions: folder.Assertions})
	}
	return steps
}

func appendScripted(steps []step, candidate step) []step {
	if hasText(candidate.script) || hasText(candidate.assertions) {
		return append(steps, candidate)
	}
	return steps
}
