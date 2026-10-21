package workspace

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

const (
	MaxModuleFiles = 200
	MaxModuleBytes = 1_000_000
	maxModuleFile  = 256 << 10
	nodeModules    = "node_modules"
)

var (
	moduleExtensions = map[string]bool{".js": true, ".json": true}

	ErrModulesTooMany = fmt.Errorf("the folder has more than %d script files", MaxModuleFiles)
	ErrModulesTooBig  = fmt.Errorf("the script files together are larger than %d KB", MaxModuleBytes/1000)
)

func ReadScriptModules(root string) (map[string]string, error) {
	base, err := filepath.EvalSymlinks(root)
	if err != nil {
		return nil, err
	}
	modules := map[string]string{}
	total := 0
	walk := func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return skipDirectory(base, path, entry)
		}
		if !entry.Type().IsRegular() || !moduleExtensions[strings.ToLower(filepath.Ext(path))] {
			return nil
		}
		return addModule(base, path, modules, &total)
	}
	if err := filepath.WalkDir(base, walk); err != nil {
		return nil, err
	}
	return modules, nil
}

func skipDirectory(base, path string, entry fs.DirEntry) error {
	if path != base && (strings.HasPrefix(entry.Name(), hiddenPrefix) || entry.Name() == nodeModules) {
		return filepath.SkipDir
	}
	return nil
}

func addModule(base, path string, modules map[string]string, total *int) error {
	relative, err := filepath.Rel(base, path)
	if err != nil || !filepath.IsLocal(relative) {
		return nil
	}
	info, err := os.Stat(path)
	if err != nil || info.Size() > maxModuleFile {
		return nil
	}
	if len(modules) >= MaxModuleFiles {
		return ErrModulesTooMany
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if !utf8.Valid(content) {
		return nil
	}
	*total += len(content)
	if *total > MaxModuleBytes {
		return ErrModulesTooBig
	}
	modules[filepath.ToSlash(relative)] = string(content)
	return nil
}
