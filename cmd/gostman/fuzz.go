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
	"slices"
	"time"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/fuzz"
	"github.com/kunalgoesbyken/gostman/openapi"
	"github.com/kunalgoesbyken/gostman/redact"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/report"
)

type fuzzing struct {
	spec         string
	baseURL      string
	variables    map[string]string
	secrets      map[string]bool
	only         listFlag
	allowHosts   listFlag
	seed         int64
	perOperation int
	rate         float64
	maxRequests  int
	timeout      time.Duration
	failOn       string
	reporter     string
	network      *networkSettings
}

func parseFuzzing(arguments []string) (fuzzing, error) {
	parsed := fuzzing{variables: map[string]string{}}
	flags := flag.NewFlagSet("fuzz", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.baseURL, "base-url", "", "")
	parsed.secrets = variableFlags(flags, parsed.variables)
	flags.Var(&parsed.only, "only", "")
	flags.Var(&parsed.allowHosts, "allow-host", "")
	flags.Int64Var(&parsed.seed, "seed", 1, "")
	flags.IntVar(&parsed.perOperation, "per-operation", fuzz.DefaultPerOperation, "")
	flags.Float64Var(&parsed.rate, "rate", runner.DefaultFuzzRate, "")
	flags.IntVar(&parsed.maxRequests, "max", runner.DefaultFuzzRequests, "")
	flags.DurationVar(&parsed.timeout, "timeout", runner.DefaultFuzzTimeout, "")
	flags.StringVar(&parsed.failOn, "fail-on", "medium", "")
	flags.StringVar(&parsed.reporter, "reporter", scanText, "")
	parsed.network = networkFlags(flags)
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	switch {
	case len(positional) != 1:
		return parsed, errors.New("name exactly one OpenAPI or Swagger document")
	case parsed.reporter != scanText && parsed.reporter != scanJSON:
		return parsed, fmt.Errorf("unknown reporter %q; choose text or json", parsed.reporter)
	case parsed.failOn != "none" && negativeSeverities[parsed.failOn] == 0:
		return parsed, errors.New("--fail-on takes low, medium, high or none")
	case parsed.rate <= 0 || parsed.maxRequests <= 0 || parsed.perOperation <= 0 || parsed.timeout <= 0:
		return parsed, errors.New("--rate, --max, --per-operation and --timeout take a value above zero")
	}
	parsed.spec = positional[0]
	return parsed, nil
}

func (f fuzzing) permits(host string) bool {
	return permitsHost(f.allowHosts, host)
}

func (f fuzzing) selected(targets openapi.Targets) openapi.Targets {
	if len(f.only) == 0 {
		return targets
	}
	targets.Operations = slices.DeleteFunc(slices.Clone(targets.Operations), func(target openapi.Target) bool {
		return !slices.Contains(f.only, target.Key)
	})
	return targets
}

func (f fuzzing) guard() *redact.Redactor {
	guard := redact.New()
	for name, value := range f.variables {
		guard.Learn(name, value)
	}
	return guard
}

type fuzzDocument struct {
	runner.FuzzReport
	Seed   int64  `json:"seed"`
	FailOn string `json:"failOn"`
	Passed bool   `json:"passed"`
}

func (f fuzzing) reaches(outcome runner.FuzzReport) bool {
	if f.failOn == "none" {
		return false
	}
	for _, found := range outcome.Findings {
		if negativeSeverities[found.Severity] >= negativeSeverities[f.failOn] {
			return true
		}
	}
	return false
}

func (f fuzzing) write(out io.Writer, outcome runner.FuzzReport) error {
	if f.reporter == scanJSON {
		encoder := json.NewEncoder(out)
		encoder.SetIndent("", "  ")
		return encoder.Encode(fuzzDocument{FuzzReport: outcome, Seed: f.seed, FailOn: f.failOn, Passed: !f.reaches(outcome)})
	}
	for _, found := range outcome.Findings {
		if _, err := fmt.Fprintf(out, "%-6s %s  %s [%s] %s (status %d)\n", found.Severity, report.Printable(found.Operation), report.Printable(found.Input), found.Rule, report.Printable(found.Message), found.Status); err != nil {
			return err
		}
	}
	_, err := fmt.Fprintf(out, "Sent %s for %s with seed %d: %s. Failing on: %s.\n", plural(outcome.Sent, "request"), plural(outcome.Operations, "operation"), f.seed, plural(len(outcome.Findings), "finding"), f.failOn)
	if err == nil && outcome.Unsent > 0 {
		_, err = fmt.Fprintf(out, "%s got no response; hosts other than localhost need --allow-host.\n", plural(outcome.Unsent, "request"))
	}
	if err != nil || !outcome.Capped {
		return err
	}
	_, err = fmt.Fprintf(out, "Stopped at the --max limit of %d.\n", f.maxRequests)
	return err
}

func fuzzCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseFuzzing(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	network, err := parsed.network.network(runner.Collection{})
	if err != nil {
		return complain(stderr, err)
	}
	document, err := openapi.Load(context.Background(), specSourceOf(parsed.spec), openapi.Options{Policy: engine.Policy{Network: network}, AllowFiles: true})
	if err != nil {
		return complain(stderr, err)
	}
	if parsed.baseURL == "" {
		parsed.baseURL = document.BaseURL()
	}
	if parsed.baseURL == "" {
		return misuse(stderr, "the document names no server; give --base-url")
	}
	session, err := runner.NewSession(engine.Policy{Network: network, Permit: parsed.permits})
	if err != nil {
		return complain(stderr, err)
	}
	if err := session.Enter(runner.Collection{}, "", "", parsed.variables); err != nil {
		return complain(stderr, err)
	}
	session.Remember(parsed.variables)
	session.Remember(map[string]string{openapi.BaseURLVariable: parsed.baseURL})
	contract := document.Contract()
	session.UseContract(&contract)
	cases := fuzz.Cases(parsed.selected(document.Targets()), parsed.seed, parsed.perOperation)
	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	outcome, err := session.Fuzz(ctx, cases, runner.FuzzOptions{Rate: parsed.rate, MaxRequests: parsed.maxRequests, Timeout: parsed.timeout}, nil)
	if err != nil && ctx.Err() == nil {
		return complain(stderr, err)
	}
	guard := parsed.guard()
	for index := range outcome.Findings {
		outcome.Findings[index].Message = guard.Text(outcome.Findings[index].Message)
	}
	if err := parsed.write(stdout, outcome); err != nil {
		return complain(stderr, err)
	}
	if ctx.Err() != nil || parsed.reaches(outcome) {
		return exitFailed
	}
	return exitPassed
}
