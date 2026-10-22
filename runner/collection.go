package runner

import (
	"encoding/json"
	"fmt"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const byteOrderMark = "\xef\xbb\xbf"

type Collection struct {
	Requests     []json.RawMessage  `json:"requests"`
	Folders      []Folder           `json:"folders"`
	Environments []Environment      `json:"environments"`
	Variables    string             `json:"variables"`
	Settings     workspace.Settings `json:"settings"`
	DotEnv       map[string]string  `json:"-"`
	Modules      map[string]string  `json:"-"`
}

type Folder struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ParentID  string `json:"parentId"`
	Variables string `json:"variables"`
	workspace.Settings
}

type Environment struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Variables string `json:"variables"`
	Extends   string `json:"extends"`
	Meta      string `json:"meta"`
}

type Request struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	URL              string         `json:"url"`
	Method           string         `json:"method"`
	Headers          string         `json:"headers"`
	Body             string         `json:"body"`
	BodyType         string         `json:"bodyType"`
	QueryParams      string         `json:"queryParams"`
	FolderID         string         `json:"folderId"`
	GraphqlQuery     string         `json:"graphqlQuery"`
	GraphqlVariables string         `json:"graphqlVariables"`
	Auth             engine.Auth    `json:"auth"`
	Options          engine.Options `json:"options"`
	Extractors       string         `json:"extractors"`
	Assertions       string         `json:"assertions"`
	PreScript        string         `json:"preScript"`
	PostScript       string         `json:"postScript"`
	GrpcMethod       string         `json:"grpcMethod"`
	GrpcMessage      string         `json:"grpcMessage"`
	GrpcProtos       string         `json:"grpcProtos"`
	McpTool          string         `json:"mcpTool"`
	McpArguments     string         `json:"mcpArguments"`
	SocketProtocol   string         `json:"socketProtocol"`
	SocketMessages   string         `json:"socketMessages"`
	Vars             string         `json:"vars"`
	Lineage          []Folder       `json:"-"`
}

type exportFile struct {
	Gostman *Collection `json:"gostman"`
}

func Load(path string) (Collection, error) {
	if isDirectory(path) {
		return loadWorkspace(path)
	}
	content, err := ReadText(path)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the collection: %w", err)
	}
	var file exportFile
	if err := json.Unmarshal(content, &file); err != nil {
		return Collection{}, fmt.Errorf("%s is not a Gostman export: %w", path, err)
	}
	if file.Gostman == nil {
		return Collection{}, fmt.Errorf("%s is not a Gostman export: it has no \"gostman\" object", path)
	}
	return *file.Gostman, nil
}
