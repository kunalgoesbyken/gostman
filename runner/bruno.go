package runner

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/workspace"
)

var brunoMarkers = []string{"bruno.json", "opencollection.yml", "opencollection.yaml"}

func isBrunoCollection(root string) bool {
	for _, name := range brunoMarkers {
		if info, err := os.Stat(filepath.Join(root, name)); err == nil && info.Mode().IsRegular() {
			return true
		}
	}
	return false
}

func loadBruno(root string) (Collection, error) {
	files, err := importer.ReadPath(root, importer.DefaultMaxBytes)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the Bruno collection: %w", err)
	}
	result, err := importer.Import(context.Background(), files, importer.FormatBruno, importer.Options{InPlace: true}, importer.Config{})
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the Bruno collection: %w", err)
	}
	stored, err := result.Collection()
	if err != nil {
		return Collection{}, err
	}
	collection, err := FromWorkspace(stored)
	collection.DotEnv = brunoDotEnv(root)
	collection.Warnings = append(result.Warnings, result.Skipped...)
	return collection, err
}

func brunoDotEnv(root string) map[string]string {
	content, err := os.ReadFile(filepath.Join(root, workspace.DotEnvName))
	if err != nil {
		return map[string]string{}
	}
	return workspace.ParseDotEnv(content)
}
