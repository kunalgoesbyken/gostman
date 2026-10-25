package agent

import (
	"net/http"

	"github.com/kunalgoesbyken/gostman/importer"
	"github.com/kunalgoesbyken/gostman/mcp"
)

const (
	lowestPort   = 1024
	highestPort  = 65535
	highestDelay = 60000
)

const Instructions = "Gostman sends HTTP, GraphQL and gRPC requests from the API collection kept in this workspace, the same one the developer uses in the Gostman app. " +
	"Use these tools instead of curl in a shell: credentials are filled in from variables inside Gostman and never appear in a result, " +
	"cookies, OAuth tokens and variables set by one request carry over to the next for as long as this server runs, " +
	"and responses come back trimmed with their test results. " +
	"Write {{name}} wherever a variable's value belongs. Text shown as {{name}} or {{redacted:...}} in a result is a value Gostman hid on purpose; " +
	"you can keep using {{name}} in later requests, but you cannot read the value. " +
	"A {{name}} that no variable defines is sent as it is; list_environments shows the defined names, and set_environment chooses the environment. " +
	"Requests reach only localhost, the hosts the person's own requests use and hosts the developer allowed with --allow-host; when a host is refused, ask the developer to allow it instead of reaching it another way. " +
	"To log in, give the login request an extractor with save_request so its token is kept as {{token}} without appearing in a result. " +
	"Start with list_requests; import_requests adds requests from a spec or curl command."

var adHocMethods = []string{
	http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodHead, http.MethodOptions,
}

var importFormats = []string{
	importer.FormatAuto, importer.FormatOpenAPI, importer.FormatPostman, importer.FormatInsomnia, importer.FormatBruno,
	importer.FormatHAR, importer.FormatHTTP, importer.FormatWSDL, formatCurl,
}

var (
	readOnly    = mcp.Hints{ReadOnly: true, Idempotent: true}
	sending     = mcp.Hints{Destructive: true, OpenWorld: true}
	sessionOnly = mcp.Hints{Idempotent: true}
)

var requestReference = text("The request's id, or its name. A name that is used twice needs its folder path in front, as list_requests shows it, such as auth/Login.")

var noInput = object(map[string]schema{})

var listInput = object(map[string]schema{
	"folder": text("Only list this folder and the folders inside it. A name such as auth or a path such as auth/tokens. Leave out to list everything."),
})

var getInput = object(map[string]schema{"request": requestReference}, "request")

var selectInput = text("A JSONPath applied to a JSON response body, such as $.items[0].id or $.data[*].name. Only the match is returned, which keeps large responses small.")

var bodyLimitInput = whole("How much of the body to return. Defaults to 8192.", 1, HighestBodyBytes)

var headersInput = flag("Also return the response headers. Credential headers stay hidden.")

var sendInput = object(map[string]schema{
	"request":         requestReference,
	"method":          choice("Ad hoc only. Defaults to GET.", adHocMethods),
	"url":             text("Ad hoc only: the address to call. May contain {{variables}}, for example {{baseUrl}}/users/1."),
	"headers":         textMap("Ad hoc only: header names and values. Reference credentials as variables, for example {\"Authorization\": \"Bearer {{token}}\"}."),
	"body":            text("Ad hoc only: the request body as text. For body_type form, a JSON object of field names and values."),
	"body_type":       choice("Ad hoc only. Defaults to json when the body parses as JSON, otherwise text.", textBodyTypes),
	"variables":       textMap("Variables to set before sending, such as {\"id\": \"42\"}. They win over the environment and the request's own variables, and stay set until set_environment."),
	"select":          selectInput,
	"max_body_bytes":  bodyLimitInput,
	"include_headers": headersInput,
})

var runInput = object(map[string]schema{
	"folder":       text("The folder to run, by name or path. Leave out to run every request in the workspace."),
	"bail":         flag("Stop at the first failing request."),
	"tags":         list("Run only requests with at least one of these tags, as list_requests shows them. Case does not matter.", text("A tag.")),
	"exclude_tags": list("Skip requests with any of these tags.", text("A tag.")),
	"data":         list("Run once per item; each item's fields become variables for that iteration, such as [{\"userId\": 1}, {\"userId\": 2}], and win over the environment and a request's own vars.", schema{"type": "object"}),
	"iterations":   whole("Repeat the run this many times, or use only the first rows of data.", 1, highestIterations),
})

