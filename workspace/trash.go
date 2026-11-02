package workspace

import (
	"errors"
	"io/fs"
)

const (
	trashDirectory = agentDirectory + "/trash"
	trashFile      = trashDirectory + "/trash.json"
	trashIgnore    = trashDirectory + "/.gitignore"
	trashIgnoreAll = "*\n"
)

func (w *Workspace) ReadTrash() (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	content, err := w.disk.read(trashFile)
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	return string(content), err
}

func (w *Workspace) WriteTrash(text string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.disk.makeDirectory(trashDirectory); err != nil {
		return err
	}
	if err := w.disk.write(trashIgnore, []byte(trashIgnoreAll)); err != nil {
		return err
	}
	return w.disk.write(trashFile, []byte(text))
}
