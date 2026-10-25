package workspace

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

const (
	temporaryPattern = ".gostman-*.tmp"
	filePermissions  = 0644
	dirPermissions   = 0755
)

type disk struct {
	root string
}

func (d disk) requirePlainDirectories(relative string) error {
	current := d.root
	for _, name := range strings.Split(relative, "/") {
		current = filepath.Join(current, name)
		info, err := os.Lstat(current)
		if err != nil {
			return err
		}
		if info.Mode().Type() != fs.ModeDir {
			return fmt.Errorf("%s is a link or special file, so nothing inside it is read or written", current)
		}
	}
	return nil
}

func (d disk) resolve(relative string) (string, error) {
	if relative == "" {
		return d.root, nil
	}
	if !filepath.IsLocal(filepath.FromSlash(relative)) {
		return "", fmt.Errorf("%q is not a path inside the workspace folder", relative)
	}
	if parent := parentOf(path.Clean(relative)); parent != "" {
		if err := d.requirePlainDirectories(parent); err != nil {
			return "", err
		}
	}
	return filepath.Join(d.root, filepath.FromSlash(relative)), nil
}

func (d disk) list(relative string) ([]fs.DirEntry, error) {
	directory, err := d.resolve(relative)
	if err != nil {
		return nil, err
	}
	if relative != "" {
		if err := d.requirePlainDirectories(relative); err != nil {
			return nil, err
		}
	}
	return os.ReadDir(directory)
}

func (d disk) read(relative string) ([]byte, error) {
	target, err := d.resolve(relative)
	if err != nil {
		return nil, err
	}
	info, err := os.Lstat(target)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("%s is not a regular file", relative)
	}
	return os.ReadFile(target)
}

func (d disk) readListed(relative string) ([]byte, error) {
	return os.ReadFile(filepath.Join(d.root, filepath.FromSlash(relative)))
}

func (d disk) listWalked(relative string) ([]fs.DirEntry, error) {
	return os.ReadDir(filepath.Join(d.root, filepath.FromSlash(relative)))
}

func (d disk) readWalked(relative string) ([]byte, error) {
	target := filepath.Join(d.root, filepath.FromSlash(relative))
	info, err := os.Lstat(target)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("%s is not a regular file", relative)
	}
	return os.ReadFile(target)
}

func (d disk) exists(relative string) bool {
	target, err := d.resolve(relative)
	if err != nil {
		return true
	}
	_, err = os.Lstat(target)
	return !errors.Is(err, fs.ErrNotExist)
}

func writeTemporary(directory string, content []byte) (string, error) {
	file, err := os.CreateTemp(directory, temporaryPattern)
	if err != nil {
		return "", err
	}
	_, err = file.Write(content)
	if err == nil {
		err = file.Sync()
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Chmod(file.Name(), filePermissions)
	}
	if err != nil {
		os.Remove(file.Name())
		return "", err
	}
	return file.Name(), nil
}

func (d disk) write(relative string, content []byte) error {
	target, err := d.resolve(relative)
	if err != nil {
		return err
	}
	temporary, err := writeTemporary(filepath.Dir(target), content)
	if err != nil {
		return err
	}
	if err := os.Rename(temporary, target); err != nil {
		os.Remove(temporary)
		return err
	}
	return nil
}

func (d disk) move(from, to string) error {
	source, err := d.resolve(from)
	if err != nil {
		return err
	}
	target, err := d.resolve(to)
	if err != nil {
		return err
	}
	return os.Rename(source, target)
}

func (d disk) remove(relative string) error {
	target, err := d.resolve(relative)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if err := os.Remove(target); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	}
	return nil
}

func (d disk) makeDirectory(relative string) error {
	target, err := d.resolve(relative)
	if err != nil {
		return err
	}
	return os.MkdirAll(target, dirPermissions)
}

func joinPath(directory, name string) string {
	return path.Join(directory, name)
}

func parentOf(relative string) string {
	directory := path.Dir(relative)
	if directory == "." {
		return ""
	}
	return directory
}

func isWithin(relative, directory string) bool {
	return relative == directory || strings.HasPrefix(relative, directory+"/")
}

func rebase(relative, from, to string) string {
	if !isWithin(relative, from) {
		return relative
	}
	return to + strings.TrimPrefix(relative, from)
}
