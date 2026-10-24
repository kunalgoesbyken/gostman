package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	backupsDirectory   = "backups"
	backupPrefix       = "gostman-"
	backupExtension    = ".json"
	backupStampLayout  = "20060102-150405"
	backupVersionMark  = "-v"
	keptBackups        = 10
	backupInterval     = 24 * time.Hour
	backupCheckEvery   = time.Hour
	backupFileMode     = 0o600
	backupFolderMode   = 0o700
	kindAutomatic      = "automatic"
	kindBeforeRestore  = "before-restore"
	unknownBackup      = "this backup no longer exists"
	unreadableBackup   = "this backup cannot be read, so nothing was changed: %w"
	automaticBackupLog = "the automatic backup of the app's data was not written: %v"
)

var backupKinds = []string{kindAutomatic, kindBeforeRestore}

type Backup struct {
	Id        string `json:"id"`
	Kind      string `json:"kind"`
	Version   string `json:"version"`
	CreatedAt int64  `json:"createdAt"`
	Size      int64  `json:"size"`
}

func backupFolder() string {
	return filepath.Join(appFolder, backupsDirectory)
}

func backupName(kind string, at time.Time) string {
	return backupPrefix + kind + "-" + at.UTC().Format(backupStampLayout) + backupVersionMark + currentVersion + backupExtension
}

func parseBackupName(name string) (Backup, bool) {
	rest, isBackup := strings.CutPrefix(name, backupPrefix)
	rest, hasExtension := strings.CutSuffix(rest, backupExtension)
	if !isBackup || !hasExtension || filepath.Base(name) != name {
		return Backup{}, false
	}
	for _, kind := range backupKinds {
		stamped, found := strings.CutPrefix(rest, kind+"-")
		if !found || len(stamped) < len(backupStampLayout) {
			continue
		}
		at, err := time.ParseInLocation(backupStampLayout, stamped[:len(backupStampLayout)], time.UTC)
		version, marked := strings.CutPrefix(stamped[len(backupStampLayout):], backupVersionMark)
		if err == nil && marked {
			return Backup{Id: name, Kind: kind, Version: version, CreatedAt: at.UnixMilli()}, true
		}
	}
	return Backup{}, false
}

func listBackups() ([]Backup, error) {
	entries, err := os.ReadDir(backupFolder())
	if errors.Is(err, fs.ErrNotExist) {
		return []Backup{}, nil
	}
	if err != nil {
		return nil, err
	}
	backups := []Backup{}
	for _, entry := range entries {
		backup, isBackup := parseBackupName(entry.Name())
		info, err := entry.Info()
		if !isBackup || err != nil || !info.Mode().IsRegular() {
			continue
		}
		backup.Size = info.Size()
		backups = append(backups, backup)
	}
	sort.Slice(backups, func(i, j int) bool {
		if backups[i].CreatedAt != backups[j].CreatedAt {
			return backups[i].CreatedAt > backups[j].CreatedAt
		}
		return backups[i].Id > backups[j].Id
	})
	return backups, nil
}

func pruneBackups() error {
	backups, err := listBackups()
	if err != nil || len(backups) <= keptBackups {
		return err
	}
	for _, backup := range backups[keptBackups:] {
		if err := removeIfPresent(filepath.Join(backupFolder(), backup.Id)); err != nil {
			return err
		}
	}
	return nil
}

func forgetBackups() error {
	return os.RemoveAll(backupFolder())
}

func snapshotDataFile(kind string) error {
	content, err := os.ReadFile(jsonfilePath)
	if errors.Is(err, fs.ErrNotExist) || (err == nil && len(content) == 0) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := os.MkdirAll(backupFolder(), backupFolderMode); err != nil {
		return err
	}
	target := filepath.Join(backupFolder(), backupName(kind, time.Now()))
	temporary := target + ".tmp"
	if err := os.WriteFile(temporary, content, backupFileMode); err != nil {
		return err
	}
	if err := os.Rename(temporary, target); err != nil {
		os.Remove(temporary)
		return err
	}
	return pruneBackups()
}

func isBackupDue(backups []Backup, now time.Time) bool {
	if len(backups) == 0 {
		return true
	}
	newest := backups[0]
	return newest.Version != currentVersion || now.Sub(time.UnixMilli(newest.CreatedAt)) >= backupInterval
}

func backUpIfDue() {
	dataMutex.RLock()
	defer dataMutex.RUnlock()
	backups, err := listBackups()
	if err == nil && isBackupDue(backups, time.Now()) {
		err = snapshotDataFile(kindAutomatic)
	}
	if err != nil {
		log.Printf(automaticBackupLog, err)
	}
}

func startBackups() {
	backUpIfDue()
	go func() {
		for range time.Tick(backupCheckEvery) {
			backUpIfDue()
		}
	}()
}

func replaceDataFile(content []byte) error {
	dataMutex.Lock()
	defer dataMutex.Unlock()
	if err := snapshotDataFile(kindBeforeRestore); err != nil {
		return err
	}
	return writeDataFile(content)
}

func (a *App) ListBackups() ([]Backup, error) {
	return listBackups()
}

func (a *App) RestoreBackup(id string) error {
	backup, isBackup := parseBackupName(id)
	if !isBackup {
		return errors.New(unknownBackup)
	}
	content, err := os.ReadFile(filepath.Join(backupFolder(), backup.Id))
	if errors.Is(err, fs.ErrNotExist) {
		return errors.New(unknownBackup)
	}
	if err != nil {
		return err
	}
	var data SavedData
	if err := json.Unmarshal(content, &data); err != nil {
		return fmt.Errorf(unreadableBackup, err)
	}
	if err := replaceDataFile(content); err != nil {
		return err
	}
	a.loadNetwork()
	return nil
}

func (a *App) OpenBackupsFolder() error {
	if err := os.MkdirAll(backupFolder(), backupFolderMode); err != nil {
		return err
	}
	return revealFolder(backupFolder())
}
