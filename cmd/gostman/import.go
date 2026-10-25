package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	importMaxBytes   = 64 << 20
	exportFilePerm   = 0o600
	exportFolderPerm = 0o700
)

type transfer struct {
	source string
	format string
	out    string
	skip   bool
	secret bool
}

var transferSubjects = map[string]string{"import": "file or folder to import", "export": "workspace folder to export"}

var importFormats = []string{
	importer.FormatAuto, importer.FormatInsomnia, importer.FormatHAR, importer.FormatWSDL, importer.FormatBruno,
	importer.FormatPostman, importer.FormatOpenAPI, importer.FormatGostman, importer.FormatHTTP,
}

func checkImportFormat(format string) error {
	if slices.Contains(importFormats, format) {
		return nil
	}
	return fmt.Errorf("unknown import format %q; choose %s", format, strings.Join(importFormats, ", "))
}

func importFlags(flags *flag.FlagSet, parsed *transfer) {
	flags.BoolVar(&parsed.skip, "skip-static", false, "")
}

func exportFlags(flags *flag.FlagSet, parsed *transfer) {
	flags.BoolVar(&parsed.secret, "include-secrets", false, "")
}

func parseTransfer(name string, arguments []string, defaultFormat string, register func(*flag.FlagSet, *transfer)) (transfer, error) {
	parsed := transfer{}
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.format, "format", defaultFormat, "")
	flags.StringVar(&parsed.out, "out", "", "")
	register(flags, &parsed)
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 1 {
		return parsed, fmt.Errorf("name the %s", transferSubjects[name])
	}
	if parsed.out == "" {
		return parsed, errors.New("--out is required")
	}
	parsed.source = positional[0]
	return parsed, nil
}

func importCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseTransfer("import", arguments, importer.FormatAuto, importFlags)
	if err == nil {
		err = checkImportFormat(parsed.format)
	}
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
	collection, dropped, err := result.GlobalsAsVariables().Folded()
	if err != nil {
		return complain(stderr, err)
	}
	result.Warnings = append(result.Warnings, dropped...)
	if _, err := workspace.Create(parsed.out, collection); err != nil {
		return complain(stderr, importTargetProblem(parsed.out, err))
	}
	if err := restrictPermissions(parsed.out); err != nil {
		return complain(stderr, err)
	}
	reportImport(stdout, stderr, result, parsed.out)
	reportGlobals(stderr, result.Globals)
	reportSecrets(stderr, append(collection.Environments, collectionVariables(collection)), result.Globals)
	return exitPassed
}

func reportGlobals(stderr io.Writer, globals []workspace.Environment) {
	names := make([]string, len(globals))
	for index, global := range globals {
		names[index] = strconv.Quote(global.Name)
	}
	if len(names) > 0 {
		fmt.Fprintf(stderr, "note: gostman run has no global scope, so the variables of the global environment %s were added to the collection variables in gostman.yaml; a collection variable with the same name keeps its value\n", strings.Join(names, ", "))
	}
}

func collectionVariables(collection workspace.Collection) workspace.Environment {
	return workspace.Environment{Name: workspace.ManifestName, Variables: collection.Variables, Meta: collection.VariablesMeta}
}

func importTargetProblem(out string, err error) error {
	if errors.Is(err, workspace.ErrNotEmpty) {
		return fmt.Errorf("%s already holds files; import creates a new workspace, so name a new or empty folder with --out", out)
	}
	return err
}

func unwrittenSecrets(environments []workspace.Environment) []string {
	var names []string
	for _, environment := range environments {
		values := map[string]any{}
		_ = json.Unmarshal([]byte(environment.Variables), &values)
		_, removed := workspace.WithoutSecretValues(environment)
		for _, name := range removed {
			if values[name] != "" {
				names = append(names, environment.Name+"/"+name)
			}
		}
	}
	return names
}

func reportSecrets(stderr io.Writer, environments, globals []workspace.Environment) {
	if names := unwrittenSecrets(environments); len(names) > 0 {
		fmt.Fprintf(stderr, "note: the values of the secret variables %s were not written to the workspace; set them in the desktop app, which keeps them in the system keychain, or pass them with --var, --var-from-env or --env-file\n", strings.Join(names, ", "))
	}
	if names := unwrittenSecrets(globals); len(names) > 0 {
		fmt.Fprintf(stderr, "note: the values of the secret global variables %s were not written to gostman.yaml; pass them with --var, --var-from-env or --env-file, or add them to an environment in the desktop app and mark them secret there\n", strings.Join(names, ", "))
	}
}

func restrictPermissions(root string) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return os.Chmod(path, exportFolderPerm)
		}
		return os.Chmod(path, exportFilePerm)
	})
}

func plural(count int, noun string) string {
	if count == 1 {
		return "1 " + noun
	}
	return fmt.Sprintf("%d %ss", count, noun)
}

func importSummary(counts importer.Counts) string {
	items := []struct {
		count int
		noun  string
	}{{counts.Requests, "request"}, {counts.Folders, "folder"}, {counts.Environments, "environment"}, {counts.Globals, "global environment"}, {counts.Variables, "collection variable"}, {counts.FolderSettings, "folder setting"}}
	var parts []string
	for _, item := range items {
		if item.count > 0 {
			parts = append(parts, plural(item.count, item.noun))
		}
	}
	switch len(parts) {
	case 0:
		return plural(0, "request")
	case 1:
		return parts[0]
	}
	last := parts[len(parts)-1]
	return strings.Join(parts[:len(parts)-1], ", ") + " and " + last
}

func writtenVariables(result importer.Result) int {
	collection, _ := result.Collection()
	entries, _ := workspace.ParseVariableEntries(collection.Variables)
	return len(entries)
}

func reportImport(stdout, stderr io.Writer, result importer.Result, out string) {
	counts := result.Counts()
	counts.Variables = writtenVariables(result)
	fmt.Fprintf(stdout, "Imported %s into %s.\n", importSummary(counts), out)
	for _, note := range result.Notes {
		fmt.Fprintf(stderr, "note: %s\n", note)
	}
	for _, warning := range result.Warnings {
		fmt.Fprintf(stderr, "warning: %s\n", warning)
	}
	for _, skipped := range result.Skipped {
		fmt.Fprintf(stderr, "skipped: %s\n", skipped)
	}
}

func exportCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseTransfer("export", arguments, "", exportFlags)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	opened, err := workspace.Open(parsed.source)
	if err != nil {
		return complain(stderr, err)
	}
	if parsed.secret {
		fmt.Fprintln(stderr, "warning: --include-secrets writes credentials into the exported files")
	}
	files, report, err := exportFiles(parsed, opened.Collection())
	if err != nil {
		return complain(stderr, err)
	}
	for _, note := range report.Notes {
		fmt.Fprintf(stderr, "note: %s\n", note)
	}
	for _, warning := range report.Warnings {
		fmt.Fprintf(stderr, "warning: %s\n", warning)
	}
	if err := writeExport(files, parsed.out); err != nil {
		return complain(stderr, err)
	}
	fmt.Fprintf(stdout, "Exported %s to %s.\n", plural(len(files), "file"), parsed.out)
	return exitPassed
}

func exportFiles(parsed transfer, collection workspace.Collection) ([]importer.File, importer.Report, error) {
	if parsed.format == exportPostman {
		return exportPostmanCollection(parsed.source, collection, parsed.secret)
	}
	files, _, report, err := importer.Export(parsed.format, collection, importer.Options{IncludeSecrets: parsed.secret})
	return files, report, err
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
