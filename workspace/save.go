package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"reflect"
	"sort"
	"strings"
)

const firstNumberedCopy = 2

var errMissingId = errors.New("an item without an id cannot be saved")

func numbered(stem string, attempt int) string {
	if attempt < firstNumberedCopy {
		return stem
	}
	return fmt.Sprintf("%s%s%d", stem, wordSeparator, attempt)
}

func (w *Workspace) takenNames(directory string) (map[string]bool, error) {
	entries, err := w.disk.list(directory)
	if err != nil {
		return nil, err
	}
	taken := map[string]bool{strings.ToLower(FolderFileName): true}
	if directory == "" {
		taken[strings.ToLower(ManifestName)] = true
		taken[strings.ToLower(EnvironmentsDirectory)] = true
	}
	for _, entry := range entries {
		taken[strings.ToLower(entry.Name())] = true
	}
	return taken, nil
}

func (w *Workspace) freePath(directory, stem, extension, current string) (string, error) {
	taken, err := w.takenNames(directory)
	if err != nil {
		return "", err
	}
	for attempt := 1; ; attempt++ {
		name := numbered(stem, attempt) + extension
		candidate := joinPath(directory, name)
		if current != "" && strings.EqualFold(candidate, current) {
			return current, nil
		}
		if !taken[strings.ToLower(name)] && !w.disk.exists(candidate) {
			return candidate, nil
		}
	}
}

func (w *Workspace) directoryOf(folderId string) string {
	if entry := w.folders[folderId]; entry != nil {
		return entry.dir
	}
	return ""
}

func (w *Workspace) nextOrder(directory string) int64 {
	var highest int64
	for _, entry := range w.requests {
		if parentOf(entry.path) == directory {
			highest = max(highest, entry.order)
		}
	}
	for _, entry := range w.folders {
		if parentOf(entry.dir) == directory {
			highest = max(highest, entry.order)
		}
	}
	return highest + 1
}

func (w *Workspace) nextEnvironmentOrder() int64 {
	var highest int64
	for _, entry := range w.environments {
		if entry.order > highest {
			highest = entry.order
		}
	}
	return highest + 1
}

func (w *Workspace) requestOrder(entry *requestEntry, request Request, directory string) int64 {
	if request.SortOrder > 0 {
		return request.SortOrder
	}
	if entry.path == "" || parentOf(entry.path) != directory {
		return w.nextOrder(directory)
	}
	return entry.order
}

func (w *Workspace) relocate(from, to string) error {
	if from == to {
		return nil
	}
	err := w.disk.move(from, to)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

func (w *Workspace) requestPath(entry *requestEntry, request Request, directory string) (string, error) {
	isInPlace := entry.path != "" && parentOf(entry.path) == directory
	if isInPlace && sameStem(entry.request.Name, request.Name, requestFallbackStem) {
		return entry.path, nil
	}
	current := ""
	if isInPlace {
		current = entry.path
	}
	return w.freePath(directory, fileStem(request.Name, requestFallbackStem), fileExtension, current)
}

func (w *Workspace) storeRequest(request Request) error {
	if request.Id == "" {
		return errMissingId
	}
	entry := w.requests[request.Id]
	if entry == nil {
		entry = &requestEntry{}
	}
	directory := w.directoryOf(request.FolderId)
	target, err := w.requestPath(entry, request, directory)
	if err != nil {
		return err
	}
	order := w.requestOrder(entry, request, directory)
	document := requestDocument{request: request, order: order, extras: entry.extras}
	normalized, err := normalizeRequest(document)
	if err != nil {
		return err
	}
	normalized.FolderId = request.FolderId
	isStored := entry.path == target && entry.order == order && reflect.DeepEqual(entry.request, normalized)
	if entry.path != "" {
		if err := w.relocate(entry.path, target); err != nil {
			return err
		}
		entry.path = target
	}
	if isStored {
		return nil
	}
	content, err := encodeRequest(document)
	if err != nil {
		return fmt.Errorf("%s: %w", request.Name, err)
	}
	if err := w.disk.write(target, content); err != nil {
		return err
	}
	entry.request, entry.path, entry.order = normalized, target, order
	w.requests[request.Id] = entry
	return nil
}

func (w *Workspace) SaveRequests(requests []Request) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, request := range requests {
		if err := w.storeRequest(request); err != nil {
			return err
		}
	}
	return nil
}

