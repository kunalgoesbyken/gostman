package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/krockxz/gostman/workspace"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	pickFolderTitle = "Choose a folder for the collection"
	emptyVariables  = "{}"
	foreignFolder   = "this folder already has files that are not a Gostman workspace; choose an empty folder or one that holds a workspace"
	occupiedFolder  = "this folder already has files; choose an empty folder to save the collection to"
	missingFolder   = "this folder no longer exists"
	noFolderChosen  = "choose a folder first"
	fallbackNotice  = "The folder %s could not be opened: %v. The collection saved on this computer is shown instead."
)

type WorkspaceStatus struct {
	Path       string              `json:"path"`
	Name       string              `json:"name"`
	Workspaces []WorkspaceEntry    `json:"workspaces"`
	Problems   []workspace.Problem `json:"problems"`
	Notice     string              `json:"notice"`
}

func trust(memory *workspaceMemory) {
	memory.Trusted = true
}

type folderStore struct {
	folder *workspace.Workspace
}

func toFileRequests(requests []Request) []workspace.Request {
	converted := make([]workspace.Request, len(requests))
	for i, request := range requests {
		converted[i] = workspace.Request(request)
	}
	return converted
}

func toFileFolders(folders []Folder) []workspace.Folder {
	converted := make([]workspace.Folder, len(folders))
	for i, folder := range folders {
		converted[i] = workspace.Folder{Id: folder.Id, Name: folder.Name, ParentId: folder.ParentId, SortOrder: folder.SortOrder, Variables: folder.Variables, Settings: folder.Settings}
	}
	return converted
}

func toFileEnvironments(environments []Environment) []workspace.Environment {
	converted := make([]workspace.Environment, len(environments))
	for i, environment := range environments {
		converted[i] = workspace.Environment(environment)
	}
	return converted
}

func toFileCollection(data SavedData) workspace.Collection {
	return workspace.Collection{
		Requests:     toFileRequests(data.Requests),
		Folders:      toFileFolders(data.Folders),
		Environments: toFileEnvironments(data.Environments),
		Variables:    data.CollectionVariables,
		Settings:     data.CollectionSettings,
	}
}

func fromFileRequests(loaded []workspace.Request, memory workspaceMemory) []Request {
	requests := make([]Request, len(loaded))
	for i, request := range loaded {
		requests[i] = memory.withTokens(Request(request))
	}
	return requests
}

func fromFileFolders(loaded []workspace.Folder, memory workspaceMemory) []Folder {
	folders := make([]Folder, len(loaded))
	for i, folder := range loaded {
		folders[i] = Folder{Id: folder.Id, Name: folder.Name, ParentId: folder.ParentId, SortOrder: folder.SortOrder, Variables: folder.Variables, Settings: folder.Settings, IsOpen: !memory.isCollapsed(folder.Id)}
	}
	return folders
}

func fromFileEnvironments(loaded []workspace.Environment) []Environment {
	environments := make([]Environment, len(loaded))
	for i, environment := range loaded {
		environments[i] = Environment(environment)
	}
	return environments
}

func (s folderStore) collection(data SavedData) (SavedData, error) {
	memory, err := recallWorkspace(s.folder.Root())
	if err != nil {
		return data, err
	}
	loaded := s.folder.Collection()
	data.Variables = ""
	data.Requests = fromFileRequests(loaded.Requests, memory)
	data.Folders = fromFileFolders(loaded.Folders, memory)
	data.Environments = fromFileEnvironments(loaded.Environments)
	data.ActiveEnvironmentId = memory.ActiveEnvironmentId
	data.CollectionVariables = loaded.Variables
	data.CollectionSettings = loaded.Settings
	data.DotEnv = s.folder.DotEnv()
	data.Restricted = !memory.Trusted
	return data, nil
}

func (s folderStore) remember(update func(memory *workspaceMemory)) error {
	return mutateWorkspaceState(func(state *workspaceState) {
		memory := state.memoryOf(s.folder.Root())
		update(&memory)
		state.Folders[s.folder.Root()] = memory
	})
}

func (s folderStore) saveRequests(requests []Request) error {
	if err := s.remember(func(memory *workspaceMemory) { memory.keepTokens(requests) }); err != nil {
		return err
	}
	return s.folder.SaveRequests(toFileRequests(requests))
}

func (s folderStore) deleteRequest(id string) error {
	if err := s.remember(func(memory *workspaceMemory) { delete(memory.Tokens, id) }); err != nil {
		return err
	}
	return s.folder.DeleteRequest(id)
}

func (s folderStore) saveFolders(folders []Folder) error {
	if err := s.remember(func(memory *workspaceMemory) { memory.keepCollapsed(folders) }); err != nil {
		return err
	}
	return s.folder.SaveFolders(toFileFolders(folders))
}

func isUntouchedDefault(environments []Environment) bool {
	return len(environments) == 1 && environments[0].Name == defaultEnvironmentName && environments[0].Variables == emptyVariables
}

func (s folderStore) saveEnvironments(environments []Environment, activeId string) error {
	if err := s.remember(func(memory *workspaceMemory) { memory.ActiveEnvironmentId = activeId }); err != nil {
		return err
	}
	if isUntouchedDefault(environments) && len(s.folder.Collection().Environments) == 0 {
		return nil
	}
	return s.folder.SaveEnvironments(toFileEnvironments(environments))
}

