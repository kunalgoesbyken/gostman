package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/openapi/lint"
)

type linting struct {
	location string
	config   string
	reporter string
	failOn   lint.Severity
}

func parseLinting(arguments []string) (linting, error) {
	var parsed linting
	var failOn string
	flags := flag.NewFlagSet("lint", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.config, "config", "", "")
	flags.StringVar(&parsed.reporter, "reporter", lint.FormatText, "")
	flags.StringVar(&failOn, "fail-on", string(lint.SeverityError), "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 1 {
		return parsed, errors.New("name one OpenAPI file or address")
	}
	parsed.location = positional[0]
	parsed.failOn = lint.Severity(failOn)
	return parsed, parsed.validate()
}

func (l linting) validate() error {
	switch l.reporter {
	case lint.FormatText, lint.FormatJSON, lint.FormatJUnit:
	default:
		return fmt.Errorf("unknown reporter %q; use text, json or junit", l.reporter)
	}
	switch l.failOn {
	case lint.SeverityError, lint.SeverityWarning, lint.SeverityNone:
		return nil
	}
	return fmt.Errorf("unknown --fail-on value %q; use error, warning or none", l.failOn)
}

func (l linting) loadConfig() (lint.Config, error) {
	if l.config != "" {
		return lint.LoadConfig(l.config)
	}
	return lint.LoadOptionalConfig(lint.ConfigFileName)
}

func (l linting) run() (lint.Report, error) {
	config, err := l.loadConfig()
	if err != nil {
		return lint.Report{}, err
	}
	options := openapi.Options{Policy: engine.Policy{}, AllowFiles: true}
	return lint.Run(context.Background(), specSourceOf(l.location), options, config)
}

func lintCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseLinting(arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	report, err := parsed.run()
	if err != nil {
		return complain(stderr, err)
	}
	if err := lint.Write(stdout, report, parsed.reporter, parsed.failOn); err != nil {
		return complain(stderr, err)
	}
	if report.Reaches(parsed.failOn) {
		return exitFailed
	}
	return exitPassed
}
