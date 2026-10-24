package agent

import (
	"context"
	"errors"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/openapi/lint"
	"github.com/kunalgoesbyken/gostman/scan"
)

const shownFindings = 100

type documentArguments struct {
	Content string `json:"content"`
	URL     string `json:"url"`
}

type scanArguments struct {
	SkipExamples bool `json:"skip_examples"`
}

type lintDigest struct {
	Counts   lint.Counts    `json:"counts"`
	Findings []lint.Finding `json:"findings"`
	Omitted  int            `json:"omitted,omitempty"`
}

type scanDigest struct {
	Scanned  scan.Counts    `json:"scanned"`
	High     int            `json:"high"`
	Medium   int            `json:"medium"`
	Findings []scan.Finding `json:"findings"`
	Omitted  int            `json:"omitted,omitempty"`
}

func firstOf[T any](items []T) ([]T, int) {
	if len(items) <= shownFindings {
		return append([]T{}, items...), 0
	}
	return items[:shownFindings], len(items) - shownFindings
}

func (a documentArguments) source() (openapi.Source, error) {
	if hasText(a.Content) == hasText(a.URL) {
		return openapi.Source{}, errors.New("Give either content (the document as text) or url, not both and not neither.")
	}
	return openapi.Source{Text: a.Content, URL: a.URL}, nil
}

func (d *Desk) documentOptions() openapi.Options {
	return openapi.Options{Policy: d.client.policy}
}

func (d *Desk) lintSpec(ctx context.Context, _ scene, arguments documentArguments) (lintDigest, error) {
	source, err := arguments.source()
	if err != nil {
		return lintDigest{}, err
	}
	config, err := lint.LoadOptionalConfig(filepath.Join(d.files.Root(), lint.ConfigFileName))
	if err != nil {
		return lintDigest{}, err
	}
	report, err := lint.Run(ctx, source, d.documentOptions(), config)
	if err != nil {
		return lintDigest{}, err
	}
	digest := lintDigest{Counts: report.Counts}
	digest.Findings, digest.Omitted = firstOf(report.Findings)
	return digest, nil
}

func (d *Desk) scanSecrets(_ context.Context, current scene, arguments scanArguments) (scanDigest, error) {
	report := scan.Scan(current.files, scan.Options{SkipExamples: arguments.SkipExamples})
	digest := scanDigest{Scanned: report.Scanned, High: report.Count(scan.High), Medium: report.Count(scan.Medium)}
	digest.Findings, digest.Omitted = firstOf(report.Findings)
	return digest, nil
}
