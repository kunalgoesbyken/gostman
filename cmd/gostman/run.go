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
	"github.com/kunalgoesbyken/gostman/engine"
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
	path     string
	flow     string
	options  runner.Options
	reports  []reporterSpec
	redact   bool
	secrets  map[string]bool
	extras   runExtras
	files    fileAccess
	contract string
	network  *networkSettings
}

type runFlags struct {
	parsed    invocation
	delayMs   int
	timeoutMs int
	reporters reporterFlags
	output    string
	signIn    signInFlags
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

func newRunFlags(name string) (*flag.FlagSet, *runFlags) {
	state := &runFlags{parsed: invocation{options: runner.Options{Variables: map[string]string{}}}}
	parsed := &state.parsed
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.options.Environment, "env", "", "")
	flags.StringVar(&parsed.options.Folder, "folder", "", "")
	parsed.secrets = variableFlags(flags, parsed.options.Variables)
	parsed.options.Secrets = parsed.secrets
	flags.BoolVar(&parsed.options.Bail, "bail", false, "")
	flags.IntVar(&state.delayMs, "delay", 0, "")
	flags.IntVar(&state.timeoutMs, "timeout", 0, "")
	flags.BoolVar(&parsed.options.Insecure, "insecure", false, "")
	parsed.files.register(flags)
	flags.Var(&state.reporters, "reporter", "")
	flags.StringVar(&state.output, "output", "", "")
	flags.BoolVar(&parsed.redact, "redact", false, "")
	flags.StringVar(&parsed.contract, "contract", "", "")
	parsed.extras.register(flags, &parsed.options)
	parsed.network = networkFlags(flags)
	state.signIn.register(flags)
	return flags, state
}

func (r *runFlags) usesRunOnlyFlags() bool {
	options := r.parsed.options
	return options.Folder != "" || r.parsed.extras.dataFile != "" || options.Iterations > 0 || options.Parallel > 0 ||
		len(options.Only) > 0 || len(options.Tags) > 0 || len(options.ExcludeTags) > 0 || options.Bail || r.delayMs > 0
}

func (r *runFlags) finish(path string) (invocation, error) {
	parsed := r.parsed
	var err error
	switch {
	case r.delayMs < 0 || r.timeoutMs < 0:
		return parsed, errors.New("--delay and --timeout take a number of milliseconds, zero or more")
	case parsed.flow != "" && r.usesRunOnlyFlags():
		return parsed, errors.New("--folder, --data, --iterations, --parallel, --only, --tags, --exclude-tags, --bail and --delay do not apply to a flow")
	}
	parsed.reports, err = r.reporters.resolve(r.output)
	if err != nil {
		return parsed, err
	}
	if err := parsed.extras.validate(parsed.options); err != nil {
		return parsed, err
	}
	if err := parsed.network.check(); err != nil {
		return parsed, err
	}
	if parsed.options.SignIn, err = r.signIn.token(); err != nil {
		return parsed, err
	}
	if err := parsed.extras.apply(&parsed.options, capturesExchanges(parsed.reports), parsed.secrets); err != nil {
		return parsed, err
	}
	if err := parsed.options.CheckIterations(); err != nil {
		return parsed, err
	}
	parsed.path = path
	parsed.options.Files = parsed.files.beside(parsed.path)
	parsed.options.Delay = time.Duration(r.delayMs) * time.Millisecond
	parsed.options.Timeout = time.Duration(r.timeoutMs) * time.Millisecond
	return parsed, nil
}

func parseInvocation(arguments []string) (invocation, error) {
	flags, state := newRunFlags("run")
	flags.StringVar(&state.parsed.flow, "flow", "", "")
	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return state.parsed, err
	case len(positional) != 1:
		return state.parsed, errors.New("name exactly one export file or workspace folder to run")
	}
	return state.finish(positional[0])
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
	return parsed.launch(stdout, stderr)
}

func (i invocation) launch(stdout, stderr *os.File) int {
	stored, err := runner.Load(i.path)
	if err != nil {
		return complain(stderr, err)
	}
	for _, warning := range stored.Warnings {
		fmt.Fprintf(stderr, "warning: %s\n", warning)
	}
	warnShortData(stderr, i.options)
	if i.options.Network, err = i.network.network(stored); err != nil {
		return complain(stderr, err)
	}
	if i.options.Contract, err = loadContract(i.contract, i.options.Network); err != nil {
		return complain(stderr, err)
	}
	if i.flow != "" {
		return i.executeFlow(stored, stdout, stderr)
	}
	return i.execute(stored, stdout, stderr)
}

func (i invocation) pipeline() func(context.Context, runner.Collection, runner.Options, func(runner.Result)) (runner.Report, error) {
	if i.redact {
		return agent.Redacting(i.secrets)
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

	warned := map[string]bool{}
	outcome, err := i.pipeline()(ctx, stored, i.options, func(result runner.Result) {
		for _, reporter := range reporters {
			reporter.Request(result)
		}
		warnUnresolved(stderr, result.QualifiedName(), firstMentions(warned, result.Unresolved))
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
	if ctx.Err() != nil {
		return exitFailed
	}
	return reportCode(outcome)
}

func reportCode(report runner.Report) int {
	if !report.HasFailed() {
		return exitPassed
	}
	for _, result := range report.Results {
		if result.Status == engine.FailureStatus && result.Handled == "" {
			return exitUnsent
		}
	}
	return exitFailed
}
