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
  gostman run <export.json> [flags]
  gostman version

Run every request of a Gostman export in order, with its scripts, tests,
extraction rules, cookies and OAuth 2 tokens.

Flags:
  --env <name>          environment to use (default: the first one in the file)
  --folder <name|path>  run only this folder, for example auth or auth/tokens
  --var <key=value>     set a variable, overriding the environment (repeatable)
  --bail                stop at the first failure
  --delay <ms>          wait between requests
  --timeout <ms>        timeout for requests that do not set their own
  --insecure            skip TLS certificate verification
  --reporter <format>   text, json or junit (default text)
  --output <file>       write the report to this file and print text to stdout

Exit codes:
  0  every request and test passed
  1  a request or a test failed
  2  the command or the input file is wrong
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
