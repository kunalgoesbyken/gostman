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
	"github.com/kunalgoesbyken/gostman/workspace"
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
	monitor  monitorFlags

	coverage    bool
	minCoverage float64
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
	flags.BoolVar(&parsed.options.UpdateSnapshots, "update-snapshots", false, "")
	flags.BoolVar(&parsed.coverage, "coverage", false, "")
	flags.Float64Var(&parsed.minCoverage, "min-coverage", 0, "")
	parsed.extras.register(flags, &parsed.options)
	parsed.network = networkFlags(flags)
	state.signIn.register(flags)
	parsed.monitor.register(flags)
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
	case (parsed.coverage || parsed.minCoverage != 0) && parsed.contract == "":
		return parsed, errors.New("--coverage and --min-coverage need --contract <spec>, the OpenAPI spec whose operations are counted")
	case parsed.options.UpdateSnapshots && !isFolder(path):
		return parsed, errors.New("--update-snapshots rewrites request files, so it needs a workspace folder to run, not an export file")
	case parsed.options.UpdateSnapshots && parsed.flow != "":
		return parsed, errors.New("--update-snapshots does not apply to a flow")
	case parsed.minCoverage < 0 || parsed.minCoverage > 100:
		return parsed, errors.New("--min-coverage takes a percentage from 0 to 100")
	case parsed.flow != "" && (parsed.coverage || parsed.minCoverage != 0):
		return parsed, errors.New("--coverage and --min-coverage do not apply to a flow")
	}
	if err := parsed.monitor.validate(); err != nil {
		return parsed, err
	}
	if !parsed.monitor.repeating() || len(r.reporters) > 0 || r.output != "" {
		if parsed.reports, err = r.reporters.resolve(r.output); err != nil {
			return parsed, err
		}
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
	return i.execute(stored, stdout, stderr)
}

func (i invocation) pipeline() func(context.Context, runner.Collection, runner.Options, func(runner.Result)) (runner.Report, error) {
	if i.redact {
		return agent.Redacting(i.secrets)
	}
	return runner.Run
}

func (i invocation) execute(stored runner.Collection, stdout, stderr *os.File) int {
	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	context.AfterFunc(ctx, release)

	warned := map[string]bool{}
	if i.monitor.repeating() {
		return i.monitored(ctx, stored, warned, stdout, stderr)
	}
	outcome, scrub, err := i.cycle(ctx, stored, warned, stdout, stderr)
	if err != nil {
		return complain(stderr, err)
	}
	code := i.codeOf(outcome, stderr)
	record := i.record(outcome, code, scrub, stderr)
	i.announce(ctx, record, false, stderr)
	if ctx.Err() != nil {
		return exitFailed
	}
	return code
}

func (i invocation) cycle(ctx context.Context, stored runner.Collection, warned map[string]bool, stdout, stderr *os.File) (runner.Report, func(string) string, error) {
	var flow workspace.Flow
	if i.flow != "" {
		var err error
		if flow, err = chooseFlow(stored, i.flow); err != nil {
			return runner.Report{}, nil, err
		}
	}
	opened, err := openReports(i.reports, stdout, i.monitor.repeating(), i.coverage)
	if err != nil {
		return runner.Report{}, nil, err
	}
	defer opened.close()
	reporters := opened.reporters
	stepping := stepReporters(reporters)

	onResult := func(result runner.Result) {
		for _, reporter := range reporters {
			reporter.Request(result)
		}
		warnUnresolved(stderr, result.QualifiedName(), firstMentions(warned, result.Unresolved))
	}
	var recorded *agent.Recorded
	if i.monitor.keepsText() {
		folder := i.options.Folder
		if i.flow != "" {
			folder = ""
		}
		if recorded, err = agent.NewRecorded(stored, folder, i.options, i.redact); err != nil {
			return runner.Report{}, nil, err
		}
	}
	var outcome runner.Report
	if i.flow != "" {
		watch := runner.FlowWatch{Result: onResult, Step: func(event runner.FlowEvent) {
			for _, reporter := range stepping {
				reporter.Step(event)
			}
		}}
		if recorded != nil {
			outcome, err = recorded.RunFlow(ctx, stored, flow, i.options, watch)
		} else {
			outcome, err = i.flowPipeline()(ctx, stored, flow, i.options, watch)
		}
	} else {
		if recorded != nil {
			outcome, err = recorded.Run(ctx, stored, i.options, onResult)
		} else {
			outcome, err = i.pipeline()(ctx, stored, i.options, onResult)
		}
	}
	if err != nil {
		return runner.Report{}, nil, err
	}
	outcome.Collection = i.path
	for _, reporter := range reporters {
		if err := reporter.Finish(outcome); err != nil {
			return runner.Report{}, nil, err
		}
	}
	if i.options.UpdateSnapshots {
		updated, err := runner.UpdateSnapshotFiles(i.path, outcome.Results)
		if err != nil {
			return runner.Report{}, nil, err
		}
		fmt.Fprintf(stderr, "updated %s in %s\n", plural(updated, "snapshot"), i.path)
	}
	if recorded == nil {
		return outcome, nil, nil
	}
	return outcome, recorded.Text, nil
}

func (i invocation) codeOf(outcome runner.Report, stderr io.Writer) int {
	code := reportCode(outcome)
	if i.minCoverage > 0 && outcome.Coverage != nil && !outcome.Coverage.Meets(i.minCoverage) {
		fmt.Fprintf(stderr, "%s: %s\n", programName, outcome.Coverage.Shortfall(i.minCoverage))
		if code == exitPassed {
			return exitFailed
		}
	}
	return code
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

func isFolder(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}
