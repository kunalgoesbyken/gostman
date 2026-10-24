package main

import (
	"os"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/engine"
)

func filesBeside(source string) engine.FileReader {
	root, err := filepath.Abs(source)
	if err != nil {
		root = source
	}
	if info, err := os.Stat(root); err == nil && !info.IsDir() {
		root = filepath.Dir(root)
	}
	return engine.FolderFiles(root)
}
