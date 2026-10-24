package engine

import (
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

const (
	fileEncodingBase64 = "Base64"
	homePrefix         = "~"
)

var fileReferenceRe = regexp.MustCompile(`^\$file(Base64)?\((.*)\)$`)

var (
	errFilesUnavailable = errors.New("{{$file(...)}} reads files only in the desktop app, or in gostman run, send and load with --allow-files")
	errRelativeFilePath = errors.New("open a workspace folder to use a relative path in {{$file(...)}}, or give an absolute path")
	errFilesHTTPOnly    = errors.New("{{$file(...)}} reads files only in HTTP and GraphQL requests")
)

type FileReader func(path string) ([]byte, error)

type fileReference struct {
	path   string
	base64 bool
}

func ReadsFiles(text string) bool {
	for _, match := range placeholderRe.FindAllStringSubmatch(text, -1) {
		if _, ok := parseFileReference(strings.TrimSpace(match[1])); ok {
			return true
		}
	}
	decoded, err := decodeJSON(text)
	return err == nil && (attachesFile(decoded) || anyText(decoded, ReadsFiles))
}

func attachesFile(value any) bool {
	switch typed := value.(type) {
	case []any:
		return slices.ContainsFunc(typed, attachesFile)
	case map[string]any:
		path, isText := typed["path"].(string)
		_, isFile := typed["fileName"]
		return isFile && isText && path != ""
	}
	return false
}

func anyText(value any, test func(string) bool) bool {
	switch typed := value.(type) {
	case string:
		return test(typed)
	case []any:
		return slices.ContainsFunc(typed, func(item any) bool { return anyText(item, test) })
	case map[string]any:
		for key, item := range typed {
			if test(key) || anyText(item, test) {
				return true
			}
		}
	}
	return false
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

func refusing(reason error) FileReader {
	return func(string) ([]byte, error) {
		return nil, reason
	}
}

func FolderFiles(root string) FileReader {
	return func(path string) ([]byte, error) {
		if err := requirePath(path); err != nil {
			return nil, err
		}
		if isHomePath(path) || !filepath.IsLocal(path) {
			return nil, fmt.Errorf("%q is outside the collection folder; a collection reads only files inside its folder", path)
		}
		folder, err := os.OpenRoot(root)
		if err != nil {
			return nil, err
		}
		defer folder.Close()
		file, err := folder.Open(path)
		if err != nil {
			return nil, unreadable(path, filepath.Join(root, path), err)
		}
		defer file.Close()
		return readFile(path, file)
	}
}

func LocalFiles() FileReader {
	return func(path string) ([]byte, error) {
		file, err := openLocal(path)
		if err != nil {
			return nil, err
		}
		defer file.Close()
		return readFile(path, file)
	}
}

func openLocal(path string) (*os.File, error) {
	resolved, err := localPath(path)
	if err != nil {
		return nil, err
	}
	file, err := os.Open(resolved)
	if err != nil {
		return nil, unreadable(path, resolved, err)
	}
	return file, nil
}

func readFile(path string, file *os.File) ([]byte, error) {
	info, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("cannot read file %q: %w", path, err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("%q is a folder, not a file", path)
	}
	data, err := io.ReadAll(io.LimitReader(file, maxRequestBody+1))
	if err != nil {
		return nil, fmt.Errorf("cannot read file %q: %w", path, err)
	}
	if len(data) > maxRequestBody {
		return nil, fmt.Errorf("file %q is larger than 10 MB", path)
	}
	return data, nil
}

func unreadable(path, resolved string, err error) error {
	if errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("file %q was not found at %s", path, resolved)
	}
	return fmt.Errorf("cannot read file %q: %w", path, err)
}

func requirePath(path string) error {
	if path == "" {
		return errors.New("{{$file(...)}} needs a file path between the parentheses")
	}
	return nil
}

func isHomePath(path string) bool {
	return path == homePrefix || strings.HasPrefix(path, homePrefix+"/") || strings.HasPrefix(path, homePrefix+`\`)
}

func localPath(path string) (string, error) {
	if err := requirePath(path); err != nil {
		return "", err
	}
	if isHomePath(path) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, path[len(homePrefix):]), nil
	}
	if !filepath.IsAbs(path) {
		return "", errRelativeFilePath
	}
	return filepath.Clean(path), nil
}
