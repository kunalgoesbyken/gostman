package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"text/tabwriter"

	"github.com/kunalgoesbyken/gostman/agent"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/runner/report"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const (
	flowRunCommandName  = "run"
	flowListCommandName = "list"
)

type flowPipeline func(context.Context, runner.Collection, workspace.Flow, runner.Options, runner.FlowWatch) (runner.Report, error)

func flowCommand(arguments []string, stdout, stderr *os.File) int {
	if len(arguments) == 0 {
		return misuse(stderr, "name a flow command: run or list")
	}
	switch arguments[0] {
	case flowRunCommandName:
		return flowRunCommand(arguments[1:], stdout, stderr)
	case flowListCommandName:
		return flowListCommand(arguments[1:], stdout, stderr)
	default:
		return misuse(stderr, fmt.Sprintf("unknown flow command %q; use run or list", arguments[0]))
	}
}

func isFlowFile(reference string) bool {
	extension := strings.ToLower(filepath.Ext(reference))
	if extension != ".yaml" && extension != ".yml" {
		return false
	}
	info, err := os.Stat(reference)
	return err == nil && info.Mode().IsRegular()
}

func flowWorkspace(reference, given string) string {
	if given != "" {
		return given
	}
	if isFlowFile(reference) {
		root := filepath.Dir(filepath.Dir(reference))
		if isWorkspaceFolder(root) {
			return root
		}
	}
	return currentFolder
}

func isWorkspaceFolder(path string) bool {
	state, err := workspace.Inspect(path)
	return err == nil && state == workspace.Existing
}

func parseFlowRun(arguments []string) (invocation, error) {
	flags, state := newRunFlags("flow")
	var workspacePath string
	flags.StringVar(&workspacePath, "workspace", "", "")
	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return state.parsed, err
	case len(positional) != 1:
		return state.parsed, errors.New("name exactly one flow: its name, its id or its YAML file")
	}
	state.parsed.flow = positional[0]
	return state.finish(flowWorkspace(positional[0], workspacePath))
}

func flowRunCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseFlowRun(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, helpFor("flow"))
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	return parsed.launch(stdout, stderr)
}

func chooseFlow(stored runner.Collection, reference string) (workspace.Flow, error) {
	if isFlowFile(reference) {
		return workspace.ReadFlowFile(reference)
	}
	return runner.FindFlow(stored.Flows, reference)
}

func (i invocation) flowPipeline() flowPipeline {
	if i.redact {
		return agent.RedactingFlow(i.secrets)
	}
	return runner.RunFlow
}

func stepReporters(reporters []report.Reporter) []report.StepReporter {
	var stepping []report.StepReporter
	for _, reporter := range reporters {
		if candidate, ok := reporter.(report.StepReporter); ok {
			stepping = append(stepping, candidate)
		}
	}
	return stepping
}

func (i invocation) executeFlow(stored runner.Collection, stdout, stderr *os.File) int {
	flow, err := chooseFlow(stored, i.flow)
	if err != nil {
		return complain(stderr, err)
	}
	opened, err := openReports(i.reports, stdout)
	if err != nil {
		return complain(stderr, err)
	}
	defer opened.close()
	reporters := opened.reporters
	stepping := stepReporters(reporters)

	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	context.AfterFunc(ctx, release)

	warned := map[string]bool{}
	watch := runner.FlowWatch{
		Result: func(result runner.Result) {
			for _, reporter := range reporters {
				reporter.Request(result)
			}
			warnUnresolved(stderr, result.QualifiedName(), firstMentions(warned, result.Unresolved))
		},
		Step: func(event runner.FlowEvent) {
			for _, reporter := range stepping {
				reporter.Step(event)
			}
		},
	}
	outcome, err := i.flowPipeline()(ctx, stored, flow, i.options, watch)
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

func flowListCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("flow list", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	path := flags.String("workspace", currentFolder, "")
	asJSON := flags.Bool("json", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, helpFor("flow"))
		return exitPassed
	}
	if err == nil && len(positional) > 0 {
		err = errors.New("flow list takes no names; point --workspace at a workspace folder or export file")
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	stored, err := runner.Load(*path)
	if err != nil {
		return complain(stderr, err)
	}
	if *asJSON {
		if err := writeJSON(stdout, listedFlows(stored.Flows)); err != nil {
			return complain(stderr, err)
		}
		return exitPassed
	}
	printFlows(stdout, stored.Flows)
	return exitPassed
}

type listedFlow struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Steps       int    `json:"steps"`
}

func countSteps(steps []workspace.FlowStep) int {
	total := len(steps)
	for _, step := range steps {
		total += countSteps(step.Steps)
	}
	return total
}

func listedFlows(flows []workspace.Flow) []listedFlow {
	listed := make([]listedFlow, 0, len(flows))
	for _, flow := range flows {
		listed = append(listed, listedFlow{ID: flow.Id, Name: flow.Name, Description: flow.Description, Steps: countSteps(flow.Steps)})
	}
	return listed
}

func printFlows(stdout io.Writer, flows []workspace.Flow) {
	if len(flows) == 0 {
		fmt.Fprintln(stdout, "This collection has no flows.")
		return
	}
	table := tabwriter.NewWriter(stdout, 0, 0, 2, ' ', 0)
	for _, flow := range listedFlows(flows) {
		fmt.Fprintf(table, "%s\t%d steps\t%s\n", flow.Name, flow.Steps, flow.ID)
	}
	table.Flush()
}
