package runner

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/krockxz/gostman/workspace"
)

func isDirectory(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func loadWorkspace(root string) (Collection, error) {
	state, err := workspace.Inspect(root)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the workspace: %w", err)
	}
	if state != workspace.Existing {
		return Collection{}, fmt.Errorf("%s is not a Gostman workspace: it has no %s", root, workspace.ManifestName)
	}
	files, err := workspace.Open(root)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the workspace: %w", err)
	}
	collection, err := FromWorkspace(files.Collection())
	collection.DotEnv = files.DotEnv()
	collection.Modules = scriptModules(root)
	return collection, err
}

func FromWorkspace(stored workspace.Collection) (Collection, error) {
	encoded, err := json.Marshal(stored)
	if err != nil {
		return Collection{}, err
	}
	var collection Collection
	return collection, json.Unmarshal(encoded, &collection)
}

func scriptModules(root string) map[string]string {
	modules, err := workspace.ReadScriptModules(root)
	if err != nil {
		return nil
	}
	return modules
}
