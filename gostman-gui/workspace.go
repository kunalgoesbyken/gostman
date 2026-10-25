package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	pickFolderTitle = "Choose a folder for the collection"
	emptyVariables  = "{}"
	nestedWorkspace = "gostman"
	foreignFolder   = "this folder and its gostman folder already have files that are not a Gostman workspace; choose an empty folder or one that holds a workspace"
	occupiedFolder  = "this folder and its gostman folder already have files; choose an empty folder to save the collection to"
	nestedNotice    = "%s already holds other files, so the collection is kept in its %s folder."
	missingFolder   = "this folder no longer exists"
	noFolderChosen  = "choose a folder first"
	fallbackNotice  = "The folder %s could not be opened: %v. The collection saved on this computer is shown instead."
	untrustedFiles  = "this folder is not trusted yet, so its requests cannot read files; trust the folder first"

	renamedEnvironment = "The environment %q of %q is saved as %q, because a folder workspace keeps one list of environments and another one has the same name."
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
		converted[i] = workspace.Folder{Id: folder.Id, Name: folder.Name, ParentId: folder.ParentId, SortOrder: folder.SortOrder, Variables: folder.Variables, Color: folder.Color, Tags: folder.Tags, Settings: folder.Settings, CollectionVariables: folder.CollectionVariables, CollectionVariablesMeta: folder.CollectionVariablesMeta}
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
		Requests:      toFileRequests(data.Requests),
		Folders:       toFileFolders(data.Folders),
		Environments:  toFileEnvironments(data.Environments),
		Variables:     data.CollectionVariables,
		VariablesMeta: data.CollectionVariablesMeta,
		Settings:      data.CollectionSettings,
		SharedOrder:   data.SharedOrder,
		Flows:         data.Flows,
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
		folders[i] = Folder{Id: folder.Id, Name: folder.Name, ParentId: folder.ParentId, SortOrder: folder.SortOrder, Variables: folder.Variables, Color: folder.Color, Tags: folder.Tags, Settings: folder.Settings, CollectionVariables: folder.CollectionVariables, CollectionVariablesMeta: folder.CollectionVariablesMeta, IsOpen: !memory.isCollapsed(folder.Id)}
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
	data.CollectionVariablesMeta = loaded.VariablesMeta
	data.CollectionSettings = loaded.Settings
	data.SharedOrder = loaded.SharedOrder
	data.Flows = loaded.Flows
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
	return s.write(func() error { return s.folder.SaveRequests(toFileRequests(requests)) })
}

func (s folderStore) deleteRequests(ids []string) error {
	forget := func(memory *workspaceMemory) {
		for _, id := range ids {
			delete(memory.Tokens, id)
		}
	}
	if err := s.remember(forget); err != nil {
		return err
	}
	return s.write(func() error { return s.folder.DeleteRequests(ids) })
}

func (s folderStore) saveFolders(folders []Folder) error {
	if err := s.remember(func(memory *workspaceMemory) { memory.keepCollapsed(folders) }); err != nil {
		return err
	}
	return s.write(func() error { return s.folder.SaveFolders(toFileFolders(folders)) })
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
	return s.write(func() error { return s.folder.SaveEnvironments(toFileEnvironments(environments)) })
}

func (s folderStore) saveVariables(text, meta string) error {
	return s.write(func() error { return s.folder.SaveMarkedVariables(text, meta) })
}

func (s folderStore) saveSettings(settings workspace.Settings) error {
	return s.write(func() error { return s.folder.SaveSettings(settings) })
}

func (s folderStore) saveFlows(flows []workspace.Flow) error {
	return s.write(func() error { return s.folder.SaveFlows(flows) })
}

func (s folderStore) shareOrder() error {
	return s.write(s.folder.MarkSharedOrder)
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
	folder, err := workspace.Create(path, workspace.Collection{SharedOrder: true})
	if err != nil {
		return nil, err
	}
	return folder, folderStore{folder: folder}.remember(trust)
}

func placement(path string) (string, workspace.State, error) {
	state, err := workspace.Inspect(path)
	if err != nil || state != workspace.Foreign {
		return path, state, err
	}
	nested := filepath.Join(path, nestedWorkspace)
	state, err = workspace.Inspect(nested)
	return nested, state, err
}

func announcePlacement(path, target string) {
	if target != path {
		storage.announce(fmt.Sprintf(nestedNotice, filepath.Base(path), nestedWorkspace))
	}
}

func openOrCreateAt(path, target string, state workspace.State) (*workspace.Workspace, error) {
	switch {
	case state == workspace.Existing:
		return workspace.Open(target)
	case state == workspace.Empty, state == workspace.Missing && target != path:
		return createTrusted(target)
	case state == workspace.Missing:
		return nil, errors.New(missingFolder)
	}
	return nil, errors.New(foreignFolder)
}