var assertionInput = object(map[string]schema{
	"expression": text("What to check: res.status, res.body.id, res.body[0].id, res.headers.content-type or res.responseTime."),
	"operator":   choice("How to compare. The operators from isDefined onwards take no value.", assertionOperators),
	"value":      text("The expected value, as text or a {{variable}}; it is not evaluated as an expression. Leave out for operators that take no value."),
}, "expression", "operator")

var extractorInput = object(map[string]schema{
	"name":       text("The variable to store the value in, such as token. Later requests use it as {{token}}."),
	"source":     choice("Where the value comes from.", extractorSources),
	"expression": text("For body, a JSONPath such as $.token or $.data.id; for header or cookie, its name. Leave out for status."),
}, "name", "source")

var saveInput = object(map[string]schema{
	"id":          text("The id of the request to update. Leave out to create a new request."),
	"name":        text("Required for a new request."),
	"description": text("What the request does, in a sentence. Shown in the app and used as the tool description with --expose-tag."),
	"folder":      text("The folder path to keep the request in, such as auth/tokens. Missing folders are created. An empty string moves it to the top level."),
	"method":      text("GET, POST and so on. Defaults to GET."),
	"url":         text("Required for a new request. Use {{variables}} for hosts and credentials, for example {{baseUrl}}/users."),
	"headers":     textMap("Replaces the request's headers. Credentials must be variable references."),
	"body":        text("The request body as text."),
	"body_type":   choice("How the body is sent.", textBodyTypes),
	"tags":        list("Replaces the request's tags, such as smoke. run_folder runs a tagged subset.", text("A tag.")),
	"assertions":  list("Replaces the request's checks. They run every time the request is sent, here and in the app.", assertionInput),
	"extractors":  list("Replaces the request's extraction rules. After each response, every rule stores a value in a session variable, so a login can hand its token to later requests as {{token}} without the token appearing in a result.", extractorInput),
})

var importInput = object(map[string]schema{
	"content": text("The document to import: an OpenAPI or Swagger spec, a Postman, Insomnia or Bruno collection, a HAR file, .http requests or a curl command."),
	"url":     text("Fetch the document from this address instead of giving content. Only hosts this session may call are reached."),
	"format":  choice("Defaults to auto, detected from the content.", importFormats),
	"folder":  text("Put everything in this folder path, such as imported/petstore. Missing folders are created. Leave out to import at the top level."),
})

var variablesInput = object(map[string]schema{
	"environment": text("The environment to change, as list_environments shows it. Defaults to the active one. A name that does not exist yet creates that environment."),
	"variables":   textMap("Names and plain values, such as {\"baseUrl\": \"http://localhost:8080\"}. Credentials are refused; the developer sets those in the app or with --var-from-env."),
}, "variables")

var environmentInput = object(map[string]schema{
	"name": text("The environment's name, as list_environments shows it."),
}, "name")

var mockInput = object(map[string]schema{
	"port":     whole("The localhost port to listen on. Defaults to 4010.", lowestPort, highestPort),
	"delay_ms": whole("Wait this long before every answer.", 0, highestDelay),
})

var responseInput = object(map[string]schema{
	"request":         requestReference,
	"example":         text("The saved example to compare with, by name. Defaults to the request's default example, or its first."),
	"shape_only":      flag("Compare only the structure and value types of a JSON body, not the values, so ids and timestamps may differ."),
	"select":          selectInput,
	"max_body_bytes":  bodyLimitInput,
	"include_headers": headersInput,
}, "request")

var lintInput = object(map[string]schema{
	"content": text("The OpenAPI 3 or Swagger 2 document as JSON or YAML text."),
	"url":     text("Fetch the document from this address instead. Only hosts this session may call are reached."),
})

var scanInput = object(map[string]schema{
	"skip_examples": flag("Leave out saved example responses, which are scanned by default."),
})

