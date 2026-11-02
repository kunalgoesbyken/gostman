# Changelog

All notable changes to Gostman are listed here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Earlier versions are on [GitHub Releases](https://github.com/kunalgoesbyken/gostman/releases).

## [Unreleased]

### Added

- A [VS Code extension](docs/vscode.md) that runs collections, folders and flows, sends a saved request, lints an OpenAPI spec and scans for secrets through the Gostman CLI. The landing page now shows it next to the MCP server for coding agents.
- Inline AI suggestions in the pre-request and post-response script editors: opt-in in the AI settings, sent only after a pause, with variable names but never values, and accepted with Tab; see [Inline suggestions](docs/ai.md#inline-suggestions).
- NATS requests: request and reply, publish, or wait for one message on a subject, over the plain text protocol, in the desktop app; see [NATS](docs/protocols.md#nats).
- The importers read Firecamp collection exports; see [Other tools](docs/import-export-and-specs.md#other-tools).

## [1.9.0] - 2026-11-02

### Added

#### Monitoring and history

- `gostman run --every <duration>` repeats a run on an interval, with `--times`, `--until-fail`, `--record` and `--no-record`; see [Scheduled runs](docs/cli.md#scheduled-runs).
- `gostman history` lists the saved runs with the pass rate, each request's failures and its 50th and 95th percentile duration; see [Scheduled runs](docs/cli.md#scheduled-runs).
- `--notify`, `--notify-env` and `--notify-on` post a JSON summary of a run to a webhook address, for example Slack or Microsoft Teams; see [Scheduled runs](docs/cli.md#scheduled-runs).
- The Monitors dialog (Tools menu, desktop and web) schedules a run, keeps its history with a trend chart and can notify when a run starts failing and when it passes again; see [Monitors](docs/runner-load-and-scan.md#monitors).
- The Run requests dialog can save a run as a monitor, choose an HTML, JUnit or JSON report and copy the matching terminal command for POSIX shells or PowerShell; see [Run requests](docs/runner-load-and-scan.md#run-requests).

#### Testing

- The "matches snapshot" check compares a response body or headers with a stored copy, with ignored JSONPaths and order-insensitive arrays; `gostman run --update-snapshots` rewrites the stored values; see [Checks](docs/requests-and-responses.md#checks).
- `gostman negative` and the Negative tests dialog send altered copies of saved requests and report answers that look wrong; see [Negative tests](docs/cli.md#negative-tests).
- `gostman run --contract --coverage` lists the OpenAPI operations a run did not reach, and `--min-coverage` fails the run below a percentage; see [OpenAPI coverage](docs/runner-load-and-scan.md#openapi-coverage).
- Load tests accept threshold expressions and staged ramps, and the Load test dialog shows pass or fail; see [Threshold expressions](docs/runner-load-and-scan.md#threshold-expressions).
- Data files for the runner can be XLSX workbooks as well as CSV and JSON; see [Data files](docs/runner-load-and-scan.md#data-files).
- A `packages/` folder in a trusted workspace feeds `require` and `pm.require`, and `pm.vault` reads and writes secret environment variables; see [Packages and the vault](docs/scripting-and-settings.md#packages-and-the-vault).
- `gostman diff <old> <new>` and the Compare API specs dialog list breaking changes between two OpenAPI specs, and the spec viewer keeps the last synced spec so changes can be reviewed before applying; see [Comparing two OpenAPI specs](docs/cli.md#comparing-two-openapi-specs).
- `gostman init --ci github|gitlab|azure|circleci|bitbucket` writes a starter pipeline, and pre-commit hook and Makefile recipes are documented; see [Starter pipelines and pre-commit](docs/ci.md#starter-pipelines-and-pre-commit).

#### Capture and mock

- Capture has rules that edit headers and bodies, answer a call locally, inject a failure or hold it, and held calls that you edit, release or drop; `gostman capture --rules <file>` applies a rules file; see [Capture rules](docs/workspaces-and-mock.md#capture-rules).
- The Capture dialog exports calls as HAR and can turn a call into a mock rule or compare two calls; see [Calls, rules and held calls](docs/workspaces-and-mock.md#calls-rules-and-held-calls).
- A tab's kept responses export as HAR, with credentials masked; see [Earlier responses and comparing](docs/requests-and-responses.md#earlier-responses-and-comparing).

#### Git, docs and notes

- The Git panel shows a field-level diff of requests, compares versions and draws a commit graph; see [Changes](docs/collections-and-git.md#changes) and [History](docs/collections-and-git.md#history).
- The Remotes tab can create a GitHub repository from a workspace; see [Remotes](docs/collections-and-git.md#remotes).
- AI can suggest a commit message and generate mock examples; see [What AI can do](docs/ai.md#what-ai-can-do).
- `gostman docs --versions` builds one page per Git tag, and `--logo` and `--accent` brand the page; see [Generated documentation](docs/cli.md#generated-documentation).
- Requests and folders carry notes saved in their files, so teammates review them in Git; see [Notes](docs/requests-and-responses.md#notes).
- A Recently deleted list restores requests and folders you removed; see [Recently deleted](docs/collections-and-git.md#recently-deleted).

#### Protocols and engine

- SignalR connects through negotiation over WebSocket and invokes hub methods; see [SignalR](docs/protocols.md#signalr).
- Raw TCP and UDP requests send text or hex and read the reply, in the desktop app and trusted folders only; see [TCP and UDP](docs/protocols.md#tcp-and-udp).
- SOAP requests can sign with WS-Security; see [WS-Security](docs/protocols.md#ws-security).
- A JSON-RPC call button adds a JSON-RPC 2.0 call or batch to a JSON body; see [JSON-RPC](docs/protocols.md#json-rpc).
- gRPC requests can use gRPC-Web or Connect, which also works from the web app; see [Transports](docs/protocols.md#transports).
- GraphQL requests can upload files with the multipart request spec; see [File uploads](docs/protocols.md#file-uploads).
- JWT auth signs with PEM or JWK private keys; see [Auth](docs/requests-and-responses.md#auth).
- Each request can choose its HTTP version, and the desktop Network settings accept host overrides and IPv4 or IPv6 only; see [Name resolution](docs/secrets-and-network.md#name-resolution).
- Code generation adds axios, Node http, httpx, OkHttp, RestSharp, Guzzle, HTTPie and wget; see [Code generation](docs/requests-and-responses.md#code-generation).

#### Response viewer and search

- Binary responses open in a hex view, and MessagePack and CBOR decode to JSON; a File body can encode JSON as MessagePack or CBOR; see [Body views](docs/requests-and-responses.md#body-views).
- The timeline shows the certificate chain and a redirect table; see [Timeline](docs/requests-and-responses.md#timeline).
- Search everywhere looks through saved requests, history and open responses; see [Search everywhere](docs/requests-and-responses.md#search-everywhere).
- Variable dependencies draws which requests set and read each variable; see [Variable dependencies](docs/requests-and-responses.md#variable-dependencies).
- Show response beside opens another tab's latest response in a second pane; see [Context menu](docs/collections-and-git.md#context-menu).

#### Import and migration

- Importers read Hoppscotch, Thunder Client, HTTPie, Hurl, RAML and API Blueprint files, and Hurl is an export format; see [Other tools](docs/import-export-and-specs.md#other-tools).

#### Navigation and onboarding

- A protocol list before the method picks HTTP, GraphQL, gRPC, WebSocket, Server-Sent Events, Socket.IO, MQTT, SOAP, MCP, SignalR, TCP or UDP; see [The request bar](docs/requests-and-responses.md#the-request-bar).
- The Tools menu groups the dialogs, and Explore features searches the feature catalog, offers a Try it action for each feature and lists What's new; see [Getting started](docs/getting-started.md).
- A four-step tour on first run can be skipped; see [Getting started](docs/getting-started.md).

### Changed

- TCP and UDP moved from the method list to the protocol list, and the method list shows only the methods that apply to the chosen protocol.
- The sidebar tabs carry labels and an add menu, and the status bar shows status only.
- The terminal command in the Run requests dialog is shown for POSIX shells and PowerShell, and it is left out when a folder or data file name holds a control character, a double quote or a trailing backslash.

### Security

- Redaction fails closed: monitor history, notifications and saved runs are cleaned with the run's own redactor and with every variable value, and output that cannot be cleaned is withheld; see [Scheduled runs](docs/cli.md#scheduled-runs).
- Snapshot checks mask credentials and ignored values and fail on known secrets.
- Capture rules from a workspace need folder trust, and the command line reads only the rules file it is given; see [Capture rules](docs/workspaces-and-mock.md#capture-rules).
- Text from imported specs is cleaned before it reaches a terminal.
- MessagePack and CBOR decoding runs in a worker with depth, length and size limits, and the OpenAPI diff bounds its work, changes and time and fails closed when a comparison is incomplete.
- Generated code snippets and command lines quote option values for the target shell, so a request name cannot add options or commands.
- Raw TCP and UDP requests are refused by the web app, the hosted proxy, the command line and agent sessions, and an import that carries them asks first; see [TCP and UDP](docs/protocols.md#tcp-and-udp).
