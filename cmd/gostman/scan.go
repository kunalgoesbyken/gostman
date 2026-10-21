package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/scan"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	scanText    = "text"
	scanJSON    = "json"
	scanMaxSize = 64 << 20
)

type scanning struct {
	source    string
	reporter  string
	threshold scan.Threshold
	failOn    string
	options   scan.Options
}

type scanSummary struct {
	High   int `json:"high"`
	Medium int `json:"medium"`
}

type scanDocument struct {
	Scanned  scan.Counts    `json:"scanned"`
	Summary  scanSummary    `json:"summary"`
	FailOn   string         `json:"failOn"`
	Passed   bool           `json:"passed"`
	Findings []scan.Finding `json:"findings"`

	Truncated int `json:"truncated"`
}

func parseScanning(arguments []string) (scanning, error) {
	parsed := scanning{}
	flags := flag.NewFlagSet("scan", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.reporter, "reporter", scanText, "")
	flags.StringVar(&parsed.failOn, "fail-on", "medium", "")
	flags.BoolVar(&parsed.options.SkipExamples, "skip-examples", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 1 {
		return parsed, errors.New("name exactly one workspace folder or export file to scan")
	}
	if parsed.reporter != scanText && parsed.reporter != scanJSON {
		return parsed, fmt.Errorf("unknown reporter %q; choose text or json", parsed.reporter)
	}
	parsed.threshold, err = scan.ParseThreshold(parsed.failOn)
	parsed.source = positional[0]
	return parsed, err
}

func loadScanTarget(path string) (workspace.Collection, error) {
	collection, err := runner.Load(path)
	if err == nil {
		return toWorkspaceCollection(collection)
	}
	if info, statErr := os.Stat(path); statErr != nil || info.IsDir() {
		return workspace.Collection{}, err
	}
	return importedTarget(path)
}

func toWorkspaceCollection(collection runner.Collection) (workspace.Collection, error) {
	encoded, err := json.Marshal(collection)
	if err != nil {
		return workspace.Collection{}, err
	}
	var converted workspace.Collection
	return converted, json.Unmarshal(encoded, &converted)
}

func importedTarget(path string) (workspace.Collection, error) {
	files, err := importer.ReadPath(path, scanMaxSize)
	if err != nil {
		return workspace.Collection{}, err
	}
	config := importer.Config{OpenAPI: openapi.Options{AllowFiles: true}, MaxBytes: scanMaxSize}
	result, err := importer.Import(context.Background(), files, importer.FormatAuto, importer.Options{}, config)
	if err != nil {
		return workspace.Collection{}, fmt.Errorf("%s is not a Gostman workspace or a Gostman or Postman export: %w", path, err)
	}
	return importedCollection(result)
}

func summarize(report scan.Report) scanSummary {
	return scanSummary{High: report.Count(scan.High), Medium: report.Count(scan.Medium)}
}

func writeScanJSON(out io.Writer, report scan.Report, parsed scanning) error {
	encoder := json.NewEncoder(out)
	encoder.SetIndent("", "  ")
	return encoder.Encode(scanDocument{
		Scanned:  report.Scanned,
		Summary:  summarize(report),
		FailOn:   parsed.failOn,
		Passed:   !report.Reaches(parsed.threshold),
		Findings:  report.Findings,
		Truncated: report.Truncated,
	})
}

func writeScanText(out io.Writer, report scan.Report, parsed scanning) error {
	for _, finding := range report.Findings {
		_, err := fmt.Fprintf(out, "%-6s %s  %s  %s  %s  fp:%s  %s\n",
			strings.ToUpper(string(finding.Severity)), finding.Location.Path, finding.Location.Field,
			finding.Rule, finding.Preview, finding.Fingerprint, finding.Reason)
		if err != nil {
			return err
		}
	}
	summary := summarize(report)
	_, err := fmt.Fprintf(out, "Scanned %s, %s and %s: %s (%d high, %d medium). Failing on: %s.\n",
		plural(report.Scanned.Requests, "request"), plural(report.Scanned.Folders, "folder"),
		plural(report.Scanned.Environments, "environment"), plural(len(report.Findings), "finding"),
		summary.High, summary.Medium, parsed.failOn)
	if err != nil || report.Truncated == 0 {
		return err
	}
	_, err = fmt.Fprintf(out, "%s too long to scan in full: only the first 1 MiB of each was checked.\n", plural(report.Truncated, "field"))
	return err
}

func (s scanning) write(out io.Writer, report scan.Report) error {
	if s.reporter == scanJSON {
		return writeScanJSON(out, report, s)
	}
	return writeScanText(out, report, s)
}

func scanCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseScanning(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	collection, err := loadScanTarget(parsed.source)
	if err != nil {
		return complain(stderr, err)
	}
	report := scan.Scan(collection, parsed.options)
	if err := parsed.write(stdout, report); err != nil {
		return complain(stderr, err)
	}
	if report.Reaches(parsed.threshold) {
		return exitFailed
	}
	return exitPassed
}
