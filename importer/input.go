package importer

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/unicode"
)

const (
	DefaultMaxBytes = 32 << 20
	maxFiles        = 5000
	maxFolderDepth  = 32
	maxRequests     = 20000
	maxNameRunes    = 200
	maxMethodLength = 16
)

var (
	byteOrderMark = []byte{0xef, 0xbb, 0xbf}
	errBinary     = errors.New("the content is binary, not text")
	errEmpty      = errors.New("the content is empty")

	folderExtensions = map[string]bool{".bru": true, ".json": true, ".yml": true, ".yaml": true, ".xml": true, ".wsdl": true, ".xsd": true, ".har": true, httpExtension: true, restExtension: true}
)

type File struct {
	Name string `json:"name"`
	Text string `json:"text"`
}

func DecodeText(data []byte) (string, error) {
	if len(data) >= 2 && (data[0] == 0xff && data[1] == 0xfe || data[0] == 0xfe && data[1] == 0xff) {
		decoded, err := unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewDecoder().Bytes(data)
		if err != nil {
			return "", err
		}
		data = decoded
	}
	if !utf8.Valid(data) || bytes.IndexByte(data, 0) >= 0 {
		return "", errBinary
	}
	return string(bytes.TrimPrefix(data, byteOrderMark)), nil
}

func readLimited(reader io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("the content is larger than %d MB", limit>>20)
	}
	return data, nil
}

func readFile(path string, limit int64) (File, error) {
	handle, err := os.Open(path)
	if err != nil {
		return File{}, err
	}
	defer handle.Close()
	data, err := readLimited(handle, limit)
	if err != nil {
		return File{}, fmt.Errorf("%s: %w", path, err)
	}
	text, err := DecodeText(data)
	if err != nil {
		return File{}, fmt.Errorf("%s: %w", path, err)
	}
	return File{Name: filepath.Base(path), Text: text}, nil
}

func ReadPath(path string, limit int64) ([]File, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		file, err := readFile(path, limit)
		return []File{file}, err
	}
	return readFolder(path, limit)
}

func readFolder(root string, limit int64) ([]File, error) {
	var files []File
	remaining := limit
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() && path != root && strings.HasPrefix(entry.Name(), ".") {
			return filepath.SkipDir
		}
		if !entry.Type().IsRegular() || !folderExtensions[strings.ToLower(filepath.Ext(path))] {
			return nil
		}
		if len(files) >= maxFiles {
			return fmt.Errorf("the folder has more than %d files", maxFiles)
		}
		file, err := readFile(path, remaining)
		if err != nil {
			return err
		}
		remaining -= int64(len(file.Text))
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		file.Name = filepath.ToSlash(relative)
		files = append(files, file)
		return nil
	})
	return files, err
}

func checkSize(files []File, limit int64) error {
	if len(files) == 0 {
		return errEmpty
	}
	if len(files) > maxFiles {
		return fmt.Errorf("there are more than %d files", maxFiles)
	}
	var total int64
	for _, file := range files {
		total += int64(len(file.Text))
	}
	if total > limit {
		return fmt.Errorf("the content is larger than %d MB", limit>>20)
	}
	return nil
}
