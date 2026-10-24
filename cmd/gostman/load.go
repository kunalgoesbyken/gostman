package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/kunalgoesbyken/gostman/agent"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/loadtest"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/report"
)

const (
	percentSign       = "%"
	progressEvery     = 4
	adHocArguments    = 2
	workspaceArgument = 1
)

type loading struct {
	workspace   string
	request     string
	environment string
	variables   map[string]string
	headers     headerFlags
	data        string
	reporter    string
	timeoutMs   int
	insecure    bool
	duration    time.Duration
	ramp        time.Duration
	maxErrors   string
	config      loadtest.Config
	limits      loadtest.Thresholds
	network     *engine.Network
	positional  []string
}

func parseLoading(arguments []string) (loading, error) {
	parsed := loading{variables: map[string]string{}}
	flags := flag.NewFlagSet("load", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.request, "request", "", "")
	flags.StringVar(&parsed.workspace, "workspace", "", "")
	flags.StringVar(&parsed.environment, "env", "", "")
	variableFlags(flags, parsed.variables)
	flags.Var(&parsed.headers, "H", "")
	flags.Var(&parsed.headers, "header", "")
	flags.StringVar(&parsed.data, "d", "", "")
	flags.StringVar(&parsed.data, "data", "", "")
	flags.IntVar(&parsed.config.Concurrency, "concurrency", loadtest.DefaultConcurrency, "")
	flags.DurationVar(&parsed.duration, "duration", 0, "")
	flags.IntVar(&parsed.config.Requests, "requests", 0, "")
	flags.IntVar(&parsed.config.RatePerSecond, "rps", 0, "")
	flags.DurationVar(&parsed.ramp, "ramp", 0, "")
	flags.IntVar(&parsed.config.FailureStatus, "fail-status", loadtest.DefaultFailureFrom, "")
	flags.IntVar(&parsed.timeoutMs, "timeout", 0, "")
	flags.BoolVar(&parsed.insecure, "insecure", false, "")
	flags.StringVar(&parsed.reporter, "reporter", report.FormatText, "")
	flags.DurationVar(&parsed.limits.MaxP95, "max-p95", 0, "")
	flags.StringVar(&parsed.maxErrors, "max-error-rate", "", "")
	networking := networkFlags(flags)

	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	parsed.positional = positional
	if err := parsed.finish(); err != nil {
		return parsed, err
	}
	parsed.network, err = networking.network()
	return parsed, err
}

func (l *loading) finish() error {
	if err := l.checkTarget(); err != nil {
		return err
	}
	if l.reporter != report.FormatText && l.reporter != report.FormatJSON {
		return fmt.Errorf("unknown reporter %q; choose %s or %s", l.reporter, report.FormatText, report.FormatJSON)
	}
	if l.timeoutMs < 0 {
		return errors.New("--timeout takes a number of milliseconds, zero or more")
	}
	if err := l.parseErrorRate(); err != nil {
		return err
	}
	l.config.DurationMs = int(l.duration / time.Millisecond)
	l.config.RampMs = int(l.ramp / time.Millisecond)
	return l.config.Normalized().Validate()
}

func (l *loading) checkTarget() error {
	switch {
	case len(l.positional) == adHocArguments && l.request != "":
		return errors.New("--request names a saved request; do not also give a method and a url")
	case len(l.positional) == adHocArguments:
		return nil
	case len(l.positional) == workspaceArgument && l.request == "":
		return errors.New("name the saved request with --request, or give a method and a url")
	case len(l.positional) == workspaceArgument && (len(l.headers) > 0 || l.data != ""):
		return errors.New("--header and --data belong to a request given as a method and a url")
	case len(l.positional) != workspaceArgument:
		return errors.New("give a workspace folder or export file with --request, or a method and a url")
	}
	return nil
}

func (l *loading) parseErrorRate() error {
	if l.maxErrors == "" {
		return nil
	}
	rate, err := strconv.ParseFloat(strings.TrimSuffix(l.maxErrors, percentSign), 64)
	if err != nil || rate < 0 || rate > 100 {
		return errors.New("--max-error-rate takes a percentage between 0 and 100, for example 1%")
	}
	l.limits.MaxErrorRatePercent = rate
	l.limits.ErrorRateSet = true
	return nil
}

func (l loading) isAdHoc() bool {
	return len(l.positional) == adHocArguments
}

func (l loading) fileRoot() string {
	if l.isAdHoc() {
		return currentFolder
	}
	return l.positional[0]
}

func (l loading) collection() (runner.Collection, error) {
	if l.isAdHoc() {
		return runner.Collection{}, nil
	}
	return runner.Load(l.positional[0])
}

func (l loading) target(client *agent.Client, stored runner.Collection) (runner.Listed, error) {
	if !l.isAdHoc() {
		return client.Find(stored, l.request)
	}
	return client.Compose(agent.Draft{Method: l.positional[0], URL: l.positional[1], Headers: l.headers, Body: l.data})
}

func (l loading) adjusted(target runner.Listed) runner.Listed {
	if l.timeoutMs > 0 {
		target.Request.Options.TimeoutMs = l.timeoutMs
	}
	if l.insecure {
		target.Request.Options.InsecureTLS = true
	}
	return target
}

func (l loading) progress(stderr io.Writer) func(loadtest.Snapshot) {
	if l.reporter != report.FormatText {
		return nil
	}
	var seen int
	return func(snapshot loadtest.Snapshot) {
		seen++
		if seen%progressEvery == 0 {
			loadtest.WriteProgress(stderr, snapshot)
		}
	}
}

func printLoad(stdout io.Writer, reporter string, outcome loadtest.Report) error {
	if reporter == report.FormatText {
		return loadtest.WriteText(stdout, outcome)
	}
	encoder := json.NewEncoder(stdout)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	return encoder.Encode(outcome)
}

func (l loading) verdict(stderr io.Writer, outcome loadtest.Report, interrupted bool) int {
	breaches := outcome.Breaches(l.limits)
	for _, breach := range breaches {
		fmt.Fprintf(stderr, "%s: threshold breached: %s\n", programName, breach)
	}
	if len(breaches) > 0 || interrupted || outcome.NothingSucceeded() {
		return exitFailed
	}
	return exitPassed
}

func (l loading) execute(stdout, stderr io.Writer) int {
	stored, err := l.collection()
	if err != nil {
		return complain(stderr, err)
	}
	client, err := agent.NewClient(engine.Policy{Network: l.network, ReadFile: filesBeside(l.fileRoot())})
	if err != nil {
		return complain(stderr, err)
	}
	if err := client.Enter(stored, l.environment, l.variables); err != nil {
		return complain(stderr, err)
	}
	target, err := l.target(client, stored)
	if err != nil {
		return complain(stderr, err)
	}

	fmt.Fprintf(stderr, "%s: %s\n", programName, loadtest.OwnershipNotice)
	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	context.AfterFunc(ctx, release)

	outcome, err := client.LoadTest(ctx, l.adjusted(target), l.config, l.progress(stderr))
	if err != nil {
		return complain(stderr, errors.New(client.Text(err.Error())))
	}
	if err := printLoad(stdout, l.reporter, outcome); err != nil {
		return complain(stderr, err)
	}
	return l.verdict(stderr, outcome, ctx.Err() != nil)
}

func loadCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseLoading(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	return parsed.execute(stdout, stderr)
}
