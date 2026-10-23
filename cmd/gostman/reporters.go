package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/kunalgoesbyken/gostman/runner/report"
)

type reporterSpec struct {
	format string
	path   string
}

type reporterFlags []reporterSpec

func (r *reporterFlags) String() string {
	return ""
}

func (r *reporterFlags) Set(value string) error {
	format, path, _ := strings.Cut(value, ":")
	*r = append(*r, reporterSpec{format: format, path: path})
	return nil
}

func (s reporterSpec) toStdout() bool {
	return s.path == ""
}

func (r reporterFlags) resolve(output string) ([]reporterSpec, error) {
	specs := slices.Clone(r)
	if len(specs) == 0 {
		specs = []reporterSpec{{format: report.FormatText}}
	}
	for _, spec := range specs {
		if !report.Supports(spec.format) {
			return nil, fmt.Errorf("unknown reporter %q; choose %s", spec.format, strings.Join(report.Formats, ", "))
		}
	}
	if output != "" {
		if err := assignOutput(specs, output); err != nil {
			return nil, err
		}
	}
	if err := checkDestinations(specs); err != nil {
		return nil, err
	}
	return specs, nil
}

func assignOutput(specs []reporterSpec, output string) error {
	bare := slices.IndexFunc(specs, reporterSpec.toStdout)
	if bare < 0 || slices.ContainsFunc(specs[bare+1:], reporterSpec.toStdout) {
		return errors.New("--output names the file of the one --reporter given without a path")
	}
	specs[bare].path = output
	return nil
}

func checkDestinations(specs []reporterSpec) error {
	seen := map[string]bool{}
	printing := 0
	for _, spec := range specs {
		if spec.toStdout() {
			printing++
			continue
		}
		path := filepath.Clean(spec.path)
		if seen[path] {
			return fmt.Errorf("two reporters write to %s", spec.path)
		}
		seen[path] = true
	}
	if printing > 1 {
		return errors.New("only one --reporter can print to stdout; write the others to files as format:path")
	}
	return nil
}

type openedReports struct {
	reporters []report.Reporter
	files     []*os.File
}

func (o openedReports) close() {
	for _, file := range o.files {
		file.Close()
	}
}

func onStdout(format string, stdout *os.File) report.Reporter {
	if format == report.FormatText {
		return report.NewText(stdout, report.SupportsColor(stdout))
	}
	chosen, _ := report.New(format, stdout)
	return chosen
}

func openReports(specs []reporterSpec, stdout *os.File) (openedReports, error) {
	var opened openedReports
	if !slices.ContainsFunc(specs, reporterSpec.toStdout) {
		opened.reporters = append(opened.reporters, onStdout(report.FormatText, stdout))
	}
	for _, spec := range specs {
		if spec.toStdout() {
			opened.reporters = append(opened.reporters, onStdout(spec.format, stdout))
			continue
		}
		file, err := os.Create(spec.path)
		if err != nil {
			opened.close()
			return openedReports{}, err
		}
		opened.files = append(opened.files, file)
		chosen, _ := report.New(spec.format, file)
		opened.reporters = append(opened.reporters, chosen)
	}
	return opened, nil
}

func capturesExchanges(specs []reporterSpec) bool {
	return slices.ContainsFunc(specs, func(spec reporterSpec) bool {
		return spec.format == report.FormatHTML
	})
}
