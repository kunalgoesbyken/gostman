package main

import (
	"fmt"
	"io"
	"os"
	"runtime/debug"
	"strings"

	"github.com/kunalgoesbyken/gostman/engine"
)

const (
	exitPassed = 0
	exitFailed = 1
	exitUsage  = 2
	exitUnsent = 3

	programName    = "gostman"
	flagParseError = "parse error"
	usageHint      = `Run "gostman help" to see the commands and flags.`
	usage          = `Usage:
  gostman run <export.json | workspace folder | Bruno folder> [flags]
  gostman flow run <name | flow.yaml> [--workspace <folder | export.json>] [flags]
  gostman flow list [--workspace <folder | export.json>] [--json]
  gostman send [flags] <request>
  gostman send [flags] <METHOD> <url>
  gostman load <export.json | workspace folder> --request <name> [flags]
  gostman load [flags] <METHOD> <url>
  gostman mcp [flags]
  gostman mock [workspace folder] [flags]
  gostman docs <workspace folder | export.json> [flags]
  gostman capture --upstream <url> [flags]
  gostman relay [flags]
  gostman scan <workspace folder | export.json> [flags]
  gostman lint <spec file | address> [flags]
  gostman init [folder] [--skill]
  gostman import <file | folder> --out <workspace folder> [flags]
  gostman export <workspace folder> --format <format> --out <path>
  gostman version

run
  Run every request of a Gostman export or workspace folder in order, with its
  scripts, checks, extraction rules, cookies and OAuth 2 tokens. A Bruno
  collection folder (bruno.json or opencollection.yml) is converted in memory.

  --env <name>          environment to use (default: the first one); in an
                        export with environments per collection, each
                        collection uses its own environment of that name or
                        the shared one; with --folder, one environment, which
                        can be named Collection/Name
  --folder <name|path>  run only this folder, for example auth or auth/tokens
  --var <key=value>     set a variable; it wins over the environment, folder
                        and request variables (repeatable)
  --var-from-env <NAME> set the variable NAME from the environment variable
                        NAME, so the value is not typed or stored (repeatable)
  --secrets             allow variables that reference a secret manager
                        (Vault, AWS, Azure, Google Cloud, 1Password,
                        Bitwarden, Bitwarden Secrets Manager) to be read
                        with the credentials in the process environment; off
                        by default so that a collection you did not write
                        cannot use them (also for send and mcp)
  --secrets-env-file <file>
                        like --secrets, with the connection settings read from
                        KEY=value lines; the process environment wins
  --bail                stop at the first failure
  --delay <ms>          wait between requests
  --timeout <ms>        timeout for requests that do not set their own
  --insecure            skip TLS certificate verification
  --allow-files         let {{$file(path)}} and {{$fileBase64(path)}} read
                        files; relative paths start at the workspace folder or
                        the folder of the export file; off by default so that
                        a collection you did not write cannot send your files
                        (also for send and load)
  --data <file>         run once per row of a CSV (header row) or JSON (array of
                        objects) file; a row's values win over --var and the
                        environment, folder and request variables, and the
                        variables iteration and iterationCount are set
  --iterations <n>      repeat the run n times, or use only the first n data rows
                        (at most 10000 iterations; more exits with status 2)
  --stream-timeout <s>  time budget for each streaming (SSE) request in a run
                        (default 10 seconds, at most 100 events unless the
                        request sets its own); the report says how it ended
  --parallel <n>        send up to n requests of an iteration at once;
                        iterations run one after another, and requests sent
                        together see only values written before they started
  --only <name>         run only requests with this name, id or Folder/Name
                        (repeatable)
  --tags <a,b>          run only requests with at least one of these tags
                        (comma list, repeatable)
  --exclude-tags <a,b>  skip requests with any of these tags (comma list,
                        repeatable); combines with --folder, --only and --tags
  --env-file <file>     read KEY=value lines as variables (--var wins); they
                        count as secret for --redact
  --reporter <format[:file]>
                        text, json, junit or html (default text); with :file
                        the report goes to that file (repeatable, at most one
                        without a file, which prints to stdout)
  --output <file>       write the report given without a file to this file;
                        when every report goes to a file, the text summary is
                        still printed to stdout
  --redact              replace secret values in the report with {{name}}:
                        variables marked secret or with sensitive names,
                        secret manager, --var-from-env and --env-file values,
                        tokens, credentials and cookies; other values such as
                        base_url stay readable
  --contract <spec>     check every HTTP response against this OpenAPI spec
                        (file or address): the status, the content type and
                        the body schema of the operation with the same method
                        and path; a mismatch fails the run like any check
  --cacert <file>       trust the PEM or DER certificates in this file as well
                        as the system's (repeatable)
  --client-cert <file> --client-key <file>
                        present this PEM certificate and key to every host; a
                        PFX/P12 file, or a PEM file that holds the key, needs
                        no --client-key
  --client-cert <host=cert,key>
                        present this certificate and key to this host only
                        (host=file.p12 for a PFX/P12 file); *.example.com
                        covers subdomains (repeatable)
  --client-cert-pass-env <NAME>
                        read the passphrase of encrypted keys and PFX/P12
                        files from this environment variable
  --proxy <url>         send through this http, https or socks5 proxy instead
                        of the one in HTTPS_PROXY, HTTP_PROXY and NO_PROXY,
                        which are used otherwise
  --noproxy <hosts>     comma-separated hosts that skip --proxy; *.example.com
                        matches subdomains
                        These also apply to gRPC, OAuth 2 token requests and
                        sendRequest in scripts. A workspace folder's
                        gostman.yaml network section is applied first; these
                        flags win over it.
  --oauth-token-env <NAME>
                        use this environment variable as the access token of
                        requests whose OAuth 2 grant needs a browser sign-in
                        (authorization code, device code)
  --oauth-refresh-token-env <NAME>
                        exchange this refresh token for an access token for
                        those requests
  --flow <name|file>    run this flow of the collection instead of every
                        request (see flow)

flow
  Run a flow: saved requests chained one after another, tried again until they
  pass, with another step to go to when one fails, conditions, loops over a
  list in a response and values passed from one response to the next. Flows
  are kept in flows/*.yaml of a workspace folder and in Gostman exports. The
  exit status follows the flow: a failure the flow handles, by trying again or
  by going to another step, does not fail it; an End step can fail it.

  run <name|id|file>    the flow to run: its name or id, or a flow YAML file
  list                  print the flows with their number of steps and ids
  --workspace <path>    workspace folder or export file (default: the current
                        folder, or the workspace that holds the flow file)
  --env, --var, --var-from-env, --env-file, --secrets, --secrets-env-file,
  --timeout, --insecure, --allow-files, --stream-timeout, --reporter, --output,
  --redact, --contract  as for run
  --cacert, --client-cert, --client-key, --client-cert-pass-env, --proxy,
  --noproxy             as for run
  --oauth-token-env, --oauth-refresh-token-env
                        as for run
  --json                with list: print the flows as JSON

send
  Send one request through the same pipeline. Stdout gets only the response
  body, or only the selected value with --select, so it can be piped; the JSON
  summary and warnings go to stderr. With --json, stdout gets one JSON
  document with the summary and the body. Secret values are replaced with
  {{name}} in what is printed unless --reveal is given, as with run --redact;
  other values such as base_url stay readable.

  <request>             id, name or Folder/Name of a saved request
  <METHOD> <url>        a request that is not saved
  --workspace <path>    workspace folder or export file (default: the current
                        folder when it is a workspace)
  --env, --var, --var-from-env, --env-file, --timeout, --insecure,
  --allow-files         as for run
  --cacert, --client-cert, --client-key, --client-cert-pass-env, --proxy,
  --noproxy             as for run
  --oauth-token-env, --oauth-refresh-token-env
                        as for run
  -H, --header <name: value>  add a header to an unsaved request (repeatable)
  -d, --data <body>     body of an unsaved request
  --select <jsonpath>   print only this part of a JSON response body
  --max-body <bytes>    print at most this much of the body (default 8192)
  --include-headers     include the response headers in the summary
  --json                print one JSON document: the summary with the body in
                        body.text and its encoding (utf8 or base64) in
                        body.encoding
  --reveal              print secret values and credentials as they are, for
                        example a token for the next command; anything that
                        reads the output sees them, so keep it out of logs
                        and never use it from a coding agent

load
  Send one request many times at once and report throughput, latency
  percentiles, status codes and errors. Dynamic variables such as {{$guid}} are
  generated again for every request. Only target systems you own or have
  permission to test.

  --request <name>      saved request (id, name or Folder/Name) of the workspace
                        or export file given first
  <METHOD> <url>        a request that is not saved; -H, --header and -d, --data
                        describe it as for send
  --concurrency <n>     simultaneous requests (default 10, at most 500)
  --duration <time>     how long to keep sending, for example 30s (default 10s
                        unless --requests is set; at most 10m)
  --requests <n>        stop after n requests (at most 1000000)
  --rps <n>             cap the total requests per second
  --ramp <time>         start the workers one after another over this time
  --fail-status <code>  count this status and above as failed (default 500)
  --env, --var, --var-from-env, --env-file, --timeout, --insecure,
  --allow-files         as for send
  --cacert, --client-cert, --client-key, --client-cert-pass-env, --proxy,
  --noproxy             as for run
  --reporter <format>   text or json (default text)
  --max-p95 <time>      exit 1 when the 95th percentile latency is higher
  --max-error-rate <p>  exit 1 when more than p percent fail, for example 1%
                        Exit 1 also follows an interrupt and a run in which no
                        request succeeded. Pre-request scripts and checks are
                        not part of a load test; cookies are not shared.

mcp
  Serve a workspace to a coding agent over the Model Context Protocol on
  stdin and stdout. Variable values never leave the process.

  --workspace <folder>  workspace folder (default: the current folder)
  --env, --var, --var-from-env, --env-file, --secrets, --secrets-env-file,
  --timeout, --insecure as for run
  --cacert, --client-cert, --client-key, --client-cert-pass-env, --proxy,
  --noproxy             as for run
  --oauth-token-env, --oauth-refresh-token-env
                        as for run
  --allow-host <host>   let the agent call this host as well (repeatable; * for
                        any). Without it the agent reaches only localhost and
                        the hosts of requests a person wrote
  --block-private       refuse requests to private and loopback addresses
  --expose-tag <tag>    offer each request with this tag as a tool of its own,
                        its {{variables}} as parameters (repeatable)
  --listen <port>       serve over Streamable HTTP at 127.0.0.1:<port>/mcp
                        instead of stdin and stdout; clients send the bearer
                        token printed at start (or GOSTMAN_MCP_TOKEN)

mock
  Serve the saved examples of a workspace on 127.0.0.1, one route per request,
  and print each request as it arrives. A request picks another example of its
  route with the x-mock-response-name or x-mock-response-code header.

  --env <name>          environment for {{variables}} in URLs; a variable in
                        the path matches any value
  --openapi <file|url>  also serve the operations of an OpenAPI or Swagger
                        spec: paths, status codes, headers and example bodies
                        (alone, it serves only the spec)
  --port <number>       port to listen on (default 4010)
  --delay <ms>          wait before every answer
  --delay-max <ms>      with --delay, wait a random time between the two
  --error-rate <pct>    answer this percentage of requests with an error
  --error-status <code> status of those errors (default 500)
  --cors                answer browsers only for localhost origins (any port,
                        127.0.0.1 and [::1] too); other origins get no CORS headers
  --cors-origin <url>   also allow this exact origin, e.g. https://app.example.com
                        (repeatable; implies --cors)
  --log                 also print each request's headers and body;
                        credential headers and query values show as ***

  Rules, per-route options and an imported spec saved by the desktop app
  are read from .gostman/mock.yaml in the workspace folder.

docs
  Write the collection as one self-contained HTML page: every request with its
  parameters, headers, body, a curl example and its saved examples. Variables
  stay as {{name}} and literal credentials are replaced with <redacted>.

  --output <file>       write the page to this file (default: stdout)
  --title <text>        page title (default: API documentation)
  --no-examples         leave out the saved example responses
  --playground          add a "Try it" panel to each request that sends it from the
                        reader's browser; secrets are left empty for the reader

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

relay
  Let the Gostman web app send its requests from this computer instead of the
  hosted relay, so it reaches localhost and private addresses with nobody in
  between. Listens on 127.0.0.1 only and answers only the Gostman web app,
  pages served on localhost and programs on this computer.

  --port <number>       port to listen on (default: a free port)
  --origin <url>        also allow the web app served from this exact origin,
                        e.g. https://gostman.example.com (repeatable)
  --cacert, --client-cert, --client-key, --client-cert-pass-env, --proxy,
  --noproxy             as for run; they apply to every request the web app
                        sends through the relay

scan
  Look for credentials typed into a Gostman workspace folder or a Gostman,
  Postman or other supported export: well-known token formats, random-looking
  values in fields named like a credential, and literal passwords or tokens in
  auth settings. Values that are {{variables}} or placeholders are ignored.
  Findings show at most the first 4 characters of a value, never the value.

  --reporter <format>   text or json (default text)
  --fail-on <level>     high, medium or none (default medium): the lowest
                        severity that makes the command exit with status 1
  --skip-examples       leave out saved example responses, which are scanned
                        by default because they can hold real tokens

lint
  Check an OpenAPI 3.x or Swagger 2.0 document (JSON or YAML, a file or an
  http(s) address) against the built-in rules and print the findings.

  --reporter <format>   text, json or junit (default text)
  --fail-on <level>     error, warning or none (default error): the lowest
                        severity that makes the exit status 1
  --config <file>       rule settings; without it .gostman/lint.yaml in the
                        current folder is used when it exists. Under "rules:"
                        give a rule id and error, warning, info or off

init
  Create an empty workspace in the folder (default: the current folder), or in
  a gostman folder inside it when it already holds other files, and print how
  to register the MCP server with a coding agent. Nothing is overwritten.

  --skill               also write the Gostman skill for coding agents to
                        .claude/skills/gostman/SKILL.md in the current folder

import
  Create a workspace from an Insomnia, HAR, WSDL, Bruno, Postman, OpenAPI,
  Gostman export or .http file or folder. Imports add data only; scripts and
  OAuth settings are kept and reported, tokens and cookie values are never
  carried over.

  --format <name>       auto, insomnia, har, wsdl, bruno, postman, openapi,
                        gostman or http (default auto: detected from the
                        content)
  --out <folder>        workspace folder to create (required)
  --skip-static         HAR: leave out images, fonts, styles and scripts

export
  Write a workspace as postman (a Collection v2.1 file with the collection
  variables), bruno (a folder of .bru files), openapi, curl (a shell script;
  credentials become environment variable placeholders, listed at the top),
  har or http (.http files for VS Code REST Client and JetBrains HTTP Client).

  --format <name>       postman, bruno, openapi, curl, har or http
  --out <path>          file, or folder when the export has several files
                        (required)
  --include-secrets     write literal credentials; by default passwords, tokens
                        and secret-named headers or variables become {{NAME}}
                        placeholders and re-import as empty variables

Exit codes:
  0  every request and check passed; for a flow, it reached its end (scan,
     lint, load: no threshold reached)
  1  a check, a script or an MCP tool call failed, or the run was interrupted
     (scan, lint, load: a threshold was reached)
  2  the command or the input is wrong
  3  a request got no response: it could not be sent, the connection failed
     or timed out (run and send)
`
)