func (s folderStore) saveVariables(text string) error {
	return s.folder.SaveVariables(text)
}

func (s folderStore) saveSettings(settings workspace.Settings) error {
	return s.folder.SaveSettings(settings)
}

func openFolder() *workspace.Workspace {
	if store, isFolder := storage.current().(folderStore); isFolder {
		return store.folder
	}
	return nil
}

func currentStatus() (WorkspaceStatus, error) {
	state, err := readWorkspaceState()
	if err != nil {
		return WorkspaceStatus{}, err
	}
	status := WorkspaceStatus{Workspaces: workspaceEntries(state), Problems: []workspace.Problem{}, Notice: storage.takeNotice()}
	if folder := openFolder(); folder != nil {
		status.Path, status.Name, status.Problems = folder.Root(), state.displayName(folder.Root()), folder.Problems()
	}
	return status, nil
}

func activate(folder *workspace.Workspace) (WorkspaceStatus, error) {
	if err := mutateWorkspaceState(func(state *workspaceState) { state.open(folder.Root()) }); err != nil {
		return WorkspaceStatus{}, err
	}
	storage.use(folderStore{folder: folder})
	return currentStatus()
}

func chosenFolder(path string) (string, error) {
	if strings.TrimSpace(path) == "" {
		return "", errors.New(noFolderChosen)
	}
	return filepath.Abs(path)
}

func createTrusted(path string) (*workspace.Workspace, error) {
	folder, err := workspace.Create(path, workspace.Collection{})
	if err != nil {
		return nil, err
	}
	return folder, folderStore{folder: folder}.remember(trust)
}

func openOrCreate(path string) (*workspace.Workspace, error) {
	state, err := workspace.Inspect(path)
	if err != nil {
		return nil, err
	}
	switch state {
	case workspace.Existing:
		return workspace.Open(path)
	case workspace.Empty:
		return createTrusted(path)
	case workspace.Missing:
		return nil, errors.New(missingFolder)
	}
	return nil, errors.New(foreignFolder)
}

func reopen(path string) (*workspace.Workspace, error) {
	state, err := workspace.Inspect(path)
	if err == nil && state == workspace.Missing {
		return nil, errors.New(missingFolder)
	}
	return workspace.Open(path)
}

func restoreWorkspace() {
	state, err := readWorkspaceState()
	if err != nil || state.Current == "" {
		return
	}
	folder, err := reopen(state.Current)
	if err == nil {
		storage.use(folderStore{folder: folder})
		return
	}
	storage.announce(fmt.Sprintf(fallbackNotice, state.Current, err))
	mutateWorkspaceState(func(state *workspaceState) { state.Current = "" })
}

func forgetWorkspaces() error {
	storage.use(appDataStore{})
	return clearWorkspaceState()
}

func (a *App) WorkspaceStatus() (WorkspaceStatus, error) {
	return currentStatus()
}

func (a *App) PickWorkspaceFolder() (string, error) {
	return wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{Title: pickFolderTitle, CanCreateDirectories: true})
}

func (a *App) OpenWorkspace(path string) (WorkspaceStatus, error) {
	chosen, err := chosenFolder(path)
	if err != nil {
		return WorkspaceStatus{}, err
	}
	folder, err := openOrCreate(chosen)
	if err != nil {
		return WorkspaceStatus{}, err
	}
	return activate(folder)
}

func (a *App) SaveCollectionToFolder(path string) (WorkspaceStatus, error) {
	chosen, err := chosenFolder(path)
	if err != nil {
		return WorkspaceStatus{}, err
	}
	data, err := a.LoadData()
	if err != nil {
		return WorkspaceStatus{}, err
	}
	stripped, secrets := splitSecrets(data.Environments)
	data.Environments = stripped
	folder, err := workspace.Create(chosen, toFileCollection(data))
	if errors.Is(err, workspace.ErrNotEmpty) {
		return WorkspaceStatus{}, errors.New(occupiedFolder)
	}
	if err != nil {
		return WorkspaceStatus{}, err
	}
	if err := vault.keep(folder.Root(), secrets); err != nil {
		return WorkspaceStatus{}, err
	}
	store := folderStore{folder: folder}
	err = store.remember(func(memory *workspaceMemory) {
		trust(memory)
		memory.ActiveEnvironmentId = data.ActiveEnvironmentId
		memory.keepTokens(data.Requests)
		memory.keepCollapsed(data.Folders)
	})
	if err != nil {
		return WorkspaceStatus{}, err
	}
	return activate(folder)
}

func (a *App) TrustWorkspace() error {
	store, isFolder := storage.current().(folderStore)
	if !isFolder {
		return nil
	}
	return store.remember(trust)
}

func (a *App) CloseWorkspace() (WorkspaceStatus, error) {
	if err := mutateWorkspaceState(func(state *workspaceState) { state.Current = "" }); err != nil {
		return WorkspaceStatus{}, err
	}
	storage.use(appDataStore{})
	return currentStatus()
}

func (a *App) ReloadWorkspace() (WorkspaceStatus, error) {
	if folder := openFolder(); folder != nil {
		if err := folder.Reload(); err != nil {
			return WorkspaceStatus{}, err
		}
	}
	return currentStatus()
}
