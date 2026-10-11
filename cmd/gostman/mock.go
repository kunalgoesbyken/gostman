package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/signal"

	"github.com/krockxz/gostman/agent"
	"github.com/krockxz/gostman/mock"
	"github.com/krockxz/gostman/workspace"
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

func printEntry(stdout io.Writer) func(mock.Entry) {
	return func(entry mock.Entry) {
		fmt.Fprintf(stdout, "%s  %-7s %-28s %d  %d ms\n", entry.Time.Format("15:04:05"), entry.Method, entry.Path, entry.Status, entry.DurationMs)
	}
}

func serveMock(root, environment string, settings mock.Settings, stdout io.Writer) error {
	folder, err := workspace.Open(root)
	if err != nil {
		return err
	}
	collection := folder.Collection()
	variables, err := variablesOf(collection, environment)
	if err != nil {
		return err
	}
	server, err := mock.Start(agent.MockSources(collection), variables, settings, printEntry(stdout))
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
	port := flags.Int("port", mock.DefaultPort, "")
	delay := flags.Int("delay", 0, "")
	cors := flags.Bool("cors", false, "")
	positional, err := parseInterspersed(flags, arguments)
	if err != nil {
		return misuse(stderr, err.Error())
	}
	if len(positional) > 1 {
		return misuse(stderr, "name one workspace folder")
	}
	root := currentFolder
	if len(positional) == 1 {
		root = positional[0]
	}
	settings := mock.Settings{Port: *port, DelayMs: *delay, CORS: *cors}
	if err := serveMock(root, *environment, settings, stdout); err != nil {
		return misuse(stderr, err.Error())
	}
	return exitPassed
}
