package importer

import (
	"context"
	"errors"
	"fmt"

	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	ActionImport = "import"
	ActionExport = "export"
)

type Config struct {
	OpenAPI  openapi.Options
	MaxBytes int64
}

type Query struct {
	Action     string                `json:"action"`
	Format     string                `json:"format"`
	Files      []File                `json:"files"`
	Options    Options               `json:"options"`
	Collection *workspace.Collection `json:"collection"`
}

type Reply struct {
	Error string `json:"error,omitempty"`
	Result
	Files   []File `json:"files,omitempty"`
	Archive string `json:"archive,omitempty"`
}

func (c Config) limit() int64 {
	if c.MaxBytes > 0 {
		return c.MaxBytes
	}
	return DefaultMaxBytes
}

func Handle(ctx context.Context, query Query, config Config) Reply {
	switch query.Action {
	case ActionImport:
		result, err := Import(ctx, query.Files, query.Format, query.Options, config)
		if err != nil {
			return Reply{Error: err.Error()}
		}
		return Reply{Result: result}
	case ActionExport:
		if query.Collection == nil {
			return Reply{Error: "give a collection to export"}
		}
		files, archive, err := Export(query.Format, *query.Collection, query.Options)
		if err != nil {
			return Reply{Error: err.Error()}
		}
		return Reply{Files: files, Archive: archive}
	}
	return Reply{Error: fmt.Sprintf("unknown action %q", query.Action)}
}

func Import(ctx context.Context, files []File, format string, options Options, config Config) (Result, error) {
	if err := checkSize(files, config.limit()); err != nil {
		return Result{}, err
	}
	c := newCollector()
	docs := c.accept(files, format)
	c.importDocuments(ctx, docs, options, config)
	result := c.result()
	if len(result.Requests) == 0 && len(result.Folders) == 0 && len(result.Environments) == 0 {
		return Result{}, emptyError(files, result)
	}
	return result, nil
}

func emptyError(files []File, result Result) error {
	if len(files) == 1 && len(result.Skipped) == 1 {
		return errors.New(result.Skipped[0])
	}
	return errors.New(messageEmpty)
}

func (c *collector) accept(files []File, format string) []document {
	var accepted []document
	for _, file := range files {
		doc := classify(file)
		switch {
		case doc.err != nil:
			c.skip("%s: %v", file.Name, doc.err)
		case doc.kind == kindUnknown:
			c.skip(messageNotRecognized, file.Name)
		case format != "" && format != FormatAuto && kindFormats[doc.kind] != format:
			c.skip(messageNotFormat, file.Name, format)
		case kindFormats[doc.kind] == "":
			c.skip(messageNotRecognized, file.Name)
		default:
			accepted = append(accepted, doc)
		}
	}
	return accepted
}

func (c *collector) importDocuments(ctx context.Context, docs []document, options Options, config Config) {
	var bruno, supporting []document
	for _, doc := range docs {
		switch doc.kind {
		case kindBruno, kindBrunoConfig:
			bruno = append(bruno, doc)
		case kindSchema:
			supporting = append(supporting, doc)
		}
	}
	for _, doc := range docs {
		switch doc.kind {
		case kindGostman:
			c.readGostman(doc)
		case kindInsomnia:
			c.readInsomnia(doc)
		case kindHAR:
			c.readHAR(doc, options)
		case kindWSDL:
			c.readWSDL(doc, supporting)
		case kindPostmanCollection:
			c.readPostmanCollection(doc)
		case kindPostmanEnvironment:
			c.readPostmanEnvironment(doc)
		case kindOpenCollection:
			c.readOpenCollection(doc)
		case kindOpenAPI:
			c.readOpenAPI(ctx, doc, config)
		}
	}
	if len(bruno) > 0 {
		c.readBruno(bruno)
	}
}
