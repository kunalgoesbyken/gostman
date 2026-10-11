package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

const (
	ManifestName          = "gostman.yaml"
	EnvironmentsDirectory = "environments"
	FolderFileName        = "folder.yaml"
	fileExtension         = ".yaml"
	shortFileExtension    = ".yml"
	hiddenPrefix          = "."
)

type State int

const (
	Missing State = iota
	Empty
	Existing
	Foreign
)

var (
	ErrNotEmpty    = errors.New("the folder already contains files")
	ErrNoWorkspace = errors.New("the folder is not a Gostman workspace")
)

type requestEntry struct {
	request Request
	path    string
	order   int64
	extras  requestExtras
}

type folderEntry struct {
	folder Folder
	dir    string
	order  int64
	stored folderContent
	broken bool
	extras []*yaml.Node
}

type environmentEntry struct {
	environment Environment
	path        string
	order       int64
	extras      []*yaml.Node
}

type Workspace struct {
	mu           sync.Mutex
	disk         disk
	requests     map[string]*requestEntry
	folders      map[string]*folderEntry
	environments map[string]*environmentEntry
	problems     []Problem
}

func isHidden(name string) bool {
	return strings.HasPrefix(name, hiddenPrefix)
}

func isYAMLFile(name string) bool {
	extension := strings.ToLower(path.Ext(name))
	return extension == fileExtension || extension == shortFileExtension
}

func isReservedName(directory, name string) bool {
	if strings.EqualFold(name, FolderFileName) {
		return true
	}
	return directory == "" && (strings.EqualFold(name, ManifestName) || strings.EqualFold(name, EnvironmentsDirectory))
}

func hasVisibleEntries(entries []fs.DirEntry) bool {
	for _, entry := range entries {
		if !isHidden(entry.Name()) {
			return true
		}
	}
	return false
}

func Inspect(root string) (State, error) {
	entries, err := os.ReadDir(root)
	if errors.Is(err, fs.ErrNotExist) {
		return Missing, nil
	}
	if err != nil {
		return Foreign, err
	}
	manifest, err := os.Lstat(filepath.Join(root, ManifestName))
	if err == nil && manifest.Mode().IsRegular() {
		return Existing, nil
	}
	if hasVisibleEntries(entries) {
		return Foreign, nil
	}
	return Empty, nil
}

func absoluteRoot(root string) (string, error) {
	absolute, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("the folder path cannot be used: %w", err)
	}
	return absolute, nil
}

func Open(root string) (*Workspace, error) {
	absolute, err := absoluteRoot(root)
	if err != nil {
		return nil, err
	}
	workspace := &Workspace{disk: disk{root: absolute}}
	manifest, err := workspace.disk.read(ManifestName)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, ErrNoWorkspace
	}
	if err != nil {
		return nil, err
	}
	if err := checkManifest(manifest); err != nil {
		return nil, fmt.Errorf("%s: %w", ManifestName, err)
	}
	return workspace, workspace.Reload()
}

func Create(root string, collection Collection) (*Workspace, error) {
	absolute, err := absoluteRoot(root)
	if err != nil {
		return nil, err
	}
	state, err := Inspect(absolute)
	if err != nil {
		return nil, err
	}
	if state == Existing || state == Foreign {
		return nil, ErrNotEmpty
	}
	if err := os.MkdirAll(absolute, dirPermissions); err != nil {
		return nil, err
	}
	manifest, err := encodeManifest()
	if err != nil {
		return nil, err
	}
	if err := (disk{root: absolute}).write(ManifestName, manifest); err != nil {
		return nil, err
	}
	workspace, err := Open(absolute)
	if err != nil {
		return nil, err
	}
	return workspace, workspace.fill(collection)
}

func (w *Workspace) fill(collection Collection) error {
	if err := w.SaveFolders(collection.Folders); err != nil {
		return err
	}
	if err := w.SaveRequests(collection.Requests); err != nil {
		return err
	}
	return w.SaveEnvironments(collection.Environments)
}

func (w *Workspace) Root() string {
	return w.disk.root
}

func (w *Workspace) Problems() []Problem {
	w.mu.Lock()
	defer w.mu.Unlock()
	return append([]Problem{}, w.problems...)
}

func (w *Workspace) Reload() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	scan := newScanner(w.disk)
	if err := scan.run(); err != nil {
		return err
	}
	w.requests, w.folders, w.environments, w.problems = scan.requests, scan.folders, scan.environments, scan.problems
	return nil
}

func byOrderThenName(orderOf func(int) int64, nameOf func(int) string) func(int, int) bool {
	return func(first, second int) bool {
		if orderOf(first) != orderOf(second) {
			return orderOf(first) < orderOf(second)
		}
		return nameOf(first) < nameOf(second)
	}
}

func (w *Workspace) foldersIn(directory string) []*folderEntry {
	var children []*folderEntry
	for _, entry := range w.folders {
		if parentOf(entry.dir) == directory {
			children = append(children, entry)
		}
	}
	sort.Slice(children, byOrderThenName(
		func(i int) int64 { return children[i].order },
		func(i int) string { return children[i].dir },
	))
	return children
}

func (w *Workspace) requestsIn(directory string) []*requestEntry {
	var children []*requestEntry
	for _, entry := range w.requests {
		if parentOf(entry.path) == directory {
			children = append(children, entry)
		}
	}
	sort.Slice(children, byOrderThenName(
		func(i int) int64 { return children[i].order },
		func(i int) string { return children[i].path },
	))
	return children
}

func (w *Workspace) orderedFolders() []*folderEntry {
	var ordered []*folderEntry
	var visit func(directory string)
	visit = func(directory string) {
		for _, entry := range w.foldersIn(directory) {
			ordered = append(ordered, entry)
			visit(entry.dir)
		}
	}
	visit("")
	return ordered
}

func (w *Workspace) orderedRequests() []*requestEntry {
	ordered := w.requestsIn("")
	for _, folder := range w.orderedFolders() {
		ordered = append(ordered, w.requestsIn(folder.dir)...)
	}
	return ordered
}

func (w *Workspace) orderedEnvironments() []*environmentEntry {
	ordered := make([]*environmentEntry, 0, len(w.environments))
	for _, entry := range w.environments {
		ordered = append(ordered, entry)
	}
	sort.Slice(ordered, byOrderThenName(
		func(i int) int64 { return ordered[i].order },
		func(i int) string { return ordered[i].path },
	))
	return ordered
}

func (w *Workspace) Collection() Collection {
	w.mu.Lock()
	defer w.mu.Unlock()
	collection := Collection{Requests: []Request{}, Folders: []Folder{}, Environments: []Environment{}}
	for _, entry := range w.orderedFolders() {
		collection.Folders = append(collection.Folders, entry.folder)
	}
	for _, entry := range w.orderedRequests() {
		collection.Requests = append(collection.Requests, entry.request)
	}
	for _, entry := range w.orderedEnvironments() {
		collection.Environments = append(collection.Environments, entry.environment)
	}
	return collection
}
