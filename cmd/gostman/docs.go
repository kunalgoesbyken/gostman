package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/sandbox"
)

const (
	docsBuilder     = "buildDocs"
	docsPermissions = 0o644
)

type docsOptions struct {
	Title           string `json:"title,omitempty"`
	IncludeExamples bool   `json:"includeExamples"`
	Playground      bool   `json:"playground"`
}

type documenting struct {
	source  string
	output  string
	options docsOptions
}

func parseDocumenting(arguments []string) (documenting, error) {
	var parsed documenting
	flags := flag.NewFlagSet("docs", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.output, "output", "", "")
	flags.StringVar(&parsed.options.Title, "title", "", "")
	withoutExamples := flags.Bool("no-examples", false, "")
	flags.BoolVar(&parsed.options.Playground, "playground", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 1 {
		return parsed, errors.New("name one workspace folder or export file")
	}
	parsed.source = positional[0]
	parsed.options.IncludeExamples = !*withoutExamples
	return parsed, nil
}

func (d documenting) render() (string, error) {
	collection, err := runner.Load(d.source)
	if err != nil {
		return "", err
	}
	var page string
	return page, sandbox.Render(docsBuilder, &page, collection, d.options)
}

func (d documenting) deliver(page string, stdout io.Writer) error {
	if d.output == "" {
		_, err := io.WriteString(stdout, page)
		return err
	}
	if err := os.WriteFile(d.output, []byte(page), docsPermissions); err != nil {
		return err
	}
	_, err := fmt.Fprintf(stdout, "Wrote %s (%d bytes).\n", d.output, len(page))
	return err
}

func docsCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseDocumenting(arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	page, err := parsed.render()
	if err != nil {
		return complain(stderr, err)
	}
	if err := parsed.deliver(page, stdout); err != nil {
		return complain(stderr, err)
	}
	return exitPassed
}
