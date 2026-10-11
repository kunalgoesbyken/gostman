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

	"github.com/krockxz/gostman/agent"
	"github.com/krockxz/gostman/engine"
	"github.com/krockxz/gostman/runner"
	"github.com/krockxz/gostman/workspace"
)

const currentFolder = "."

type headerFlags []engine.HeaderEntry

type sending struct {
	workspace   string
	environment string
	variables   map[string]string
	headers     headerFlags
	data        string
	view        agent.View
	timeoutMs   int
	insecure    bool
	positional  []string
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

func parseSending(arguments []string) (sending, error) {
	parsed := sending{variables: map[string]string{}}
	flags := flag.NewFlagSet("send", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&parsed.workspace, "workspace", "", "")
	flags.StringVar(&parsed.environment, "env", "", "")
	variableFlags(flags, parsed.variables)
	flags.Var(&parsed.headers, "H", "")
	flags.Var(&parsed.headers, "header", "")
	flags.StringVar(&parsed.data, "d", "", "")
	flags.StringVar(&parsed.data, "data", "", "")
	flags.StringVar(&parsed.view.Select, "select", "", "")
	flags.IntVar(&parsed.view.MaxBodyBytes, "max-body", agent.DefaultBodyBytes, "")
	flags.BoolVar(&parsed.view.IncludeHeaders, "include-headers", false, "")
	flags.IntVar(&parsed.timeoutMs, "timeout", 0, "")
	flags.BoolVar(&parsed.insecure, "insecure", false, "")

	positional, err := parseInterspersed(flags, arguments)
	switch {
	case err != nil:
		return parsed, err
	case len(positional) != 1 && len(positional) != 2:
		return parsed, errors.New("name a saved request, or give a method and a url")
	case namesSavedRequest(positional) && (len(parsed.headers) > 0 || parsed.data != ""):
		return parsed, errors.New("--header and --data belong to a request given as a method and a url")
	case parsed.timeoutMs < 0:
		return parsed, errors.New("--timeout takes a number of milliseconds, zero or more")
	case parsed.view.MaxBodyBytes < 1 || parsed.view.MaxBodyBytes > agent.HighestBodyBytes:
		return parsed, fmt.Errorf("--max-body takes a number of bytes between 1 and %d", agent.HighestBodyBytes)
	}
	parsed.positional = positional
	return parsed, nil
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

func (s sending) target(client *agent.Client, stored runner.Collection) (runner.Listed, error) {
	if namesSavedRequest(s.positional) {
		return client.Find(stored, s.positional[0])
	}
	return client.Compose(agent.Draft{Method: s.positional[0], URL: s.positional[1], Headers: s.headers, Body: s.data})
}

func (s sending) adjusted(target runner.Listed) runner.Listed {
	if s.timeoutMs > 0 {
		target.Request.Options.TimeoutMs = s.timeoutMs
	}
	if s.insecure {
		target.Request.Options.InsecureTLS = true
	}
	return target
}

func (s sending) prepare() (*agent.Client, runner.Listed, error) {
	stored, err := s.collection()
	if err != nil {
		return nil, runner.Listed{}, err
	}
	client, err := agent.NewClient(engine.Policy{})
	if err != nil {
		return nil, runner.Listed{}, err
	}
	if err := client.Enter(stored, s.environment, s.variables); err != nil {
		return nil, runner.Listed{}, err
	}
	target, err := s.target(client, stored)
	return client, s.adjusted(target), err
}

func printOutcome(stdout io.Writer, outcome agent.Outcome) error {
	encoder := json.NewEncoder(stdout)
	encoder.SetIndent("", "  ")
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(outcome); err != nil || outcome.Text == "" {
		return err
	}
	_, err := fmt.Fprintf(stdout, "\n%s\n", outcome.Text)
	return err
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
	if err := printOutcome(stdout, outcome); err != nil {
		return complain(stderr, err)
	}
	if outcome.Failed || ctx.Err() != nil {
		return exitFailed
	}
	return exitPassed
}
