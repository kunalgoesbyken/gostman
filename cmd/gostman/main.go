package main

import (
	"fmt"
	"io"
	"os"
)

const (
	exitPassed = 0
	exitFailed = 1
	exitUsage  = 2

	programName = "gostman"
	usageHint   = `Run "gostman help" to see the commands and flags.`
	usage       = `Usage:
  gostman run <export.json | workspace folder> [flags]
  gostman send [flags] <request>
  gostman send [flags] <METHOD> <url>
  gostman mcp [flags]
  gostman init [folder]
  gostman version

run
  Run every request of a Gostman export or workspace folder in order, with its
  scripts, tests, extraction rules, cookies and OAuth 2 tokens.

  --env <name>          environment to use (default: the first one)
  --folder <name|path>  run only this folder, for example auth or auth/tokens
  --var <key=value>     set a variable, overriding the environment (repeatable)
  --var-from-env <NAME> set the variable NAME from the environment variable
                        NAME, so the value is not typed or stored (repeatable)
  --bail                stop at the first failure
  --delay <ms>          wait between requests
  --timeout <ms>        timeout for requests that do not set their own
  --insecure            skip TLS certificate verification
  --reporter <format>   text, json or junit (default text)
  --output <file>       write the report to this file and print text to stdout
  --redact              replace variable values and credentials in the report
                        with {{name}}

send
  Send one request through the same pipeline and print a JSON summary followed
  by the response body. Variable values and credentials are always replaced
  with {{name}} in what is printed.

  <request>             id or name of a saved request
  <METHOD> <url>        a request that is not saved
  --workspace <path>    workspace folder or export file (default: the current
                        folder when it is a workspace)
  --env, --var, --var-from-env, --timeout, --insecure   as for run
  -H, --header <name: value>  add a header to an unsaved request (repeatable)
  -d, --data <body>     body of an unsaved request
  --select <jsonpath>   print only this part of a JSON response body
  --max-body <bytes>    print at most this much of the body (default 8192)
  --include-headers     include the response headers in the summary

mcp
  Serve a workspace to a coding agent over the Model Context Protocol on
  stdin and stdout. Variable values never leave the process.

  --workspace <folder>  workspace folder (default: the current folder)
  --env, --var, --var-from-env   as for run
  --block-private       refuse requests to private and loopback addresses

init
  Create an empty workspace in the folder (default: the current folder) and
  print how to register the MCP server with a coding agent.

Exit codes:
  0  every request and test passed
  1  a request or a test failed
  2  the command or the input is wrong
`
)

var version = "dev"

func main() {
	os.Exit(dispatch(os.Args[1:], os.Stdout, os.Stderr))
}

func misuse(stderr io.Writer, message string) int {
	fmt.Fprintf(stderr, "%s: %s\n%s\n", programName, message, usageHint)
	return exitUsage
}

func dispatch(arguments []string, stdout, stderr *os.File) int {
	if len(arguments) == 0 {
		return misuse(stderr, "name a command")
	}
	switch arguments[0] {
	case "run":
		return runCommand(arguments[1:], stdout, stderr)
	case "send":
		return sendCommand(arguments[1:], stdout, stderr)
	case "mcp":
		return mcpCommand(arguments[1:], stdout, stderr)
	case "init":
		return initCommand(arguments[1:], stdout, stderr)
	case "version", "--version":
		fmt.Fprintln(stdout, version)
		return exitPassed
	case "help", "--help", "-h":
		fmt.Fprint(stdout, usage)
		return exitPassed
	default:
		return misuse(stderr, fmt.Sprintf("unknown command %q", arguments[0]))
	}
}