var version = "dev"

func currentVersion() string {
	info, ok := debug.ReadBuildInfo()
	if version != "dev" || !ok || !strings.HasPrefix(info.Main.Version, "v") {
		return version
	}
	return strings.TrimPrefix(info.Main.Version, "v")
}

func main() {
	engine.ProductVersion = currentVersion()
	os.Exit(dispatch(os.Args[1:], os.Stdout, os.Stderr))
}

func misuse(stderr io.Writer, message string) int {
	fmt.Fprintf(stderr, "%s: %s\n%s\n", programName, plainFlagMessage(message), usageHint)
	return exitUsage
}

func plainFlagMessage(message string) string {
	if name, found := strings.CutPrefix(message, "flag provided but not defined: -"); found {
		return fmt.Sprintf("unknown flag %s", flagName(name))
	}
	if name, found := strings.CutPrefix(message, "flag needs an argument: -"); found {
		return fmt.Sprintf("%s needs a value", flagName(name))
	}
	rest, found := strings.CutPrefix(message, "invalid value ")
	value, flagPart, split := strings.Cut(rest, " for flag -")
	name, reason, named := strings.Cut(flagPart, ":")
	if !found || !split || !named {
		return message
	}
	plain := fmt.Sprintf("%s is not a valid value for %s", value, flagName(name))
	if reason = strings.TrimSpace(reason); reason == "" || reason == flagParseError {
		return plain
	}
	return plain + ": " + reason
}

