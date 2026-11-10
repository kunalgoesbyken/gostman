package engine

import (
	"encoding/base64"
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/locales"
)

const homePrefix = "~"

var (
	errFilesUnavailable = locales.Errorf(locales.EngineFilesUnavailable, fileExample())
	errRelativeFilePath = locales.Errorf(locales.EngineFilesRelativePath, fileExample())
	errFilesHTTPOnly    = locales.Errorf(locales.EngineFilesHttpOnly, fileExample())
)

type FileReader func(path string) ([]byte, error)

type fileMode int

const (
	readText fileMode = iota
	readBase64
	readTemplate
)

var fileModes = map[string]fileMode{
	"$file":       readText,
	"$fileBase64": readBase64,
	"$template":   readTemplate,
}

type fileReference struct {
	path string
	mode fileMode
}

func ReadsFiles(text string) bool {
	for _, match := range placeholderRe.FindAllStringSubmatch(text, -1) {
		if readsFile(strings.TrimSpace(match[1])) {
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

func readsFile(name string) bool {
	invocation, isCall := parseCall(name)
	if !isCall {
		return false
	}
	if _, isFile := fileModes[invocation.name]; isFile {
		return true
	}
	_, isEncoder := encoders[invocation.name]
	return isEncoder && readsFile(strings.TrimSpace(invocation.argument))
}

func fileReferenceOf(invocation call) (fileReference, bool) {
	mode, isFile := fileModes[invocation.name]
	return fileReference{path: strings.TrimSpace(invocation.argument), mode: mode}, isFile
}

func (r fileReference) encode(data []byte) string {
	if r.mode == readBase64 {
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
		if err := requireDrivePath(path); err != nil {
			return nil, err
		}
		if isHomePath(path) || !filepath.IsLocal(path) {
			return nil, locales.Errorf(locales.EngineFilesOutsideFolder, locales.Params{"path": path})
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
		return nil, locales.Wrap(locales.EngineFilesUnreadable, locales.Params{"path": path}, err)
	}
	if info.IsDir() {
		return nil, locales.Errorf(locales.EngineFilesIsFolder, locales.Params{"path": path})
	}
	data, err := io.ReadAll(io.LimitReader(file, maxRequestBody+1))
	if err != nil {
		return nil, locales.Wrap(locales.EngineFilesUnreadable, locales.Params{"path": path}, err)
	}
	if len(data) > maxRequestBody {
		return nil, locales.Errorf(locales.EngineFilesTooLarge, locales.Params{"path": path})
	}
	return data, nil
}

func unreadable(path, resolved string, err error) error {
	if errors.Is(err, fs.ErrNotExist) {
		return locales.Errorf(locales.EngineFilesNotFound, locales.Params{"path": path, "resolved": resolved})
	}
	return locales.Wrap(locales.EngineFilesUnreadable, locales.Params{"path": path}, err)
}

func requirePath(path string) error {
	if path == "" {
		return locales.Errorf(locales.EngineFilesPathMissing, fileExample())
	}
	return nil
}

func requireDrivePath(path string) error {
	if err := requirePath(path); err != nil {
		return err
	}
	if isNetworkPath(path) || isDeviceName(filepath.Clean(path)) {
		return locales.Errorf(locales.EngineFilesNetworkPath, locales.Params{"path": path})
	}
	return nil
}

func isNetworkPath(path string) bool {
	startsDoubled := len(path) >= 2 && isSeparator(path[0]) && isSeparator(path[1])
	return startsDoubled || len(filepath.VolumeName(path)) > len("C:")
}

func isSeparator(char byte) bool {
	return char == '/' || char == '\\'
}

func isDeviceName(path string) bool {
	base := filepath.Base(path)
	return !slices.Contains([]string{".", "..", string(filepath.Separator)}, base) && !filepath.IsLocal(base)
}

func isHomePath(path string) bool {
	return path == homePrefix || strings.HasPrefix(path, homePrefix+"/") || strings.HasPrefix(path, homePrefix+`\`)
}

func localPath(path string) (string, error) {
	if err := requireDrivePath(path); err != nil {
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

func fileExample() locales.Params {
	return locales.Params{"example": "{{$file(...)}}"}
}
