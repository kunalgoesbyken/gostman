package runner

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/krockxz/gostman/engine"
)

const byteOrderMark = "\xef\xbb\xbf"

type Collection struct {
	Requests     []json.RawMessage `json:"requests"`
	Folders      []Folder          `json:"folders"`
	Environments []Environment     `json:"environments"`
}

type Folder struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parentId"`
}

type Environment struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Variables string `json:"variables"`
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
}

type exportFile struct {
	Gostman *Collection `json:"gostman"`
}

func Load(path string) (Collection, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return Collection{}, fmt.Errorf("cannot read the collection: %w", err)
	}
	var file exportFile
	if err := json.Unmarshal(bytes.TrimPrefix(content, []byte(byteOrderMark)), &file); err != nil {
		return Collection{}, fmt.Errorf("%s is not a Gostman export: %w", path, err)
	}
	if file.Gostman == nil {
		return Collection{}, fmt.Errorf("%s is not a Gostman export: it has no \"gostman\" object", path)
	}
	return *file.Gostman, nil
}
