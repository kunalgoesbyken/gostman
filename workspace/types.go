package workspace

import (
	"fmt"

	"github.com/kunalgoesbyken/gostman/engine"
)

type Request struct {
	Id               string         `json:"id"`
	Name             string         `json:"name"`
	Description      string         `json:"description"`
	Tags             []string       `json:"tags,omitempty"`
	URL              string         `json:"url"`
	Method           string         `json:"method"`
	Headers          string         `json:"headers"`
	Body             string         `json:"body"`
	BodyType         string         `json:"bodyType"`
	QueryParams      string         `json:"queryParams"`
	FolderId         string         `json:"folderId"`
	GraphqlQuery     string         `json:"graphqlQuery"`
	GraphqlVariables string         `json:"graphqlVariables"`
	Auth             engine.Auth    `json:"auth"`
	Options          engine.Options `json:"options"`
	Extractors       string         `json:"extractors"`
	Assertions       string         `json:"assertions"`
	Examples         string         `json:"examples"`
	PreScript        string         `json:"preScript"`
	PostScript       string         `json:"postScript"`
	GrpcMethod       string         `json:"grpcMethod"`
	GrpcMessage      string         `json:"grpcMessage"`
	GrpcProtos       string         `json:"grpcProtos"`
	McpMethod        string         `json:"mcpMethod"`
	McpTool          string         `json:"mcpTool"`
	McpArguments     string         `json:"mcpArguments"`
	SocketProtocol   string         `json:"socketProtocol"`
	SocketMessages   string         `json:"socketMessages"`
	Vars             string         `json:"vars"`
	Timestamp        string         `json:"timestamp"`
	SortOrder        int64          `json:"sortOrder"`
}

type Settings struct {
	Description     string      `json:"description"`
	Headers         string      `json:"headers"`
	Auth            engine.Auth `json:"auth"`
	PreScript       string      `json:"preScript"`
	PostScript      string      `json:"postScript"`
	Assertions      string      `json:"assertions"`
	ScriptTimeoutMs int64       `json:"scriptTimeoutMs,omitempty"`
}

type Folder struct {
	Id        string   `json:"id"`
	Name      string   `json:"name"`
	ParentId  string   `json:"parentId"`
	SortOrder int64    `json:"sortOrder"`
	Variables string   `json:"variables"`
	Color     string   `json:"color,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Settings
	CollectionVariables     string `json:"collectionVariables,omitempty"`
	CollectionVariablesMeta string `json:"collectionVariablesMeta,omitempty"`
}

type Environment struct {
	Id        string `json:"id"`
	Name      string `json:"name"`
	Variables string `json:"variables"`
	Color     string `json:"color"`
	Extends   string `json:"extends"`
	Meta      string `json:"meta"`
	FolderId  string `json:"folderId,omitempty"`
}

type Collection struct {
	Requests      []Request     `json:"requests"`
	Folders       []Folder      `json:"folders"`
	Environments  []Environment `json:"environments"`
	Variables     string        `json:"variables,omitempty"`
	VariablesMeta string        `json:"variablesMeta,omitempty"`
	Settings      Settings      `json:"settings"`
	SharedOrder   bool          `json:"sharedOrder,omitempty"`
}

type Problem struct {
	Path    string `json:"path"`
	Line    int    `json:"line"`
	Message string `json:"message"`
}

func (p Problem) String() string {
	if p.Line > 0 {
		return fmt.Sprintf("%s (line %d): %s", p.Path, p.Line, p.Message)
	}
	return p.Path + ": " + p.Message
}
