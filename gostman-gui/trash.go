package main

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
)

const (
	trashAppDataFile = "trash.json"
	trashPermissions = 0o600
)

func trashAppDataPath() string {
	return filepath.Join(appFolder, trashAppDataFile)
}

func (a *App) ReadTrash() (string, error) {
	if folder := openFolder(); folder != nil {
		return folder.ReadTrash()
	}
	content, err := os.ReadFile(trashAppDataPath())
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	return string(content), err
}

func (a *App) WriteTrash(text string) error {
	if folder := openFolder(); folder != nil {
		return folder.WriteTrash(text)
	}
	return os.WriteFile(trashAppDataPath(), []byte(text), trashPermissions)
}