func (w *Workspace) DeleteRequest(id string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	entry := w.requests[id]
	if entry == nil {
		return nil
	}
	if err := w.disk.remove(entry.path); err != nil {
		return err
	}
	delete(w.requests, id)
	return nil
}

func (w *Workspace) placeRequests() error {
	for _, entry := range w.orderedRequests() {
		if parentOf(entry.path) == w.directoryOf(entry.request.FolderId) {
			continue
		}
		if err := w.storeRequest(entry.request); err != nil {
			return err
		}
	}
	return nil
}

func (w *Workspace) rebaseEntries(from, to string) {
	for _, entry := range w.folders {
		entry.dir = rebase(entry.dir, from, to)
	}
	for _, entry := range w.requests {
		entry.path = rebase(entry.path, from, to)
	}
}

func (w *Workspace) createFolder(folder Folder, parent string) (*folderEntry, error) {
	directory, err := w.freePath(parent, fileStem(folder.Name, folderFallbackStem), "", "")
	if err != nil {
		return nil, err
	}
	if err := w.disk.makeDirectory(directory); err != nil {
		return nil, err
	}
	entry := &folderEntry{folder: Folder{Id: folder.Id}, dir: directory, order: w.nextOrder(parent)}
	w.folders[folder.Id] = entry
	return entry, nil
}

func (w *Workspace) moveFolder(entry *folderEntry, folder Folder, parent string) error {
	isInPlace := parentOf(entry.dir) == parent
	if isInPlace && sameStem(entry.folder.Name, folder.Name, folderFallbackStem) {
		return nil
	}
	current, order := "", w.nextOrder(parent)
	if isInPlace {
		current, order = entry.dir, entry.order
	}
	target, err := w.freePath(parent, fileStem(folder.Name, folderFallbackStem), "", current)
	if err != nil {
		return err
	}
	if err := w.relocate(entry.dir, target); err != nil {
		return err
	}
	w.rebaseEntries(entry.dir, target)
	entry.order = order
	return nil
}

func (w *Workspace) storeFolder(folder Folder) error {
	parent := w.directoryOf(folder.ParentId)
	entry := w.folders[folder.Id]
	if entry == nil {
		created, err := w.createFolder(folder, parent)
		if err != nil {
			return err
		}
		entry = created
	} else if err := w.moveFolder(entry, folder, parent); err != nil {
		return err
	}
	if folder.SortOrder > 0 {
		entry.order = folder.SortOrder
	}
	document := folderDocument{folderContent: folderContent{folder: folder, order: entry.order}, extras: entry.extras}
	content, err := normalizeFolder(document)
	if err != nil {
		return err
	}
	entry.folder = folder
	entry.folder.Variables, entry.folder.Settings = content.folder.Variables, content.folder.Settings
	entry.folder.Color, entry.folder.Tags = content.folder.Color, content.folder.Tags
	if reflect.DeepEqual(entry.stored, content) {
		return nil
	}
	relative := joinPath(entry.dir, FolderFileName)
	if entry.broken {
		return fmt.Errorf("%s could not be read, so it was left unchanged; fix or delete it first", relative)
	}
	encoded, err := encodeFolder(document)
	if err != nil {
		return fmt.Errorf("%s: %w", folder.Name, err)
	}
	if err := w.disk.write(relative, encoded); err != nil {
		return err
	}
	entry.stored = content
	return nil
}

func withoutCycle(parentId string, parents map[string]string) string {
	seen := map[string]bool{}
	for ancestor := parentId; ancestor != ""; ancestor = parents[ancestor] {
		if seen[ancestor] {
			return ""
		}
		seen[ancestor] = true
	}
	return parentId
}

func arrangeFolders(folders []Folder) []Folder {
	parents := map[string]string{}
	var unique []Folder
	for _, folder := range folders {
		if _, isRepeated := parents[folder.Id]; folder.Id == "" || isRepeated {
			continue
		}
		parents[folder.Id] = folder.ParentId
		unique = append(unique, folder)
	}
	for i := range unique {
		if _, hasParent := parents[unique[i].ParentId]; !hasParent {
			unique[i].ParentId = ""
		}
		unique[i].ParentId = withoutCycle(unique[i].ParentId, parents)
		parents[unique[i].Id] = unique[i].ParentId
	}
	return parentsFirst(unique)
}

