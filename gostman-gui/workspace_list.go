package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
)

const (
	unknownWorkspace = "this folder is not in the list of workspaces"
	currentWorkspace = "close the workspace before removing it from the list"
)

type WorkspaceEntry struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Pinned  bool   `json:"pinned"`
	Current bool   `json:"current"`
	Missing bool   `json:"missing"`
}

func (s *workspaceState) isPinned(path string) bool {
	return slices.Contains(s.Pinned, path)
}

func (s *workspaceState) isKnown(path string) bool {
	return slices.Contains(s.Recent, path)
}

func defaultName(path string) string {
	name, parent := filepath.Base(path), filepath.Base(filepath.Dir(path))
	if strings.EqualFold(name, nestedWorkspace) && parent != "." && !strings.ContainsAny(parent, `\/`) {
		return parent
	}
	return name
}

func (s *workspaceState) displayName(path string) string {
	if name := strings.TrimSpace(s.Names[path]); name != "" {
		return name
	}
	return defaultName(path)
}

func (s *workspaceState) pin(path string, pinned bool) {
	s.Pinned = slices.DeleteFunc(s.Pinned, func(known string) bool { return known == path })
	if pinned {
		s.Pinned = append(s.Pinned, path)
	}
}

func (s *workspaceState) rename(path string, name string) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" || trimmed == defaultName(path) {
		delete(s.Names, path)
		return
	}
	if s.Names == nil {
		s.Names = map[string]string{}
	}
	s.Names[path] = trimmed
}

func (s *workspaceState) forget(path string) {
	s.Recent = slices.DeleteFunc(s.Recent, func(known string) bool { return known == path })
	s.Pinned = slices.DeleteFunc(s.Pinned, func(known string) bool { return known == path })
	delete(s.Names, path)
	delete(s.Folders, path)
}

func (s *workspaceState) ordered() []string {
	paths := []string{}
	for _, path := range s.Pinned {
		if s.isKnown(path) {
			paths = append(paths, path)
		}
	}
	for _, path := range s.Recent {
		if !s.isPinned(path) {
			paths = append(paths, path)
		}
	}
	return paths
}

func folderExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

func workspaceEntries(state workspaceState) []WorkspaceEntry {
	entries := []WorkspaceEntry{}
	for _, path := range state.ordered() {
		entries = append(entries, WorkspaceEntry{
			Path:    path,
			Name:    state.displayName(path),
			Pinned:  state.isPinned(path),
			Current: path == state.Current,
			Missing: !folderExists(path),
		})
	}
	return entries
}

func changeKnownWorkspace(path string, change func(state *workspaceState)) error {
	known := false
	err := mutateWorkspaceState(func(state *workspaceState) {
		if known = state.isKnown(path); known {
			change(state)
		}
	})
	if err != nil {
		return err
	}
	if !known {
		return errors.New(unknownWorkspace)
	}
	return nil
}

func revealCommand(path string) *exec.Cmd {
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer", filepath.Clean(path))
	case "darwin":
		return exec.Command("open", path)
	}
	return exec.Command("xdg-open", path)
}

func revealFolder(path string) error {
	return revealFolder(path)
}

func (a *App) PinWorkspace(path string, pinned bool) (WorkspaceStatus, error) {
	if err := changeKnownWorkspace(path, func(state *workspaceState) { state.pin(path, pinned) }); err != nil {
		return WorkspaceStatus{}, err
	}
	return currentStatus()
}

func (a *App) RenameWorkspace(path string, name string) (WorkspaceStatus, error) {
	if err := changeKnownWorkspace(path, func(state *workspaceState) { state.rename(path, name) }); err != nil {
		return WorkspaceStatus{}, err
	}
	return currentStatus()
}

func (a *App) ForgetWorkspace(path string) (WorkspaceStatus, error) {
	state, err := readWorkspaceState()
	if err != nil {
		return WorkspaceStatus{}, err
	}
	if state.Current == path {
		return WorkspaceStatus{}, errors.New(currentWorkspace)
	}
	if err := changeKnownWorkspace(path, func(state *workspaceState) { state.forget(path) }); err != nil {
		return WorkspaceStatus{}, err
	}
	return currentStatus()
}

func (a *App) RevealWorkspace(path string) error {
	state, err := readWorkspaceState()
	if err != nil {
		return err
	}
	if !state.isKnown(path) {
		return errors.New(unknownWorkspace)
	}
	if !folderExists(path) {
		return errors.New(missingFolder)
	}
	return revealFolder(path)
}
