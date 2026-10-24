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
	"strings"

	"github.com/kunalgoesbyken/gostman/agent"
	"github.com/kunalgoesbyken/gostman/engine"
	"github.com/kunalgoesbyken/gostman/runner"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const currentFolder = "."

type headerFlags []engine.HeaderEntry

type requestFlags struct {
	environment string
	variables   map[string]string
	headers     headerFlags
	data        string
	timeoutMs   int
	insecure    bool
	envFile     string
	files       fileAccess
	network     *networkSettings
}

type sending struct {
	requestFlags
	workspace  string
	view       agent.View
	asJSON     bool
	positional []string
}

func (h *headerFlags) String() string {
	return ""
}

func (h *headerFlags) Set(line string) error {
	name, value, found := strings.Cut(line, ":")
	if !found || strings.TrimSpace(name) == "" {
		return errors.New("write it as name: value")
	}
	*h = append(*h, engine.HeaderEntry{Key: strings.TrimSpace(name), Value: strings.TrimSpace(value)})
	return nil
}

func (r *requestFlags) register(flags *flag.FlagSet) {
	r.variables = map[string]string{}
	flags.StringVar(&r.environment, "env", "", "")
	variableFlags(flags, r.variables)
	flags.Var(&r.headers, "H", "")
	flags.Var(&r.headers, "header", "")
	flags.StringVar(&r.data, "d", "", "")
	flags.StringVar(&r.data, "data", "", "")
	flags.IntVar(&r.timeoutMs, "timeout", 0, "")
	flags.BoolVar(&r.insecure, "insecure", false, "")
	flags.StringVar(&r.envFile, "env-file", "", "")
	r.files.register(flags)
	r.network = networkFlags(flags)
}

func (r *requestFlags) finish() error {
	if r.timeoutMs < 0 {
		return errors.New("--timeout takes a number of milliseconds, zero or more")
	}
	if err := mergeEnvFile(r.envFile, r.variables); err != nil {
		return err
	}
	return r.network.check()
}

func (r requestFlags) describesRequest() bool {
	return len(r.headers) > 0 || r.data != ""
}

func (r requestFlags) open(stored runner.Collection, fileRoot string) (*agent.Client, error) {
	network, err := r.network.network(stored)
	if err != nil {
		return nil, err
	}
	client, err := agent.NewClient(engine.Policy{Network: network, ReadFile: r.files.beside(fileRoot)})
	if err != nil {
		return nil, err
	}
	return client, client.Enter(stored, r.environment, r.variables)
}

func (r requestFlags) compose(client *agent.Client, method, address string) (runner.Listed, error) {
	return client.Compose(agent.Draft{Method: method, URL: address, Headers: r.headers, Body: r.data})
}

func (r requestFlags) adjusted(target runner.Listed) runner.Listed {
	if r.timeoutMs > 0 {
		target.Request.Options.TimeoutMs = r.timeoutMs
	}
	if r.insecure {
		target.Request.Options.InsecureTLS = true
	}
	return target
}

func parseSending(arguments []string) (sending, error) {
	parsed := sending{}
	flags := flag.NewFlagSet("send", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	parsed.register(flags)
	flags.StringVar(&parsed.workspace, "workspace", "", "")
	flags.StringVar(&parsed.view.Select, "select", "", "")
	flags.IntVar(&parsed.view.MaxBodyBytes, "max-body", agent.DefaultBodyBytes, "")
	flags.BoolVar(&parsed.view.IncludeHeaders, "include-headers", false, "")
	flags.BoolVar(&parsed.asJSON, "json", false, "")

	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return parsed, err
	case len(positional) != 1 && len(positional) != 2:
		return parsed, errors.New("name a saved request, or give a method and a url")
	case namesSavedRequest(positional) && parsed.describesRequest():
		return parsed, errors.New("--header and --data belong to a request given as a method and a url")
	case parsed.view.MaxBodyBytes < 1 || parsed.view.MaxBodyBytes > agent.HighestBodyBytes:
		return parsed, fmt.Errorf("--max-body takes a number of bytes between 1 and %d", agent.HighestBodyBytes)
	}
	parsed.positional = positional
	parsed.view.IncludeBinary = parsed.asJSON
	return parsed, parsed.finish()
}

func namesSavedRequest(positional []string) bool {
	return len(positional) == 1
}

func (s sending) collection() (runner.Collection, error) {
	if s.workspace != "" {
		return runner.Load(s.workspace)
	}
	if state, err := workspace.Inspect(currentFolder); err == nil && state == workspace.Existing {
		return runner.Load(currentFolder)
	}
	if namesSavedRequest(s.positional) {
		return runner.Collection{}, errors.New("this folder is not a Gostman workspace; point --workspace at a workspace folder or an export file")
	}
	return runner.Collection{}, nil
}

func (s sending) fileRoot() string {
	if s.workspace != "" {
		return s.workspace
	}
	return currentFolder
}

func (s sending) target(client *agent.Client, stored runner.Collection) (runner.Listed, error) {
	if namesSavedRequest(s.positional) {
		return client.Find(stored, s.positional[0])
	}
	return s.compose(client, s.positional[0], s.positional[1])
}

func (s sending) prepare() (*agent.Client, runner.Listed, error) {
	stored, err := s.collection()
	if err != nil {
		return nil, runner.Listed{}, err
	}
	client, err := s.open(stored, s.fileRoot())
	if err != nil {
		return nil, runner.Listed{}, err
	}
	target, err := s.target(client, stored)
	return client, s.adjusted(target), err
}

func writeJSON(out io.Writer, value any) error {
	encoder := json.NewEncoder(out)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	return encoder.Encode(value)
}

func printOutcome(stdout io.Writer, outcome agent.Outcome, asJSON bool) error {
	if asJSON {
		return writeJSON(stdout, outcome.Embed(outcome.Text))
	}
	if err := writeJSON(stdout, outcome); err != nil || outcome.Text == "" {
		return err
	}
	_, err := fmt.Fprintf(stdout, "\n%s\n", outcome.Text)
	return err
}

func outcomeCode(outcome agent.Outcome) int {
	switch {
	case outcome.Status == engine.FailureStatus:
		return exitUnsent
	case outcome.Failed:
		return exitFailed
	}
	return exitPassed
}

func sendCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseSending(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	client, target, err := parsed.prepare()
	if err != nil {
		return complain(stderr, err)
	}

	ctx, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	context.AfterFunc(ctx, release)

	outcome, err := client.Send(ctx, target, parsed.view)
	if err != nil {
		return complain(stderr, errors.New(client.Text(err.Error())))
	}
	if err := printOutcome(stdout, outcome, parsed.asJSON); err != nil {
		return complain(stderr, err)
	}
	warnUnresolved(stderr, "", outcome.Unresolved)
	if ctx.Err() != nil {
		return exitFailed
	}
	return outcomeCode(outcome)
}