func flagName(name string) string {
	if len(name) == 1 {
		return "-" + name
	}
	return "--" + name
}

var helpFlags = map[string]bool{"-h": true, "-help": true, "--help": true}

func asksForHelp(arguments []string) bool {
	for _, argument := range arguments {
		if argument == "--" {
			return false
		}
		if helpFlags[argument] {
			return true
		}
	}
	return false
}

func dispatch(arguments []string, stdout, stderr *os.File) int {
	if len(arguments) == 0 {
		return misuse(stderr, "name a command")
	}
	if asksForHelp(arguments[1:]) {
		fmt.Fprint(stdout, helpFor(arguments[0]))
		return exitPassed
	}
	switch arguments[0] {
	case "run":
		return runCommand(arguments[1:], stdout, stderr)
	case "send":
		return sendCommand(arguments[1:], stdout, stderr)
	case "flow":
		return flowCommand(arguments[1:], stdout, stderr)
	case "load":
		return loadCommand(arguments[1:], stdout, stderr)
	case "mcp":
		return mcpCommand(arguments[1:], stdout, stderr)
	case "mock":
		return mockCommand(arguments[1:], stdout, stderr)
	case "docs":
		return docsCommand(arguments[1:], stdout, stderr)
	case "capture":
		return captureCommand(arguments[1:], stdout, stderr)
	case "relay":
		return relayCommand(arguments[1:], stdout, stderr)
	case "scan":
		return scanCommand(arguments[1:], stdout, stderr)
	case "lint":
		return lintCommand(arguments[1:], stdout, stderr)
	case "import":
		return importCommand(arguments[1:], stdout, stderr)
	case "export":
		return exportCommand(arguments[1:], stdout, stderr)
	case "init":
		return initCommand(arguments[1:], stdout, stderr)
	case "version", "--version":
		fmt.Fprintln(stdout, currentVersion())
		return exitPassed
	case "help", "--help", "-h":
		fmt.Fprint(stdout, helpFor(strings.Join(arguments[1:min(len(arguments), 2)], "")))
		return exitPassed
	default:
		return misuse(stderr, fmt.Sprintf("unknown command %q", arguments[0]))
	}
}
