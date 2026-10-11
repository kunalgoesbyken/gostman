package agent

import (
	"net/http"

	"github.com/krockxz/gostman/mcp"
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
	"you can keep using {{name}} in later requests, but you cannot read the value. Start with list_requests."

var adHocMethods = []string{
	http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodHead, http.MethodOptions,
}

var requestReference = text("The request's id, or its name. A name that is used twice needs the folder in front, such as auth/Login.")

var noInput = object(map[string]schema{})

var listInput = object(map[string]schema{
	"folder": text("Only list this folder and the folders inside it. A name such as auth or a path such as auth/tokens. Leave out to list everything."),
})

var getInput = object(map[string]schema{"request": requestReference}, "request")

var sendInput = object(map[string]schema{
	"request":         requestReference,
	"method":          choice("Ad hoc only. Defaults to GET.", adHocMethods),
	"url":             text("Ad hoc only: the address to call. May contain {{variables}}, for example {{baseUrl}}/users/1."),
	"headers":         textMap("Ad hoc only: header names and values. Reference credentials as variables, for example {\"Authorization\": \"Bearer {{token}}\"}."),
	"body":            text("Ad hoc only: the request body as text. For body_type form, a JSON object of field names and values."),
	"body_type":       choice("Ad hoc only. Defaults to json when the body parses as JSON, otherwise text.", textBodyTypes),
	"variables":       textMap("Variables to set before sending. They stay set for the rest of the session."),
	"select":          text("A JSONPath applied to a JSON response body, such as $.items[0].id or $.data[*].name. Only the match is returned, which keeps large responses small."),
	"max_body_bytes":  whole("How much of the body to return. Defaults to 8192.", 1, HighestBodyBytes),
	"include_headers": flag("Also return the response headers. Credential headers stay hidden."),
})

var runInput = object(map[string]schema{
	"folder": text("The folder to run, by name or path. Leave out to run every request in the workspace."),
	"bail":   flag("Stop at the first failing request."),
})

var assertionInput = object(map[string]schema{
	"expression": text("What to check: res.status, res.body.id, res.headers.content-type, res.responseTime, or a JSONPath starting with $."),
	"operator":   choice("How to compare. The operators from isDefined onwards take no value.", assertionOperators),
	"value":      text("The expected value, as text. Leave out for operators that take no value."),
}, "expression", "operator")

var saveInput = object(map[string]schema{
	"id":         text("The id of the request to update. Leave out to create a new request."),
	"name":       text("Required for a new request."),
	"folder":     text("The folder path to keep the request in, such as auth/tokens. Missing folders are created. An empty string moves it to the top level."),
	"method":     text("GET, POST and so on. Defaults to GET."),
	"url":        text("Required for a new request. Use {{variables}} for hosts and credentials, for example {{baseUrl}}/users."),
	"headers":    textMap("Replaces the request's headers. Credentials must be variable references."),
	"body":       text("The request body as text."),
	"body_type":  choice("How the body is sent.", textBodyTypes),
	"assertions": list("Replaces the request's checks. They run every time the request is sent, here and in the app.", assertionInput),
})

var environmentInput = object(map[string]schema{
	"name": text("The environment's name, as list_environments shows it."),
}, "name")

var mockInput = object(map[string]schema{
	"port":     whole("The localhost port to listen on. Defaults to 4010.", lowestPort, highestPort),
	"delay_ms": whole("Wait this long before every answer.", 0, highestDelay),
})

func (d *Desk) Tools() []mcp.Tool {
	return []mcp.Tool{
		{
			Name: "list_requests",
			Description: "List the API requests saved in this Gostman workspace: id, name, method, URL template, folder, and whether each has tests and saved example responses. " +
				"Call this first to find a request to send instead of writing a curl command.",
			InputSchema: listInput,
			ReadOnly:    true,
			Handle:      bind(d, (*Desk).listRequests),
		},
		{
			Name: "get_request",
			Description: "Show one saved request in full: URL, headers, body, auth settings, assertions, extraction rules, scripts and the names of its saved examples. " +
				"Credentials are masked; variables appear as {{name}}.",
			InputSchema: getInput,
			ReadOnly:    true,
			Handle:      bind(d, (*Desk).getRequest),
		},
		{
			Name: "send_request",
			Description: "Send a saved request (give request) or an ad hoc one (give url). Prefer this over curl in a shell: Gostman fills in {{variables}}, auth, cookies and OAuth tokens itself, " +
				"so no secret has to appear in the command or in the result, and a login made by one call is still in effect for the next. " +
				"Saved requests also run their scripts, extraction rules and assertions. " +
				"Returns two parts: a JSON summary (status, duration, size, content type, test results, script console output, names of cookies and variables that were set, " +
				"and body.bytes, body.returnedBytes, body.truncated) followed by the response body as text. " +
				"When body.truncated is true, narrow the answer with select or raise max_body_bytes. failed is true when the request could not be sent or a test did not pass.",
			InputSchema: sendInput,
			Handle:      bind(d, (*Desk).sendRequest),
		},
		{
			Name: "run_folder",
			Description: "Send every request in a folder, or in the whole workspace, in order, with scripts and assertions, the way the collection runner does. " +
				"Use it to check that an API still works after a change. Returns the counts and, for failed requests only, the error, the failed tests and the console output.",
			InputSchema: runInput,
			Handle:      bind(d, (*Desk).runFolder),
		},
		{
			Name: "save_request",
			Description: "Create a request in the workspace, or update one by id, so the developer finds it in the Gostman app and it can be re-run later. Only the fields you give are changed. " +
				"Secrets are refused: a value that matches a variable or a credential must be written as {{name}}. Returns the request's id, name and folder.",
			InputSchema: saveInput,
			Handle:      bind(d, (*Desk).saveRequest),
		},
		{
			Name: "list_environments",
			Description: "List the environments of the workspace with the names of their variables, which one is active, and the names of the variables set in this session. " +
				"Values are never returned; reference a variable as {{name}}.",
			InputSchema: noInput,
			ReadOnly:    true,
			Handle:      bind(d, (*Desk).listEnvironments),
		},
		{
			Name: "set_environment",
			Description: "Choose the environment whose variables fill in {{name}} for the rest of this session, for example to switch from Local to Staging. " +
				"The environment's variables are read again and variables set by earlier requests are cleared; cookies and OAuth tokens are kept.",
			InputSchema: environmentInput,
			Handle:      bind(d, (*Desk).setEnvironment),
		},
		{
			Name: "start_mock",
			Description: "Start a mock server on localhost that answers each saved request's path with its saved example response. " +
				"Use it to develop against an API that is not running. Returns the address and, per request, whether it is served and why not.",
			InputSchema: mockInput,
			Handle:      bind(d, (*Desk).startMock),
		},
		{
			Name:        "stop_mock",
			Description: "Stop the mock server started with start_mock.",
			InputSchema: noInput,
			Handle:      bind(d, (*Desk).stopMock),
		},
		{
			Name:        "mock_status",
			Description: "Report whether the mock server is running, its address, its routes refreshed from the workspace, and the last requests it answered.",
			InputSchema: noInput,
			ReadOnly:    true,
			Handle:      bind(d, (*Desk).mockStatus),
		},
	}
}
