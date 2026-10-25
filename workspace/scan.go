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
	flows        map[string]*flowEntry
	implicit     []*folderEntry
	problems     []Problem
	ahead        *readAhead
}

func newScanner(storage disk) *scanner {
	return &scanner{
		disk:         storage,
		requests:     map[string]*requestEntry{},
		folders:      map[string]*folderEntry{},
		environments: map[string]*environmentEntry{},
		flows:        map[string]*flowEntry{},
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
	s.ahead = startReadAhead(s.disk)
	if err := s.ahead.listing("").err; err != nil {
		return err
	}
	s.directory("", "", 0)
	s.dropEmptyImplicitFolders()
	s.environmentFiles()
	s.flowFiles()
	return nil
}

type entryKind int

const (
	skippedEntry entryKind = iota
	folderKind
	requestKind
	specialKind
)

func kindOf(directory string, entry fs.DirEntry, flowsReserved bool) entryKind {
	name := entry.Name()
	switch {
	case isHidden(name) || isReservedName(directory, name) || isFlowsDirectory(directory, name, flowsReserved):
		return skippedEntry
	case entry.Type() == fs.ModeDir:
		return folderKind
	case entry.Type().IsRegular() && isYAMLFile(name):
		return requestKind
	case !entry.Type().IsRegular():
		return specialKind
	}
	return skippedEntry
}

func (s *scanner) directory(directory, folderId string, depth int) {
	listed := s.ahead.listing(directory)
	if listed.err != nil {
		s.report(directory, listed.err)
		return
	}
	var folders []*folderEntry
	var requestFiles []string
	for _, entry := range listed.entries {
		relative := joinPath(directory, entry.Name())
		switch kindOf(directory, entry, s.ahead.flowsReserved) {
		case folderKind:
			folders = append(folders, s.readFolder(relative, folderId))
		case requestKind:
			requestFiles = append(requestFiles, relative)
		case specialKind:
			s.report(relative, errors.New("links and special files are not followed"))
		}
	}
	s.adoptRequests(s.readRequests(requestFiles, folderId))
	s.adoptFolders(folders, depth)
}

type decodedRequest struct {
	document requestDocument
	err      error
}

func (s *scanner) readRequests(files []string, folderId string) []*requestEntry {
	var requests []*requestEntry
	for _, relative := range files {
		result := s.ahead.file(relative).request
		if isForeign(result.err) {
			continue
		}
		if result.err != nil {
			s.report(relative, result.err)
			continue
		}
		document := result.document
		document.request.FolderId = folderId
		if document.request.Name == "" {
			document.request.Name = stemOf(relative)
		}
		requests = append(requests, &requestEntry{request: document.request, path: relative, order: document.order, extras: document.extras})
	}
	return requests
}

func (s *scanner) readFolder(directory, parentId string) *folderEntry {
	entry := &folderEntry{dir: directory, folder: Folder{Name: path.Base(directory), ParentId: parentId}}
	relative := joinPath(directory, FolderFileName)
	read := s.ahead.file(relative)
	content, err := read.content, read.err
	if errors.Is(err, fs.ErrNotExist) {
		s.implicit = append(s.implicit, entry)
		return entry
	}
	document, err := decodeFile(content, err, readFolder)
	if err != nil {
		entry.broken = true
		s.report(relative, err)
		return entry
	}
	name := entry.folder.Name
	entry.folder, entry.order, entry.extras = document.folder, document.order, document.extras
	entry.folder.ParentId = parentId
	if entry.folder.Name == "" {
		entry.folder.Name = name
	}
	return entry
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
		entry.stored = folderContent{folder: entry.folder, order: entry.order}
		entry.stored.folder.ParentId = ""
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

func (s *scanner) childCounts() map[string]int {
	counts := map[string]int{}
	for _, entry := range s.requests {
		counts[entry.request.FolderId]++
	}
	for _, entry := range s.folders {
		counts[entry.folder.ParentId]++
	}
	return counts
}

func (s *scanner) dropEmptyImplicitFolders() {
	counts := s.childCounts()
	sort.Slice(s.implicit, func(first, second int) bool { return s.implicit[first].dir > s.implicit[second].dir })
	for _, entry := range s.implicit {
		if counts[entry.folder.Id] > 0 {
			continue
		}
		delete(s.folders, entry.folder.Id)
		counts[entry.folder.ParentId]--
	}
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
