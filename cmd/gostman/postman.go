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
	SharedOrder bool               `json:"sharedOrder"`
}

func exportPostmanCollection(source string, collection workspace.Collection, includeSecrets bool) ([]importer.File, importer.Report, error) {
	var placeholders []string
	if !includeSecrets {
		collection, placeholders = importer.RedactSecrets(collection)
	}
	collection, report, err := importer.AdaptScripts(importer.TargetPostman, collection)
	if err != nil {
		return nil, report, err
	}
	options := postmanOptions{DefaultName: workspaceName(source), Variables: postmanVariables(placeholders, collection.Variables, soleCollectionList(collection)), Settings: collection.Settings, SharedOrder: collection.SharedOrder}
	var exported json.RawMessage
	if err := sandbox.Render(postmanBuilder, &exported, collection.Requests, collection.Folders, options); err != nil {
		return nil, report, err
	}
	var indented bytes.Buffer
	if err := json.Indent(&indented, exported, "", postmanIndent); err != nil {
		return nil, report, err
	}
	return []importer.File{{Name: postmanFile, Text: indented.String() + "\n"}}, report, nil
}

func soleCollectionList(collection workspace.Collection) string {
	var top []workspace.Folder
	for _, folder := range collection.Folders {
		if folder.ParentId == "" {
			top = append(top, folder)
		}
	}
	for _, request := range collection.Requests {
		if request.FolderId == "" {
			return ""
		}
	}
	if len(top) != 1 {
		return ""
	}
	return top[0].CollectionVariables
}

func postmanVariables(placeholders []string, sources ...string) map[string]any {
	values := map[string]any{}
	for _, source := range sources {
		_ = json.Unmarshal([]byte(source), &values)
	}
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
