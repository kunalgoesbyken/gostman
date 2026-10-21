package main

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/openapi/lint"
)

func workspaceLintConfig() (string, error) {
	folder := openFolder()
	if folder == nil {
		return "", nil
	}
	data, err := os.ReadFile(filepath.Join(folder.Root(), lint.ConfigFileName))
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	return string(data), err
}

func (a *App) LintSpec(query lint.Query) lint.Reply {
	if query.Config == "" {
		config, err := workspaceLintConfig()
		if err != nil {
			return lint.Reply{Error: err.Error()}
		}
		query.Config = config
	}
	return lint.Handle(a.ctx, query, openapi.Options{Policy: a.policy(), AllowFiles: true})
}
