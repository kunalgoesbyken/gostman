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
  gostman mock [workspace folder] [flags]
  gostman docs <workspace folder | export.json> [flags]
  gostman capture --upstream <url> [flags]
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
  --secrets             allow variables that reference a secret manager
                        (Vault, AWS, Azure, GCP) to be read with the credentials
                        in the process environment; off by default so that a
                        collection you did not write cannot use them
                        (also for send and mcp)
  --secrets-env-file <file>
                        like --secrets, with the connection settings read from
                        KEY=value lines; the process environment wins
  --bail                stop at the first failure
  --delay <ms>          wait between requests
  --timeout <ms>        timeout for requests that do not set their own
  --insecure            skip TLS certificate verification
  --data <file>         run once per row of a CSV (header row) or JSON (array of
                        objects) file; a row's values override the environment,
                        and the variables iteration and iterationCount are set
  --iterations <n>      repeat the run n times, or use only the first n data rows
  --parallel <n>        run up to n at once: iterations when there are several
                        (each keeps its order and extraction chaining),
                        otherwise single requests, which do not see each
                        other's extracted variables
  --only <name>         run only requests with this name, id or Folder/Name
                        (repeatable)
  --env-file <file>     read KEY=value lines as variables (--var wins)
  --reporter <format>   text, json, junit or html (default text)
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
  --allow-host <host>   let the agent call this host as well (repeatable; * for
                        any). Without it the agent reaches only localhost and
                        the hosts the workspace's own requests already use
  --block-private       refuse requests to private and loopback addresses

mock
  Serve the saved examples of a workspace on 127.0.0.1, one route per request,
  and print each request as it arrives.

  --env <name>          environment used to resolve {{variables}} in URLs
  --port <number>       port to listen on (default 4010)
  --delay <ms>          wait before every answer
  --cors                allow browser requests from localhost origins

docs
  Write the collection as one self-contained HTML page: every request with its
  parameters, headers, body, a curl example and its saved examples. Variables
  stay as {{name}} and literal credentials are replaced with <redacted>.

  --output <file>       write the page to this file (default: stdout)
  --title <text>        page title (default: API documentation)
  --no-examples         leave out the saved example responses

capture
  Forward every request sent to 127.0.0.1 on to one API and print each
  exchange. Point the app at the local address instead of the API; nothing is
  intercepted, so an app whose base URL cannot be changed is not captured.

  --upstream <url>      API to forward to, for example https://api.example.com
  --port <number>       port to listen on (default 4020)
  --workspace <folder>  save each new method and path as a request, with its
                        response as an example, in this workspace
  --folder <name>       top-level workspace folder to save into
                        Authorization, Cookie and Proxy-Authorization request
                        headers are never saved

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
	case "mock":
		return mockCommand(arguments[1:], stdout, stderr)
	case "docs":
		return docsCommand(arguments[1:], stdout, stderr)
	case "capture":
		return captureCommand(arguments[1:], stdout, stderr)
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
