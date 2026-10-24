package main

import (
	"context"
	"crypto/rand"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/kunalgoesbyken/gostman/agent"
	"github.com/kunalgoesbyken/gostman/loopback"
	"github.com/kunalgoesbyken/gostman/mcp"
	"github.com/kunalgoesbyken/gostman/runner"
)

const (
	tokenVariable = "GOSTMAN_MCP_TOKEN"
	shortestToken = 24
)

type serving struct {
	settings agent.Settings
	listen   int
	network  *networkSettings
}

func parseServing(arguments []string) (serving, error) {
	parsed := serving{settings: agent.Settings{Variables: map[string]string{}}}
	settings := &parsed.settings
	var timeoutMs int
	var envFile string
	var exposed tagFlag
	flags := flag.NewFlagSet("mcp", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	flags.StringVar(&settings.Root, "workspace", currentFolder, "")
	flags.StringVar(&settings.Environment, "env", "", "")
	variableFlags(flags, settings.Variables)
	flags.StringVar(&envFile, "env-file", "", "")
	flags.BoolVar(&settings.Policy.BlockPrivate, "block-private", false, "")
	flags.Func("allow-host", "", func(host string) error {
		settings.AllowedHosts = append(settings.AllowedHosts, host)
		return nil
	})
	flags.Var(&exposed, "expose-tag", "")
	flags.IntVar(&timeoutMs, "timeout", 0, "")
	flags.BoolVar(&settings.Insecure, "insecure", false, "")
	flags.IntVar(&parsed.listen, "listen", 0, "")
	parsed.network = networkFlags(flags)
	if err := flags.Parse(arguments); err != nil {
		return parsed, err
	}
	switch {
	case flags.NArg() > 0:
		return parsed, fmt.Errorf("unexpected argument %q", flags.Arg(0))
	case timeoutMs < 0:
		return parsed, errors.New("--timeout takes a number of milliseconds, zero or more")
	}
	if err := loopback.CheckPort(parsed.listen); err != nil {
		return parsed, fmt.Errorf("--listen: %w", err)
	}
	if err := mergeEnvFile(envFile, settings.Variables); err != nil {
		return parsed, err
	}
	settings.Timeout = time.Duration(timeoutMs) * time.Millisecond
	settings.ExposeTags = exposed
	return parsed, parsed.network.check()
}

func (s *serving) connect() error {
	stored, err := runner.Load(s.settings.Root)
	if err != nil {
		return err
	}
	s.settings.Policy.Network, err = s.network.network(stored)
	return err
}

func bearerToken() (string, error) {
	token := os.Getenv(tokenVariable)
	if token == "" {
		return rand.Text(), nil
	}
	if len(token) < shortestToken {
		return "", fmt.Errorf("%s must be at least %d characters long", tokenVariable, shortestToken)
	}
	return token, nil
}

func serveHTTP(server *mcp.Server, port int, stderr *os.File) error {
	token, err := bearerToken()
	if err != nil {
		return err
	}
	listener, err := loopback.Listen(port)
	if err != nil {
		return err
	}
	fmt.Fprintf(stderr, "%s: serving MCP at http://%s%s\n", programName, listener.Addr(), mcp.Endpoint)
	fmt.Fprintf(stderr, "%s: send the header \"Authorization: Bearer %s\"\n", programName, token)
	return serveUntilInterrupted(listener, &mcp.Gateway{Server: server, Token: token})
}

func mcpCommand(arguments []string, stdout, stderr *os.File) int {
	parsed, err := parseServing(arguments)
	if errors.Is(err, flag.ErrHelp) {
		fmt.Fprint(stdout, usage)
		return exitPassed
	}
	if err != nil {
		return misuse(stderr, err.Error())
	}
	if err := parsed.connect(); err != nil {
		return complain(stderr, err)
	}
	desk, err := agent.Open(parsed.settings)
	if err != nil {
		return complain(stderr, err)
	}
	defer desk.Close()

	server := &mcp.Server{
		Name:         programName,
		Version:      currentVersion(),
		Instructions: agent.Instructions,
		Tools:        desk.Tools(),
		Log:          stderr,
	}
	if parsed.listen != 0 {
		err = serveHTTP(server, parsed.listen, stderr)
	} else {
		fmt.Fprintf(stderr, "%s: serving the workspace %s over MCP on stdin and stdout\n", programName, parsed.settings.Root)
		err = server.Serve(context.Background(), os.Stdin, stdout)
	}
	if err != nil {
		fmt.Fprintf(stderr, "%s: %s\n", programName, err)
		return exitFailed
	}
	return exitPassed
}