var loadInput = object(map[string]schema{
	"request":          requestReference,
	"concurrency":      whole("Requests in flight at once. Defaults to 5.", 1, highestLoadConcurrency),
	"duration_seconds": whole("How long to keep sending. Defaults to 10 unless requests is given.", 1, highestLoadSeconds),
	"requests":         whole("Stop after this many requests.", 1, highestLoadRequests),
	"rps":              whole("Cap the total requests per second.", 1, highestLoadRate),
}, "request")

func (d *Desk) Tools() []mcp.Tool {
	tools := []mcp.Tool{
		tool(d, mcp.Tool{
			Name:  "list_requests",
			Title: "List requests",
			Description: "List the API requests saved in this Gostman workspace: id, name, method, URL template, folder, tags, whether each has checks (hasTests) and whether it has saved example responses. " +
				"Call this first to find a request to send instead of writing a curl command.",
			InputSchema: listInput,
			Hints:       readOnly,
		}, filesOnly, (*Desk).listRequests),
		tool(d, mcp.Tool{
			Name:  "get_request",
			Title: "Show request",
			Description: "Show one saved request in full: URL, headers, body, auth settings, its own variables (vars), assertions, extraction rules, scripts and the names of its saved examples. " +
				"Credentials are masked; variables appear as {{name}}. options lists only the settings that differ from the defaults.",
			InputSchema: getInput,
			Hints:       readOnly,
		}, filesOnly, (*Desk).getRequest),
		tool(d, mcp.Tool{
			Name:  "send_request",
			Title: "Send request",
			Description: "Send a saved request (give request) or an ad hoc one (give url). Prefer this over curl in a shell: Gostman fills in {{variables}}, auth, cookies and OAuth tokens itself, " +
				"so no secret has to appear in the command or in the result, and a login made by one call is still in effect for the next. " +
				"Saved requests also run their scripts, extraction rules and assertions. " +
				"Returns two parts: a JSON summary (status, duration, size, content type, test results, script console output, names of cookies and variables that were set, " +
				"and body.bytes, body.returnedBytes, body.truncated) followed by the response body as text. " +
				"When body.truncated is true, narrow the answer with select or raise max_body_bytes. failed is true when the request could not be sent or a test did not pass.",
			InputSchema: sendInput,
			Hints:       sending,
		}, withSession, (*Desk).sendRequest),
		tool(d, mcp.Tool{
			Name:  "run_folder",
			Title: "Run folder",
			Description: "Send every request in a folder, or in the whole workspace, in order, with scripts and assertions, the way the collection runner does. " +
				"tags and exclude_tags narrow the run to a subset such as smoke tests; data and iterations repeat it. " +
				"Use it to check that an API still works after a change. Returns the counts and, for failed requests only, the error, the failed checks (failedTests) and the console output.",
			InputSchema: runInput,
			Hints:       sending,
		}, withSession, (*Desk).runFolder),
		tool(d, mcp.Tool{
			Name:  "last_response",
			Title: "Last response",
			Description: "Show the last response a saved request got in this session, from send_request or run_folder, without sending it again. " +
				"When the request has saved examples, also compare the response with one: status, content type and, for JSON, the paths that differ.",
			InputSchema: responseInput,
			Hints:       readOnly,
		}, withSession, (*Desk).lastResponse),
		tool(d, mcp.Tool{
			Name:  "save_request",
			Title: "Save request",
			Description: "Create a request in the workspace, or update one by id, so the developer finds it in the Gostman app and it can be re-run later. Only the fields you give are changed. " +
				"Secrets are refused: a value that matches a variable or a credential must be written as {{name}}. Returns the request's id, name and folder.",
			InputSchema: saveInput,
			Hints:       mcp.Hints{Destructive: true},
		}, filesOnly, (*Desk).saveRequest),
		tool(d, mcp.Tool{
			Name:  "import_requests",
			Title: "Import requests",
			Description: "Add requests to the workspace from an OpenAPI or Swagger spec, a Postman, Insomnia or Bruno collection, a HAR file, .http requests or a curl command. " +
				"Nothing existing is changed. Scripts and OAuth 2.0 settings are removed (listed in leftOut; warnings describe the source document), " +
				"and an import that holds a credential, reads local files or runs local commands is refused. Returns what was added.",
			InputSchema: importInput,
			Hints:       mcp.Hints{OpenWorld: true},
		}, filesOnly, (*Desk).importRequests),
		tool(d, mcp.Tool{
			Name:  "list_environments",
			Title: "List environments",
			Description: "List the environments of the workspace with the names of their variables, which one is active, and the names of the variables set in this session. " +
				"Values are never returned; reference a variable as {{name}}.",
			InputSchema: noInput,
			Hints:       readOnly,
		}, withSession, (*Desk).listEnvironments),
		tool(d, mcp.Tool{
			Name:  "set_environment",
			Title: "Choose environment",
			Description: "Choose the environment whose variables fill in {{name}} for the rest of this session, for example to switch from Local to Staging. " +
				"The environment's variables are read again and variables set by earlier requests are cleared; cookies and OAuth tokens are kept.",
			InputSchema: environmentInput,
			Hints:       sessionOnly,
		}, withSession, (*Desk).setEnvironment),
		tool(d, mcp.Tool{
			Name:  "set_variables",
			Title: "Set environment variables",
			Description: "Save plain variable values such as baseUrl or userId in an environment file of the workspace, so later requests and the developer's app use them. " +
				"Credentials are refused, and so are variables the developer marked secret. Values set here never let requests reach a new host.",
			InputSchema: variablesInput,
			Hints:       mcp.Hints{Destructive: true, Idempotent: true},
		}, withSession, (*Desk).setVariables),
		tool(d, mcp.Tool{
			Name:  "lint_spec",
			Title: "Lint OpenAPI spec",
			Description: "Check an OpenAPI 3 or Swagger 2 document against Gostman's built-in rules: missing operation ids or descriptions, undeclared path parameters, " +
				"missing error responses, undefined security schemes, broken $refs and similar. Returns the counts and findings.",
			InputSchema: lintInput,
			Hints:       mcp.Hints{ReadOnly: true, Idempotent: true, OpenWorld: true},
		}, filesOnly, (*Desk).lintSpec),
		tool(d, mcp.Tool{
			Name:  "scan_secrets",
			Title: "Scan for secrets",
			Description: "Look for credentials typed into the workspace's requests, environments, scripts and saved examples. " +
				"Findings show where and why, with at most the first four characters of a value. Run it before the developer commits or shares the workspace.",
			InputSchema: scanInput,
			Hints:       readOnly,
		}, filesOnly, (*Desk).scanSecrets),
		tool(d, mcp.Tool{
			Name:  "load_test",
			Title: "Load test",
			Description: "Send one saved request many times at once and report throughput, latency percentiles, status codes and error samples. " +
				"Limited to 20 at once, 30 seconds and 5000 requests, to hosts this session may call. Only test systems the developer owns.",
			InputSchema: loadInput,
			Hints:       sending,
		}, withSession, (*Desk).loadTest),
		tool(d, mcp.Tool{
			Name:  "start_mock",
			Title: "Start mock server",
			Description: "Start a mock server on localhost that answers each saved request's path with its saved example response. " +
				"Use it to develop against an API that is not running. Returns the address and, per request, whether it is served and why not.",
			InputSchema: mockInput,
			Hints:       mcp.Hints{},
		}, withSession, (*Desk).startMock),
		tool(d, mcp.Tool{
			Name:        "stop_mock",
			Title:       "Stop mock server",
			Description: "Stop the mock server started with start_mock.",
			InputSchema: noInput,
			Hints:       sessionOnly,
		}, withSession, (*Desk).stopMock),
		tool(d, mcp.Tool{
			Name:        "mock_status",
			Title:       "Mock server status",
			Description: "Report whether the mock server is running, its address, its routes refreshed from the workspace, and the last requests it answered.",
			InputSchema: noInput,
			Hints:       readOnly,
		}, withSession, (*Desk).mockStatus),
	}
	return append(tools, d.exposedTools(tools)...)
}
