package engine

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	fileEncodingBase64 = "Base64"
	homePrefix         = "~"
)

var fileReferenceRe = regexp.MustCompile(`^\$file(Base64)?\((.*)\)$`)

var (
	errFilesUnavailable = errors.New("{{$file(...)}} reads files only in the desktop app and the gostman command line")
	errRelativeFilePath = errors.New("open a workspace folder to use a relative path in {{$file(...)}}, or give an absolute path")
)

type FileReader func(path string) ([]byte, error)

type fileReference struct {
	path   string
	base64 bool
}

func parseFileReference(name string) (fileReference, bool) {
	found := fileReferenceRe.FindStringSubmatch(name)
	if found == nil {
		return fileReference{}, false
	}
	return fileReference{path: strings.TrimSpace(found[2]), base64: found[1] == fileEncodingBase64}, true
}

func (r fileReference) encode(data []byte) string {
	if r.base64 {
		return base64.StdEncoding.EncodeToString(data)
	}
	return string(data)
}

func refuseFiles(string) ([]byte, error) {
	return nil, errFilesUnavailable
}

func FolderFiles(root string) FileReader {
	return func(path string) ([]byte, error) {
		resolved, err := resolveFilePath(root, path)
		if err != nil {
			return nil, err
		}
		info, err := os.Stat(resolved)
		if err != nil {
			return nil, unreadable(path, resolved, err)
		}
		if info.IsDir() {
			return nil, fmt.Errorf("%q is a folder, not a file", path)
		}
		if info.Size() > maxRequestBody {
			return nil, fmt.Errorf("file %q is larger than 10 MB", path)
		}
		data, err := os.ReadFile(resolved)
		if err != nil {
			return nil, unreadable(path, resolved, err)
		}
		return data, nil
	}
}

func unreadable(path, resolved string, err error) error {
	if errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("file %q was not found at %s", path, resolved)
	}
	return fmt.Errorf("cannot read file %q: %w", path, err)
}

func resolveFilePath(root, path string) (string, error) {
	if path == "" {
		return "", errors.New("{{$file(...)}} needs a file path between the parentheses")
	}
	if path == homePrefix || strings.HasPrefix(path, homePrefix+"/") || strings.HasPrefix(path, homePrefix+`\`) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, path[len(homePrefix):]), nil
	}
	if filepath.IsAbs(path) {
		return filepath.Clean(path), nil
	}
	if root == "" {
		return "", errRelativeFilePath
	}
	return filepath.Join(root, path), nil
}
