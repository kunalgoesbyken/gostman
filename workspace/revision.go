package workspace

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

const revisionLength = 12

func Revision(content []byte) string {
	sum := sha256.Sum256(content)
	return hex.EncodeToString(sum[:])[:revisionLength]
}

func (w *Workspace) storedRevision(path string) (string, error) {
	if path == "" {
		return "", nil
	}
	content, err := w.disk.read(path)
	if err != nil {
		return "", fmt.Errorf("the revision of %s cannot be read: %w", path, err)
	}
	return Revision(content), nil
}

func (w *Workspace) RequestRevision(id string) (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	entry := w.requests[id]
	if entry == nil {
		return "", nil
	}
	return w.storedRevision(entry.path)
}

func (w *Workspace) EnvironmentRevision(name string) (string, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, entry := range w.environments {
		if entry.environment.Name == name {
			return w.storedRevision(entry.path)
		}
	}
	return "", nil
}
