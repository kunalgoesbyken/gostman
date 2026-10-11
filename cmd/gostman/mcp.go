package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/krockxz/gostman/agent"
	"github.com/krockxz/gostman/mcp"
)

func parseServing(arguments []string) (agent.Settings, error) {
	settings := agent.Settings{Variables: map[string]string{}}
	flags := flag.NewFlagSet("mcp", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&settings.Root, "workspace", currentFolder, "")
	flags.StringVar(&settings.Environment, "env", "", "")
	variableFlags(flags, settings.Variables)
	flags.BoolVar(&settings.Policy.BlockPrivate, "block-private", false, "")
	if err := flags.Parse(arguments); err != nil {
		return settings, err
	}
	if flags.NArg() > 0 {
		return settings, fmt.Errorf("unexpected argument %q", flags.Arg(0))
	}
	return settings, nil
}

func mcpCommand(arguments []string, stdout, stderr *os.File) int {
	settings, err := parseServing(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	desk, err := agent.Open(settings)
	if err != nil {
		return complain(stderr, err)
	}
	defer desk.Close()

	server := &mcp.Server{
		Name:         programName,
		Version:      version,
		Instructions: agent.Instructions,
		Tools:        desk.Tools(),
		Log:          stderr,
	}
	fmt.Fprintf(stderr, "%s: serving the workspace %s over MCP on stdin and stdout\n", programName, settings.Root)
	if err := server.Serve(context.Background(), os.Stdin, stdout); err != nil {
		fmt.Fprintf(stderr, "%s: %s\n", programName, err)
		return exitFailed
	}
	return exitPassed
}
