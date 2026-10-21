package main

import "github.com/krockxz/gostman/workspace"

func (a *App) ScriptModules() (map[string]string, error) {
	store, isFolder := storage.current().(folderStore)
	if !isFolder {
		return map[string]string{}, nil
	}
	memory, err := recallWorkspace(store.folder.Root())
	if err != nil {
		return nil, err
	}
	if !memory.Trusted {
		return map[string]string{}, nil
	}
	return workspace.ReadScriptModules(store.folder.Root())
}