func openOrCreate(path string) (*workspace.Workspace, error) {
	target, state, err := placement(path)
	if err != nil {
		return nil, err
	}
	folder, err := openOrCreateAt(path, target, state)
	if err == nil {
		announcePlacement(path, target)
	}
	return folder, err
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

func (a *App) PickWorkspaceFolder(title string) (string, error) {
	if strings.TrimSpace(title) == "" {
		title = pickFolderTitle
	}
	return wailsruntime.OpenDirectoryDialog(a.ctx, wailsruntime.OpenDialogOptions{Title: title, CanCreateDirectories: true})
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
	target, _, err := placement(chosen)
	if err != nil {
		return WorkspaceStatus{}, err
	}
	shared, renamed := sharedEnvironments(data.Environments, data.Folders)
	stripped, secrets := splitSecrets(shared)
	data.Environments = stripped
	_, sharedSecrets := splitSecrets(sharedVariablesList(data.CollectionVariables, data.CollectionVariablesMeta))
	_, folderSecrets := splitSecrets(folderVariableLists(data.Folders))
	folder, err := workspace.Create(target, toFileCollection(data))
	if errors.Is(err, workspace.ErrNotEmpty) {
		return WorkspaceStatus{}, errors.New(occupiedFolder)
	}
	if err != nil {
		return WorkspaceStatus{}, err
	}
	if err := vault.keep(folder.Root(), secrets); err != nil {
		return WorkspaceStatus{}, err
	}
	if err := vault.keep(folder.Root()+sharedVariablesScope, sharedSecrets); err != nil {
		return WorkspaceStatus{}, err
	}
	if err := vault.keep(folder.Root()+folderVariablesScope, folderSecrets); err != nil {
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
	announcePlacement(chosen, target)
	for _, notice := range renamed {
		storage.announce(notice)
	}
	return activate(folder)
}

func sharedEnvironments(environments []Environment, folders []Folder) ([]Environment, []string) {
	names := map[string]string{}
	for _, folder := range folders {
		names[folder.Id] = folder.Name
	}
	scopeOf := func(environment Environment) string {
		if _, known := names[environment.FolderId]; known {
			return environment.FolderId
		}
		return ""
	}
	scopes := map[string]map[string]bool{}
	taken := map[string]bool{}
	for _, environment := range environments {
		if scopes[environment.Name] == nil {
			scopes[environment.Name] = map[string]bool{}
		}
		scopes[environment.Name][scopeOf(environment)] = true
		taken[environment.Name] = true
	}
	var notices []string
	shared := slices.Clone(environments)
	for i, environment := range shared {
		scope := scopeOf(environment)
		if scope == "" || len(scopes[environment.Name]) < 2 {
			continue
		}
		renamed := unusedName(fmt.Sprintf("%s (%s)", environment.Name, names[scope]), taken)
		notices = append(notices, fmt.Sprintf(renamedEnvironment, environment.Name, names[scope], renamed))
		shared[i].Name = renamed
	}
	return shared, notices
}

func unusedName(wanted string, taken map[string]bool) string {
	name := wanted
	for count := 2; taken[name]; count++ {
		name = fmt.Sprintf("%s %d", wanted, count)
	}
	taken[name] = true
	return name
}

func workspaceFiles() engine.FileReader {
	store, isFolder := storage.current().(folderStore)
	if !isFolder {
		return engine.LocalFiles()
	}
	root := store.folder.Root()
	read := engine.FolderFiles(root)
	return func(path string) ([]byte, error) {
		if err := requireTrust(root); err != nil {
			return nil, err
		}
		return read(path)
	}
}

func workspaceAttachments() engine.FileOpener {
	open := engine.LocalOpener()
	store, isFolder := storage.current().(folderStore)
	if !isFolder {
		return open
	}
	root := store.folder.Root()
	return func(path string) (*os.File, error) {
		if err := requireTrust(root); err != nil {
			return nil, err
		}
		return open(path)
	}
}

func (a *App) AttachmentSize(path string) (int64, error) {
	file, err := workspaceAttachments()(path)
	if err != nil {
		return 0, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return 0, err
	}
	if !info.Mode().IsRegular() {
		return 0, fmt.Errorf("%q is not a regular file", path)
	}
	return info.Size(), nil
}

func requireTrust(root string) error {
	if memory, err := recallWorkspace(root); err != nil || !memory.Trusted {
		return errors.New(untrustedFiles)
	}
	return nil
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