func parentsFirst(folders []Folder) []Folder {
	placed := map[string]bool{"": true}
	arranged := make([]Folder, 0, len(folders))
	for len(arranged) < len(folders) {
		for _, folder := range folders {
			if !placed[folder.Id] && placed[folder.ParentId] {
				placed[folder.Id] = true
				arranged = append(arranged, folder)
			}
		}
	}
	return arranged
}

func (w *Workspace) survivingAncestor(folderId string, kept map[string]bool) string {
	for range w.folders {
		entry := w.folders[folderId]
		if entry == nil || kept[folderId] {
			break
		}
		folderId = entry.folder.ParentId
	}
	if kept[folderId] {
		return folderId
	}
	return ""
}

func (w *Workspace) adoptOrphans(kept map[string]bool) {
	for _, entry := range w.requests {
		if w.folders[entry.request.FolderId] != nil && !kept[entry.request.FolderId] {
			entry.request.FolderId = w.survivingAncestor(entry.request.FolderId, kept)
		}
	}
}

func (w *Workspace) removedFolders(kept map[string]bool) []*folderEntry {
	var removed []*folderEntry
	for id, entry := range w.folders {
		if !kept[id] {
			removed = append(removed, entry)
		}
	}
	sort.Slice(removed, func(first, second int) bool { return removed[first].dir > removed[second].dir })
	return removed
}

func (w *Workspace) dropFolder(entry *folderEntry) error {
	if !entry.broken {
		if err := w.disk.remove(joinPath(entry.dir, FolderFileName)); err != nil {
			return err
		}
	}
	delete(w.folders, entry.folder.Id)
	if entries, err := w.disk.list(entry.dir); err != nil || len(entries) > 0 {
		return nil
	}
	return w.disk.remove(entry.dir)
}

func (w *Workspace) SaveFolders(folders []Folder) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	arranged := arrangeFolders(folders)
	kept := map[string]bool{}
	for _, folder := range arranged {
		kept[folder.Id] = true
	}
	w.adoptOrphans(kept)
	for _, folder := range arranged {
		if err := w.storeFolder(folder); err != nil {
			return err
		}
	}
	if err := w.placeRequests(); err != nil {
		return err
	}
	for _, entry := range w.removedFolders(kept) {
		if err := w.dropFolder(entry); err != nil {
			return err
		}
	}
	return nil
}

func (w *Workspace) environmentPath(entry *environmentEntry, environment Environment) (string, error) {
	if entry.path != "" && sameStem(entry.environment.Name, environment.Name, environmentFallback) {
		return entry.path, nil
	}
	return w.freePath(EnvironmentsDirectory, fileStem(environment.Name, environmentFallback), fileExtension, entry.path)
}

func (w *Workspace) storeEnvironment(environment Environment) error {
	if environment.Id == "" {
		return errMissingId
	}
	environment, _ = WithoutSecretValues(environment)
	entry := w.environments[environment.Id]
	if entry == nil {
		entry = &environmentEntry{order: w.nextEnvironmentOrder()}
	}
	target, err := w.environmentPath(entry, environment)
	if err != nil {
		return err
	}
	document := environmentDocument{environmentContent: environmentContent{environment: environment, order: entry.order}, extras: entry.extras}
	normalized, err := normalizeEnvironment(document)
	if err != nil {
		return err
	}
	isStored := entry.path == target && entry.environment == normalized
	if entry.path != "" {
		if err := w.relocate(entry.path, target); err != nil {
			return err
		}
		entry.path = target
	}
	if isStored {
		return nil
	}
	content, err := encodeEnvironment(document)
	if err != nil {
		return fmt.Errorf("%s: %w", environment.Name, err)
	}
	if err := w.disk.write(target, content); err != nil {
		return err
	}
	entry.environment, entry.path = normalized, target
	w.environments[environment.Id] = entry
	return nil
}

func (w *Workspace) dropEnvironments(kept map[string]bool) error {
	for id, entry := range w.environments {
		if kept[id] {
			continue
		}
		if err := w.disk.remove(entry.path); err != nil {
			return err
		}
		delete(w.environments, id)
	}
	return nil
}

func (w *Workspace) SaveEnvironments(environments []Environment) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(environments) > 0 {
		if err := w.disk.makeDirectory(EnvironmentsDirectory); err != nil {
			return err
		}
	}
	kept := map[string]bool{}
	for _, environment := range environments {
		kept[environment.Id] = true
		if err := w.storeEnvironment(environment); err != nil {
			return err
		}
	}
	return w.dropEnvironments(kept)
}
