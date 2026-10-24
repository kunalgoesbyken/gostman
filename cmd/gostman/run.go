package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/agent"
	"github.com/kunalgoesbyken/gostman/runner"
)

type overrides map[string]string

func (o overrides) String() string {
	return ""
}

func (o overrides) Set(pair string) error {
	name, value, found := strings.Cut(pair, "=")
	if !found || name == "" {
		return errors.New("write it as key=value")
	}
	o[name] = value
	return nil
}

type invocation struct {
	path    string
	options runner.Options
	reports []reporterSpec
	redact  bool
	extras  runExtras
}

func parseInterspersed(flags *flag.FlagSet, arguments []string) ([]string, error) {
	var positional []string
	for {
		if err := flags.Parse(arguments); err != nil {
			return nil, err
		}
		if flags.NArg() == 0 {
			return positional, nil
		}
		positional = append(positional, flags.Arg(0))
		arguments = flags.Args()[1:]
	}
}

func parseInvocation(arguments []string) (invocation, error) {
	parsed := invocation{options: runner.Options{Variables: map[string]string{}}}
	var delayMs, timeoutMs int
	var reporters reporterFlags
	var output string

	flags := flag.NewFlagSet("run", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.options.Environment, "env", "", "")
	flags.StringVar(&parsed.options.Folder, "folder", "", "")
	variableFlags(flags, parsed.options.Variables)
	flags.BoolVar(&parsed.options.Bail, "bail", false, "")
	flags.IntVar(&delayMs, "delay", 0, "")
	flags.IntVar(&timeoutMs, "timeout", 0, "")
	flags.BoolVar(&parsed.options.Insecure, "insecure", false, "")
	flags.Var(&reporters, "reporter", "")
	flags.StringVar(&output, "output", "", "")
	flags.BoolVar(&parsed.redact, "redact", false, "")
	parsed.extras.register(flags, &parsed.options)
	networking := networkFlags(flags)

	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return parsed, err
	case len(positional) != 1:
		return parsed, errors.New("name exactly one export file or workspace folder to run")
	case delayMs < 0 || timeoutMs < 0:
		return parsed, errors.New("--delay and --timeout take a number of milliseconds, zero or more")
	}
	parsed.reports, err = reporters.resolve(output)
	if err != nil {
		return parsed, err
	}
	if err := parsed.extras.validate(parsed.options); err != nil {
		return parsed, err
	}
	if parsed.options.Network, err = networking.network(); err != nil {
		return parsed, err
	}
	if err := parsed.extras.apply(&parsed.options, capturesExchanges(parsed.reports)); err != nil {
		return parsed, err
	}
	if err := parsed.options.CheckIterations(); err != nil {
		return parsed, err
	}
	parsed.path = positional[0]
	parsed.options.Files = filesBeside(parsed.path)
	parsed.options.Delay = time.Duration(delayMs) * time.Millisecond
	parsed.options.Timeout = time.Duration(timeoutMs) * time.Millisecond
	return parsed, nil
}

func complain(stderr io.Writer, err error) int {
	fmt.Fprintf(stderr, "%s: %s\n", programName, err)
	return exitUsage
}

func runCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseInvocation(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	stored, err := runner.Load(parsed.path)
	if err != nil {
		return complain(stderr, err)
	}
	return parsed.execute(stored, stdout, stderr)
}

func (i invocation) pipeline() func(context.Context, runner.Collection, runner.Options, func(runner.Result)) (runner.Report, error) {
	if i.redact {
		return agent.RunRedacted
	}
	return runner.Run
}

func (i invocation) execute(stored runner.Collection, stdout, stderr *os.File) int {
	opened, err := openReports(i.reports, stdout)
	if err != nil {
		return complain(stderr, err)
	}
	defer opened.close()
	reporters := opened.reporters

	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	context.AfterFunc(ctx, release)

	outcome, err := i.pipeline()(ctx, stored, i.options, func(result runner.Result) {
		for _, reporter := range reporters {
			reporter.Request(result)
		}
	})
	if err != nil {
		return complain(stderr, err)
	}
	outcome.Collection = i.path
	for _, reporter := range reporters {
		if err := reporter.Finish(outcome); err != nil {
			return complain(stderr, err)
		}
	}
	if outcome.HasFailed() || ctx.Err() != nil {
		return exitFailed
	}
	return exitPassed
}
