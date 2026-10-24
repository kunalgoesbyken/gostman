package main

import (
	"flag"
	"os"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/engine"
)

type fileAccess struct {
	allowed bool
}

func (f *fileAccess) register(flags *flag.FlagSet) {
	flags.BoolVar(&f.allowed, "allow-files", false, "")
}

func (f fileAccess) beside(source string) engine.FileReader {
	if !f.allowed {
		return nil
	}
	root, err := filepath.Abs(source)
	if err != nil {
		root = source
	}
	if info, err := os.Stat(root); err == nil && !info.IsDir() {
		root = filepath.Dir(root)
	}
	return engine.FolderFiles(root)
}
