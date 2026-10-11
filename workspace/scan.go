package workspace

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"
)

const (
	maxFolderDepth      = 64
	derivedIdLength     = 16
	requestIdPrefix     = "request-"
	folderIdPrefix      = "folder-"
	environmentIdPrefix = "environment-"
)

type scanner struct {
	disk         disk
	requests     map[string]*requestEntry
	folders      map[string]*folderEntry
	environments map[string]*environmentEntry
	problems     []Problem
}

func newScanner(storage disk) *scanner {
	return &scanner{
		disk:         storage,
		requests:     map[string]*requestEntry{},
		folders:      map[string]*folderEntry{},
		environments: map[string]*environmentEntry{},
	}
}

func (s *scanner) report(relative string, err error) {
	problem := Problem{Path: relative, Message: err.Error()}
	var located *fileError
	if errors.As(err, &located) {
		problem.Line, problem.Message = located.line, located.message
	}
	s.problems = append(s.problems, problem)
}

func derivedId(prefix, relative string, attempt int) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s#%d", relative, attempt)))
	return prefix + hex.EncodeToString(sum[:])[:derivedIdLength]
}

func uniqueId(id, prefix, relative string, isTaken func(string) bool) string {
	for attempt := 0; id == "" || isTaken(id); attempt++ {
		id = derivedId(prefix, relative, attempt)
	}
	return id
}

func effectiveOrder(stored, previous int64) int64 {
	if stored > 0 {
		return stored
	}
	return previous + 1
}

func unorderedLast(orderOf func(int) int64, nameOf func(int) string) func(int, int) bool {
	return func(first, second int) bool {
		firstSet, secondSet := orderOf(first) > 0, orderOf(second) > 0
		if firstSet != secondSet {
			return firstSet
		}
		if orderOf(first) != orderOf(second) {
			return orderOf(first) < orderOf(second)
		}
		return nameOf(first) < nameOf(second)
	}
}

func (s *scanner) run() error {
	if _, err := s.disk.list(""); err != nil {
		return err
	}
	s.directory("", "", 0)
	s.environmentFiles()
	return nil
}

func (s *scanner) directory(directory, folderId string, depth int) {
	entries, err := s.disk.list(directory)
	if err != nil {
		s.report(directory, err)
		return
	}
	var folders []*folderEntry
	var requests []*requestEntry
	for _, entry := range entries {
		name := entry.Name()
		relative := joinPath(directory, name)
		switch {
		case isHidden(name) || isReservedName(directory, name):
		case entry.Type() == fs.ModeDir:
			folders = append(folders, s.readFolder(relative, folderId))
		case entry.Type().IsRegular() && isYAMLFile(name):
			requests = s.appendRequest(requests, relative, folderId)
		case !entry.Type().IsRegular():
			s.report(relative, errors.New("links and special files are not followed"))
		}
	}
	s.adoptRequests(requests)
	s.adoptFolders(folders, depth)
}

func (s *scanner) readFolder(directory, parentId string) *folderEntry {
	entry := &folderEntry{dir: directory, folder: Folder{Name: path.Base(directory), ParentId: parentId}}
	relative := joinPath(directory, FolderFileName)
	content, err := s.disk.read(relative)
	if errors.Is(err, fs.ErrNotExist) {
		return entry
	}
	document, err := decodeFile(content, err, readFolder)
	if err != nil {
		entry.broken = true
		s.report(relative, err)
		return entry
	}
	entry.folder.Id, entry.order, entry.extras = document.id, document.order, document.extras
	if document.name != "" {
		entry.folder.Name = document.name
	}
	return entry
}

func (s *scanner) appendRequest(requests []*requestEntry, relative, folderId string) []*requestEntry {
	content, err := s.disk.read(relative)
	document, err := decodeFile(content, err, readRequest)
	if err != nil {
		s.report(relative, err)
		return requests
	}
	document.request.FolderId = folderId
	if document.request.Name == "" {
		document.request.Name = stemOf(relative)
	}
	return append(requests, &requestEntry{request: document.request, path: relative, order: document.order, extras: document.extras})
}

func (s *scanner) adoptRequests(requests []*requestEntry) {
	sort.SliceStable(requests, unorderedLast(
		func(i int) int64 { return requests[i].order },
		func(i int) string { return requests[i].path },
	))
	isTaken := func(id string) bool { return s.requests[id] != nil }
	var previous int64
	for _, entry := range requests {
		entry.order = effectiveOrder(entry.order, previous)
		previous = entry.order
		entry.request.Id = uniqueId(entry.request.Id, requestIdPrefix, entry.path, isTaken)
		s.requests[entry.request.Id] = entry
	}
}

func (s *scanner) adoptFolders(folders []*folderEntry, depth int) {
	sort.SliceStable(folders, unorderedLast(
		func(i int) int64 { return folders[i].order },
		func(i int) string { return folders[i].dir },
	))
	isTaken := func(id string) bool { return s.folders[id] != nil }
	var previous int64
	for _, entry := range folders {
		entry.order = effectiveOrder(entry.order, previous)
		previous = entry.order
		entry.folder.Id = uniqueId(entry.folder.Id, folderIdPrefix, entry.dir, isTaken)
		entry.stored = folderContent{id: entry.folder.Id, name: entry.folder.Name, order: entry.order}
		s.folders[entry.folder.Id] = entry
	}
	for _, entry := range folders {
		s.descend(entry, depth)
	}
}

func (s *scanner) descend(entry *folderEntry, depth int) {
	if depth >= maxFolderDepth {
		s.report(entry.dir, errors.New("folders nested this deeply are not read"))
		return
	}
	s.directory(entry.dir, entry.folder.Id, depth+1)
}

func (s *scanner) environmentFiles() {
	entries, err := s.disk.list(EnvironmentsDirectory)
	if errors.Is(err, fs.ErrNotExist) {
		return
	}
	if err != nil {
		s.report(EnvironmentsDirectory, err)
		return
	}
	var environments []*environmentEntry
	for _, entry := range entries {
		name := entry.Name()
		if isHidden(name) || !entry.Type().IsRegular() || !isYAMLFile(name) {
			continue
		}
		environments = s.appendEnvironment(environments, joinPath(EnvironmentsDirectory, name))
	}
	s.adoptEnvironments(environments)
}

func (s *scanner) appendEnvironment(environments []*environmentEntry, relative string) []*environmentEntry {
	content, err := s.disk.read(relative)
	document, err := decodeFile(content, err, readEnvironment)
	if err != nil {
		s.report(relative, err)
		return environments
	}
	entry := &environmentEntry{environment: document.environment, path: relative, order: document.order, extras: document.extras}
	if entry.environment.Name == "" {
		entry.environment.Name = stemOf(relative)
	}
	return append(environments, entry)
}

func (s *scanner) adoptEnvironments(environments []*environmentEntry) {
	sort.SliceStable(environments, unorderedLast(
		func(i int) int64 { return environments[i].order },
		func(i int) string { return environments[i].path },
	))
	isTaken := func(id string) bool { return s.environments[id] != nil }
	var previous int64
	for _, entry := range environments {
		entry.order = effectiveOrder(entry.order, previous)
		previous = entry.order
		entry.environment.Id = uniqueId(entry.environment.Id, environmentIdPrefix, entry.path, isTaken)
		s.environments[entry.environment.Id] = entry
	}
}
