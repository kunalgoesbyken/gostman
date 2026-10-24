package main

import (
	"bytes"
	"encoding/json"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/runner/sandbox"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	exportPostman  = "postman"
	postmanBuilder = "exportToPostman"
	postmanFile    = "collection.postman_collection.json"
	postmanIndent  = "  "
)

type postmanOptions struct {
	DefaultName string             `json:"defaultName"`
	Variables   map[string]any     `json:"variables"`
	Settings    workspace.Settings `json:"settings"`
}

func exportPostmanCollection(source string, collection workspace.Collection, includeSecrets bool) ([]importer.File, error) {
	var placeholders []string
	if !includeSecrets {
		collection, placeholders = importer.RedactSecrets(collection)
	}
	options := postmanOptions{DefaultName: workspaceName(source), Variables: postmanVariables(collection.Variables, placeholders), Settings: collection.Settings}
	var exported json.RawMessage
	if err := sandbox.Render(postmanBuilder, &exported, collection.Requests, collection.Folders, options); err != nil {
		return nil, err
	}
	var indented bytes.Buffer
	if err := json.Indent(&indented, exported, "", postmanIndent); err != nil {
		return nil, err
	}
	return []importer.File{{Name: postmanFile, Text: indented.String() + "\n"}}, nil
}

func postmanVariables(source string, placeholders []string) map[string]any {
	values := map[string]any{}
	_ = json.Unmarshal([]byte(source), &values)
	for _, name := range placeholders {
		if _, present := values[name]; !present {
			values[name] = ""
		}
	}
	return values
}

func workspaceName(source string) string {
	absolute, err := filepath.Abs(source)
	if err != nil {
		return filepath.Base(source)
	}
	return filepath.Base(absolute)
}
