package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/report"
)

var negativeSeverities = map[string]int{"low": 1, "medium": 2, "high": 3}

type negating struct {
	source      string
	environment string
	folder      string
	variables   map[string]string
	secrets     map[string]bool
	only        listFlag
	allowHosts  listFlag
	rate        float64
	maxRequests int
	failOn      string
	reporter    string
	network     *networkSettings
}

func parseNegating(arguments []string) (negating, error) {
	parsed := negating{variables: map[string]string{}}
	flags := flag.NewFlagSet("negative", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.environment, "env", "", "")
	flags.StringVar(&parsed.folder, "folder", "", "")
	parsed.secrets = variableFlags(flags, parsed.variables)
	flags.Var(&parsed.only, "only", "")
	flags.Var(&parsed.allowHosts, "allow-host", "")
	flags.Float64Var(&parsed.rate, "rate", runner.DefaultNegativeRate, "")
	flags.IntVar(&parsed.maxRequests, "max-requests", runner.DefaultNegativeRequests, "")
	flags.StringVar(&parsed.failOn, "fail-on", "medium", "")
	flags.StringVar(&parsed.reporter, "reporter", scanText, "")
	parsed.network = networkFlags(flags)
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return parsed, err
	}
	switch {
	case len(positional) != 1:
		return parsed, errors.New("name exactly one workspace folder or export file")
	case parsed.reporter != scanText && parsed.reporter != scanJSON:
		return parsed, fmt.Errorf("unknown reporter %q; choose text or json", parsed.reporter)
	case parsed.failOn != "none" && negativeSeverities[parsed.failOn] == 0:
		return parsed, errors.New("--fail-on takes low, medium, high or none")
	case parsed.rate <= 0 || parsed.maxRequests <= 0:
		return parsed, errors.New("--rate and --max-requests take a number above zero")
	}
	parsed.source = positional[0]
	return parsed, nil
}

func (n negating) permits(host string) bool {
	return permitsHost(n.allowHosts, host)
}

func permitsHost(allowHosts listFlag, host string) bool {
	name := strings.ToLower(host)
	if stripped, _, err := net.SplitHostPort(name); err == nil {
		name = stripped
	}
	name = strings.Trim(name, "[]")
	if name == "localhost" || net.ParseIP(name).IsLoopback() {
		return true
	}
	for _, allowed := range allowHosts {
		if strings.EqualFold(strings.TrimSpace(allowed), name) {
			return true
		}
	}
	return false
}

type negativeDocument struct {
	runner.NegativeReport
	FailOn string `json:"failOn"`
	Passed bool   `json:"passed"`
}

func (n negating) reaches(outcome runner.NegativeReport) bool {
	if n.failOn == "none" {
		return false
	}
	for _, found := range outcome.Findings {
		if negativeSeverities[found.Severity] >= negativeSeverities[n.failOn] {
			return true
		}
	}
	return false
}

func (n negating) write(out io.Writer, outcome runner.NegativeReport) error {
	if n.reporter == scanJSON {
		encoder := json.NewEncoder(out)
		encoder.SetIndent("", "  ")
		return encoder.Encode(negativeDocument{NegativeReport: outcome, FailOn: n.failOn, Passed: !n.reaches(outcome)})
	}
	for _, found := range outcome.Findings {
		if _, err := fmt.Fprintf(out, "%-6s %s %s  [%s] %s (status %d)\n", found.Severity, report.Printable(found.Method), report.Printable(found.Request), found.Rule, report.Printable(found.Message), found.Status); err != nil {
			return err
		}
	}
	_, err := fmt.Fprintf(out, "Sent %s for %s: %s. Failing on: %s.\n", plural(outcome.Sent, "request"), plural(outcome.Requests, "saved request"), plural(len(outcome.Findings), "finding"), n.failOn)
	if err == nil && outcome.Unsent > 0 {
		_, err = fmt.Fprintf(out, "%s got no response; hosts other than localhost need --allow-host.\n", plural(outcome.Unsent, "request"))
	}
	if err != nil || !outcome.Capped {
		return err
	}
	_, err = fmt.Fprintf(out, "Stopped at the --max-requests limit of %d.\n", n.maxRequests)
	return err
}

func negativeCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseNegating(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	stored, err := runner.Load(parsed.source)
	if err != nil {
		return complain(stderr, err)
	}
	network, err := parsed.network.network(stored)
	if err != nil {
		return complain(stderr, err)
	}
	session, err := runner.NewSession(engine.Policy{Network: network, Permit: parsed.permits})
	if err != nil {
		return complain(stderr, err)
	}
	if err := session.Enter(stored, parsed.folder, parsed.environment, parsed.variables); err != nil {
		return complain(stderr, err)
	}
	session.Remember(parsed.variables)
	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	outcome, err := session.Negative(ctx, stored, runner.NegativeOptions{
		Folder: parsed.folder,
		Rate:   parsed.rate, MaxRequests: parsed.maxRequests, Only: []string(parsed.only),
	}, nil)
	if err != nil && ctx.Err() == nil {
		return complain(stderr, err)
	}
	if err := parsed.write(stdout, outcome); err != nil {
		return complain(stderr, err)
	}
	if ctx.Err() != nil || parsed.reaches(outcome) {
		return exitFailed
	}
	return exitPassed
}
