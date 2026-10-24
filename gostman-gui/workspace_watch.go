package main

import (
	"io/fs"
	"log"
	"maps"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/kunalgoesbyken/gostman/workspace"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	diskChangedEvent = "workspace:changed"
	diskPollInterval = 2 * time.Second
	hiddenPrefix     = "."
	reloadFailedLog  = "the workspace folder changed on disk but could not be reloaded: %v"
)

var watchedExtensions = []string{".yaml", ".yml"}

type fileStamp struct {
	size     int64
	modified int64
}

type folderSnapshot map[string]fileStamp

type diskWatcher struct {
	mu        sync.Mutex
	root      string
	baseline  folderSnapshot
	candidate folderSnapshot
}

var diskWatch = &diskWatcher{}

func isWatchedFile(name string) bool {
	return slices.Contains(watchedExtensions, strings.ToLower(filepath.Ext(name))) || name == workspace.DotEnvName
}

func isSkipped(path, root, name string) bool {
	return path != root && strings.HasPrefix(name, hiddenPrefix) && name != workspace.DotEnvName
}

func snapshotFolder(root string) folderSnapshot {
	snapshot := folderSnapshot{}
	filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		switch {
		case err != nil:
			return nil
		case isSkipped(path, root, entry.Name()) && entry.IsDir():
			return filepath.SkipDir
		case isSkipped(path, root, entry.Name()) || !entry.Type().IsRegular() || !isWatchedFile(entry.Name()):
			return nil
		}
		if info, err := entry.Info(); err == nil {
			snapshot[path] = fileStamp{size: info.Size(), modified: info.ModTime().UnixNano()}
		}
		return nil
	})
	return snapshot
}

func (w *diskWatcher) settled(root string, current folderSnapshot) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	switch {
	case root != w.root:
		w.root, w.baseline, w.candidate = root, current, nil
		return false
	case maps.Equal(current, w.baseline):
		w.candidate = nil
		return false
	case w.candidate == nil || !maps.Equal(current, w.candidate):
		w.candidate = current
		return false
	}
	w.baseline, w.candidate = current, nil
	return true
}

func (w *diskWatcher) forget() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.root, w.baseline, w.candidate = "", nil, nil
}

func (w *diskWatcher) poll() bool {
	folder := openFolder()
	if folder == nil {
		w.forget()
		return false
	}
	if !w.settled(folder.Root(), snapshotFolder(folder.Root())) {
		return false
	}
	if err := folder.Reload(); err != nil {
		log.Printf(reloadFailedLog, err)
		return false
	}
	return true
}

func (w *diskWatcher) watch(onChange func()) {
	for range time.Tick(diskPollInterval) {
		if w.poll() {
			onChange()
		}
	}
}

func (w *diskWatcher) ownWrite(root string, write func() error) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if root != w.root {
		return write()
	}
	untouched := maps.Equal(snapshotFolder(root), w.baseline)
	err := write()
	if untouched {
		w.baseline, w.candidate = snapshotFolder(root), nil
	}
	return err
}

func (s folderStore) write(change func() error) error {
	return diskWatch.ownWrite(s.folder.Root(), change)
}

func (a *App) announceDiskChange() {
	wailsruntime.EventsEmit(a.ctx, diskChangedEvent)
}
