package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"

	"github.com/kunalgoesbyken/gostman/agent"
	"github.com/kunalgoesbyken/gostman/mock"
	"github.com/kunalgoesbyken/gostman/workspace"
)

const emptyVariables = "{}"

func variablesOf(collection workspace.Collection, name string) (string, error) {
	if len(collection.Environments) == 0 {
		return emptyVariables, nil
	}
	if name == "" {
		return collection.Environments[0].Variables, nil
	}
	for _, environment := range collection.Environments {
		if environment.Name == name {
			return environment.Variables, nil
		}
	}
	return "", fmt.Errorf("there is no environment named %q", name)
}

func printRoutes(stdout io.Writer, routes []mock.Route) {
	for _, route := range routes {
		detail := route.ExampleName
		if route.Reason != "" {
			detail = route.Reason
		}
		fmt.Fprintf(stdout, "%-10s %-7s %-28s %s  %s\n", route.State, route.Method, route.Path, route.Name, detail)
	}
}

func printEntry(stdout io.Writer, verbose bool) func(mock.Entry) {
	return func(entry mock.Entry) {
		fmt.Fprintf(stdout, "%s  %-7s %-28s %d  %d ms%s\n", entry.Time.Format("15:04:05"), entry.Method, entry.Path, entry.Status, entry.DurationMs, annotations(entry))
		if verbose {
			printDetails(stdout, entry)
		}
	}
}

func annotations(entry mock.Entry) string {
	notes := ""
	if entry.Rule != "" {
		notes += fmt.Sprintf("  rule %q", entry.Rule)
	}
	if entry.Fault != "" {
		notes += fmt.Sprintf("  fault %s", entry.Fault)
	}
	return notes
}

func printDetails(stdout io.Writer, entry mock.Entry) {
	for _, header := range entry.Headers {
		fmt.Fprintf(stdout, "    %s: %q\n", header.Key, header.Value)
	}
	if entry.Body != "" {
		fmt.Fprintf(stdout, "    body (%d bytes): %q\n", entry.BodyBytes, entry.Body)
	}
}

type mockInputs struct {
	sources   []mock.Source
	variables string
	config    mock.Config
}

func workspaceInputs(root, environment string) (mockInputs, error) {
	folder, err := workspace.Open(root)
	if err != nil {
		return mockInputs{}, err
	}
	collection := folder.Collection()
	variables, err := variablesOf(collection, environment)
	if err != nil {
		return mockInputs{}, err
	}
	config, err := mock.LoadConfig(filepath.Join(folder.Root(), mock.ConfigFileName))
	if err != nil {
		return mockInputs{}, err
	}
	return mockInputs{sources: agent.MockSources(collection), variables: variables, config: config}, nil
}

func serveMock(root, environment, specLocation string, settings mock.Settings, verbose bool, stdout io.Writer) error {
	inputs := mockInputs{variables: emptyVariables, config: mock.DefaultConfig()}
	if root != "" {
		var err error
		if inputs, err = workspaceInputs(root, environment); err != nil {
			return err
		}
	}
	if specLocation != "" {
		spec, err := loadSpec(specLocation)
		if err != nil {
			return err
		}
		inputs.config.Spec = spec
	}
	inputs.config.Settings = settings
	server, err := mock.Start(inputs.sources, inputs.variables, inputs.config, printEntry(stdout, verbose))
	if err != nil {
		return err
	}
	printRoutes(stdout, server.Routes())
	fmt.Fprintf(stdout, "\nMock server listening on %s. Press Ctrl+C to stop.\n\n", server.Address())

	interrupted, release := signal.NotifyContext(context.Background(), os.Interrupt)
	defer release()
	<-interrupted.Done()
	return server.Stop()
}

func mockCommand(arguments []string, stdout, stderr *os.File) int {
	flags := flag.NewFlagSet("mock", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	environment := flags.String("env", "", "")
	specLocation := flags.String("openapi", "", "")
	port := flags.Int("port", mock.DefaultPort, "")
	delay := flags.Int("delay", 0, "")
	delayMax := flags.Int("delay-max", 0, "")
	errorRate := flags.Int("error-rate", 0, "")
	errorStatus := flags.Int("error-status", 0, "")
	cors := flags.Bool("cors", false, "")
	verbose := flags.Bool("log", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	if len(positional) > 1 {
		return misuse(stderr, "name one workspace folder")
	}
	root := ""
	switch {
	case len(positional) == 1:
		root = positional[0]
	case *specLocation == "":
		root = currentFolder
	}
	settings := mock.Settings{Port: *port, CORS: *cors, Behavior: mock.Behavior{
		DelayMs:    *delay,
		DelayMaxMs: *delayMax,
		Fault:      mock.Fault{Percent: *errorRate, Kind: mock.FaultStatus, Status: *errorStatus},
	}}
	if err := serveMock(root, *environment, *specLocation, settings, *verbose, stdout); err != nil {
		return misuse(stderr, err.Error())
	}
	return exitPassed
}
