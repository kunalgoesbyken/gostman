package importer

import (
	"context"
	"errors"
	"fmt"

	"github.com/kunalgoesbyken/gostman/locales"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	ActionImport = "import"
	ActionExport = "export"
	ActionAdapt  = "adapt"
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
	Files      []File                `json:"files,omitempty"`
	Archive    string                `json:"archive,omitempty"`
	Collection *workspace.Collection `json:"collection,omitempty"`
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
		files, archive, report, err := Export(query.Format, *query.Collection, query.Options)
		if err != nil {
			return Reply{Error: err.Error()}
		}
		return Reply{Files: files, Archive: archive, Result: Result{Notes: report.Notes, Warnings: report.Warnings}}
	case ActionAdapt:
		if query.Collection == nil {
			return Reply{Error: "give a collection to adapt"}
		}
		adapted, report, err := AdaptScripts(query.Format, *query.Collection)
		if err != nil {
			return Reply{Error: err.Error()}
		}
		return Reply{Collection: &adapted, Result: Result{Notes: report.Notes, Warnings: report.Warnings}}
	}
	return Reply{Error: fmt.Sprintf("unknown action %q", query.Action)}
}

func Import(ctx context.Context, files []File, format string, options Options, config Config) (Result, error) {
	if err := checkSize(files, config.limit()); err != nil {
		return Result{}, err
	}
	c := newCollector()
	c.inPlace = options.InPlace
	files, c.protos = splitProtoFiles(files)
	docs := c.accept(files, format)
	c.importDocuments(ctx, docs, options, config)
	result := c.result()
	if len(result.Requests) == 0 && len(result.Folders) == 0 && len(result.Environments) == 0 && len(result.Globals) == 0 {
		return Result{}, emptyError(files, result)
	}
	return result, nil
}

func emptyError(files []File, result Result) error {
	if len(files) == 1 && len(result.Skipped) == 1 {
		return errors.New(result.Skipped[0])
	}
	return locales.Errorf(locales.ImporterEmpty, nil)
}

func (c *collector) accept(files []File, format string) []document {
	var accepted []document
	for _, file := range files {
		doc := classify(file)
		switch {
		case doc.err != nil:
			c.skip(locales.ImporterSkipFileError, locales.Params{"file": file.Name, "detail": doc.err.Error()})
		case doc.kind == kindUnknown:
			c.skip(locales.ImporterNotRecognized, locales.Params{"file": file.Name})
		case format != "" && format != FormatAuto && kindFormats[doc.kind] != format:
			c.skip(locales.ImporterNotFormat, locales.Params{"file": file.Name, "format": format})
		case kindFormats[doc.kind] == "":
			c.skip(locales.ImporterNotRecognized, locales.Params{"file": file.Name})
		default:
			accepted = append(accepted, doc)
		}
	}
	return accepted
}

func (c *collector) importDocuments(ctx context.Context, docs []document, options Options, config Config) {
	var bruno, open, supporting, httpDocs []document
	for _, doc := range docs {
		switch {
		case doc.kind == kindBruno || doc.kind == kindBrunoConfig:
			bruno = append(bruno, doc)
		case doc.kind == kindHTTP || doc.kind == kindHTTPEnvironment:
			httpDocs = append(httpDocs, doc)
		case doc.kind == kindOpenItem || doc.kind == kindOpenEnvironment || doc.kind == kindOpenCollection && !bundled(doc):
			open = append(open, doc)
		case doc.kind == kindSchema:
			supporting = append(supporting, doc)
		}
	}
	for _, doc := range docs {
		switch doc.kind {
		case kindGostman:
			c.readGostman(doc)
		case kindInsomnia:
			c.readInsomnia(ctx, doc, config)
		case kindBrunoEnvironment:
			c.readBrunoEnvironments(doc)
		case kindHAR:
			c.readHAR(doc, options)
		case kindWSDL:
			c.readWSDL(doc, supporting)
		case kindPostmanCollection:
			c.readPostmanCollection(doc)
		case kindPostmanEnvironment:
			c.readPostmanEnvironment(doc)
		case kindPostmanDump:
			c.readPostmanDump(doc)
		case kindOpenCollection:
			if bundled(doc) {
				c.readOpenCollection(doc)
			}
		case kindOpenAPI:
			c.readOpenAPI(ctx, doc, config)
		}
	}
	c.scopePostmanEnvironments()
	if len(bruno) > 0 {
		c.readBruno(bruno)
	}
	if len(open) > 0 {
		c.readOpenFolders(open)
	}
	if len(httpDocs) > 0 {
		c.readHTTP(httpDocs)
	}
}
