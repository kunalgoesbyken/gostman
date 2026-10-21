package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/krockxz/gostman/importer"
	"github.com/krockxz/gostman/openapi"
	"github.com/krockxz/gostman/workspace"
)

const (
	importMaxBytes   = 64 << 20
	exportFilePerm   = 0o644
	exportFolderPerm = 0o755
)

type transfer struct {
	source string
	format string
	out    string
	skip   bool
}

func parseTransfer(name string, arguments []string, defaultFormat string) (transfer, error) {
	parsed := transfer{}
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.format, "format", defaultFormat, "")
	flags.StringVar(&parsed.out, "out", "", "")
	flags.BoolVar(&parsed.skip, "skip-static", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 1 {
		return parsed, errors.New("name one input")
	}
	if parsed.out == "" {
		return parsed, errors.New("--out is required")
	}
	parsed.source = positional[0]
	return parsed, nil
}

func importCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseTransfer("import", arguments, importer.FormatAuto)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	files, err := importer.ReadPath(parsed.source, importMaxBytes)
	if err != nil {
		return complain(stderr, err)
	}
	config := importer.Config{OpenAPI: openapi.Options{AllowFiles: true}, MaxBytes: importMaxBytes}
	result, err := importer.Import(context.Background(), files, parsed.format, importer.Options{SkipStatic: parsed.skip}, config)
	if err != nil {
		return complain(stderr, err)
	}
	collection, err := importedCollection(result)
	if err != nil {
		return complain(stderr, err)
	}
	if _, err := workspace.Create(parsed.out, collection); err != nil {
		return complain(stderr, err)
	}
	reportImport(stdout, stderr, result, parsed.out)
	return exitPassed
}

func importedCollection(result importer.Result) (workspace.Collection, error) {
	collection := workspace.Collection{Requests: result.Requests, Folders: result.Folders, Environments: result.Environments}
	if len(result.Variables) == 0 {
		return collection, nil
	}
	encoded, err := json.Marshal(result.Variables)
	collection.Variables = string(encoded)
	return collection, err
}

func reportImport(stdout, stderr io.Writer, result importer.Result, out string) {
	fmt.Fprintf(stdout, "Imported %d requests, %d folders and %d environments into %s.\n", len(result.Requests), len(result.Folders), len(result.Environments), out)
	for _, warning := range result.Warnings {
		fmt.Fprintf(stderr, "warning: %s\n", warning)
	}
	for _, skipped := range result.Skipped {
		fmt.Fprintf(stderr, "skipped: %s\n", skipped)
	}
}

func exportCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseTransfer("export", arguments, "")
	if err != nil {
		return misuse(stderr, err.Error())
	}
	opened, err := workspace.Open(parsed.source)
	if err != nil {
		return complain(stderr, err)
	}
	files, _, err := importer.Export(parsed.format, opened.Collection())
	if err != nil {
		return complain(stderr, err)
	}
	if err := writeExport(files, parsed.out); err != nil {
		return complain(stderr, err)
	}
	fmt.Fprintf(stdout, "Exported %d files to %s.\n", len(files), parsed.out)
	return exitPassed
}

func writeExport(files []importer.File, out string) error {
	if len(files) == 1 {
		return os.WriteFile(out, []byte(files[0].Text), exportFilePerm)
	}
	for _, file := range files {
		target := filepath.Join(out, filepath.FromSlash(file.Name))
		if err := os.MkdirAll(filepath.Dir(target), exportFolderPerm); err != nil {
			return err
		}
		if err := os.WriteFile(target, []byte(file.Text), exportFilePerm); err != nil {
			return err
		}
	}
	return nil
}
