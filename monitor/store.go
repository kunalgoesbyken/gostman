package monitor

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	DefaultKeep  = 200
	workspaceDir = ".gostman"
	runsDir      = "runs"
	userDirName  = "Gostman"
	recordSuffix = ".json"
	ignoreFile   = ".gitignore"
	folderPerm   = 0o755
	filePerm     = 0o644
	hashLength   = 8
	nameLimit    = 40
)

var unsafeName = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

type Store struct {
	Dir  string
	Keep int
}

func WorkspaceRuns(root string) string {
	return filepath.Join(root, workspaceDir, runsDir)
}

func UserRuns(path string) (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(strings.ToLower(filepath.ToSlash(absolute))))
	label := unsafeName.ReplaceAllString(filepath.Base(absolute), "-")
	if len(label) > nameLimit {
		label = label[:nameLimit]
	}
	return filepath.Join(base, userDirName, runsDir, label+"-"+hex.EncodeToString(sum[:])[:hashLength]), nil
}

func Locate(path string) (string, error) {
	if state, err := workspace.Inspect(path); err == nil && state == workspace.Existing {
		absolute, err := filepath.Abs(path)
		if err != nil {
			return "", err
		}
		return WorkspaceRuns(absolute), nil
	}
	return UserRuns(path)
}

func Open(path string, keep int) (Store, error) {
	dir, err := Locate(path)
	if err != nil {
		return Store{}, err
	}
	return Store{Dir: dir, Keep: keep}, nil
}

func (s Store) keep() int {
	if s.Keep <= 0 {
		return DefaultKeep
	}
	return s.Keep
}

func (s Store) names() ([]string, error) {
	entries, err := os.ReadDir(s.Dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var names []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), recordSuffix) {
			names = append(names, entry.Name())
		}
	}
	sort.Strings(names)
	return names, nil
}

func (s Store) Save(record Record) error {
	if err := os.MkdirAll(s.Dir, folderPerm); err != nil {
		return err
	}
	if err := s.keepOutOfGit(); err != nil {
		return err
	}
	data, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return err
	}
	partial, err := os.CreateTemp(s.Dir, ".write-*.tmp")
	if err != nil {
		return err
	}
	_, writeErr := partial.Write(append(data, '\n'))
	if err := errors.Join(writeErr, partial.Close(), os.Chmod(partial.Name(), filePerm)); err != nil {
		os.Remove(partial.Name())
		return err
	}
	if err := os.Rename(partial.Name(), filepath.Join(s.Dir, record.ID+recordSuffix)); err != nil {
		os.Remove(partial.Name())
		return err
	}
	return s.prune()
}

func (s Store) keepOutOfGit() error {
	path := filepath.Join(s.Dir, ignoreFile)
	if _, err := os.Stat(path); err == nil {
		return nil
	}
	return os.WriteFile(path, []byte("*\n"), filePerm)
}

func (s Store) prune() error {
	names, err := s.names()
	if err != nil {
		return err
	}
	var failures []error
	for len(names) > s.keep() {
		failures = append(failures, os.Remove(filepath.Join(s.Dir, names[0])))
		names = names[1:]
	}
	return errors.Join(failures...)
}

func (s Store) List(limit int) ([]Record, error) {
	names, err := s.names()
	if err != nil {
		return nil, err
	}
	if limit > 0 && len(names) > limit {
		names = names[len(names)-limit:]
	}
	records := make([]Record, 0, len(names))
	for _, name := range names {
		data, err := os.ReadFile(filepath.Join(s.Dir, name))
		if err != nil {
			continue
		}
		var record Record
		if json.Unmarshal(data, &record) == nil && record.ID != "" {
			records = append(records, record)
		}
	}
	return records, nil
}
