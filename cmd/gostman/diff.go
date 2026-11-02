package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/openapi/diff"
)

const diffTimeout = time.Minute

type comparing struct {
	oldLocation string
	newLocation string
	asJSON      bool
	failOn      string
	timeout     time.Duration
}

func parseComparing(arguments []string) (comparing, error) {
	var parsed comparing
	flags := flag.NewFlagSet("diff", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.BoolVar(&parsed.asJSON, "json", false, "")
	flags.StringVar(&parsed.failOn, "fail-on", diff.FailNone, "")
	flags.DurationVar(&parsed.timeout, "timeout", diffTimeout, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	if len(positional) != 2 {
		return parsed, errors.New("name the old and the new OpenAPI file or address")
	}
	parsed.oldLocation, parsed.newLocation = positional[0], positional[1]
	switch parsed.failOn {
	case diff.FailBreaking, diff.FailAny, diff.FailNone:
		return parsed, nil
	}
	return parsed, fmt.Errorf("unknown --fail-on value %q; use breaking, any or none", parsed.failOn)
}

func diffCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseComparing(arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	options := openapi.Options{Policy: engine.Policy{}, AllowFiles: true}
	ctx, cancel := context.WithTimeout(context.Background(), parsed.timeout)
	defer cancel()
	report, err := diff.Run(ctx, specSourceOf(parsed.oldLocation), specSourceOf(parsed.newLocation), options)
	if err != nil {
		return complain(stderr, err)
	}
	format := diff.FormatText
	if parsed.asJSON {
		format = diff.FormatJSON
	}
	if err := diff.Write(stdout, report, format); err != nil {
		return complain(stderr, err)
	}
	if report.Reaches(parsed.failOn) {
		return exitFailed
	}
	return exitPassed
}
