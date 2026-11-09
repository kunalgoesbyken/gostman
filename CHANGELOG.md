# Changelog

All notable changes to Gostman are listed here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Earlier versions are on [GitHub Releases](https://github.com/kunalgoesbyken/gostman/releases).

## [Unreleased]

### Changed

- The environments button, Network and Preferences no longer share cog and slider icons: environments use the layers icon, Network the wifi icon and Preferences the cog.

## [1.15.4] - 2026-11-09

### Changed

- JSON responses: picking the level that is already selected resets the tree to it, a change of **Expand JSON responses** in Settings starts the tree over for the latest and earlier responses of the request, the pin is off whenever the tree shows the level the request opens at (App default included), nodes opened by hand in the full tree survive a JSONPath filter, the filter is kept per tab, and responses with nothing to expand show no tree controls (#21).
- Variables view: an empty field is sent empty, a session value with the same name no longer replaces it, and an empty required field is always marked. A value that Required checks is the one that would be sent, so a reference without a value counts as empty, for every type and for hidden variables too. A typed value that an author's change replaced does not come back when the author changes it back (#23).
- Typed request variables: the type applies to the value that is used, so a session value, a `--var` or a data file row that replaces a typed variable reaches scripts as that type and has to fit it, in the apps and in `gostman run`. Dynamic variables such as `{{$randomInt}}` and `{{$timestamp}}` are filled in before the type is checked, once for the script and the request. Required behaves the same for every type, True or false accepts only `true` and `false`, and spaces around a Number, Whole number, True or false or choice are refused instead of being sent next to a trimmed value for scripts (#24).

### Fixed

- Desktop app on Linux (X11): the window reopens on the display it was on and at its position, also with a display to the left of the main one; a window closed while maximised keeps the position it was moved to, and restoring after a maximised start returns to that size and position. Thanks to @nxcc (#34).
- Site: the navbar and the web app's environment picker fit phones down to 320 px.

## [1.15.3] - 2026-11-07

### Changed

- Typing in the command palette and in the body editor responds about three times as fast in large collections. A search lists the 24 best-matching commands.

### Fixed

- XLSX data files: a cell beyond column XFD, or a workbook with more than about four million cells, is refused with a message instead of exhausting memory. Thanks to @saromanov (#33).

## [1.15.2] - 2026-11-07

### Changed

- Switching tabs, typing in the address bar, opening the command palette and searching in it respond about twice as fast in large collections, and saving after a folder toggle or a send no longer holds up the click.
- Pasting a curl command: the documentation lists the browser copies, program names and method rules it reads.
- Variables view: a request is sent with exactly what the full editor would send. A value is sent as typed, an empty field leaves a session value in place, a hidden variable shows up in the form only when it needs a value, and a bad value marks its field instead of sending.
- Typed request variables: a Number value follows the JSON number grammar (`1.50` and `2e3` are sent as typed, `007` and `1,5` are refused), integers too large to keep exactly are refused rather than rounded, and an empty optional Number, Whole number or JSON variable gives scripts `null`.
- JSON responses: the tree keeps its depth and the folders you opened or closed per response, through search, Raw and Pretty, and tab switches; the toggle reads **Collapse to level N**.
- The VS Code extension (0.3.0) finds collections at any depth and in multi-root workspaces, keeps an environment per collection, lists requests in its own Requests view and shows responses in the Gostman look.
- The documentation shows more of the app: clips of a first request, of the Explore features search and of a collection run, a tour of the Tools menu, and terminal screenshots of `gostman run`, `flow run`, `scan` and `mcp` on the command line, CI, tutorial and coding agent pages.
- The AlternativeTo badge is back in the site footer.

### Fixed

- Curl import: bundled short flags such as `-sX GET` and `-LfX` are read one letter at a time, every curl option that takes a value is known, and the URL no longer picks up the method.
- Curl import: Chrome and Firefox **Copy as cURL** for Windows (cmd), `curl.exe` and paths to curl are read, `$'...'` strings decode every escape, and `-d ''` sends a POST.
- Curl import errors are translated.
- Translations: every language has every message, including the namespaces added since the languages were seeded.

## [1.15.1] - 2026-11-04

### Changed

- Desktop updates install only when the release's checksums carry a valid signature from the Gostman release key, so a changed release cannot pass a changed download.
- Flows: a Parallel step starts its branches from runtimes prepared ahead, and the command line prints each branch's lines together instead of interleaved.

### Fixed

- Flows: starting values can use flow variables declared below them; values that refer to each other are reported.
- Flows: large numbers in JSON bodies, and in Number and JSON variables put into them, keep every digit.
- Flows: saving a flow writes a blank condition as `expression: ""` again, as earlier versions did.

## [1.15.0] - 2026-11-04

### Added

- The desktop app updates itself: **Update Gostman** in the status bar downloads the new version, checks it against the release's SHA-256 checksums and installs it on restart. Preferences, Updates has the version and Check now; **Check for new versions** and **Install updates automatically** are on by default and can be switched off there. Copies installed with Scoop, Homebrew or a Linux package keep updating through their package manager.
- Flows: a **Parallel** step sends requests and runs flows at the same time and goes on when its **Done when** condition holds (each branch is `passed`, `failed`, `cancelled` or `running`, with `.status` and `.ms`), or stops the branches still running after a time limit.
- Flows: conditions of **If**, **Switch**, **Repeat** and **Parallel** take nested groups that match all or any, four levels deep, with the whole condition written out under them and on the card.
- Flows: typed flow variables (text, number, true or false, JSON) that live for one run, inputs given by a **Run flow** step, `--var` or the environment, required inputs, and outputs a flow gives back. The **Run** tab shows them while the flow runs, and the JSON report has `flow.variables` and `flow.outputs`.
- Flows: the request picker groups requests by collection and can be moved and resized; the sections of the step panel and the flow settings fold away.

## [1.11.4] - 2026-11-03

### Changed

- The green status dots are gone: the WebSocket toolbar shows its state as text, and monitors show a check or cross for the last run.

### Fixed

- Typing no longer re-renders the header, status bar and notices.

## [1.11.3] - 2026-11-03

### Added

- The Problems panel under the spec editor can be resized by dragging its top edge or with the arrow keys; double-click resets it.
- The spec viewer, spec diff, Git, response compare, AI, examples, schema, secrets and other large dialogs can be moved and resized like Preferences, with a grab cursor on the title bar.

### Fixed

- **Get the desktop app** downloads the installer for your system directly instead of opening GitHub.
- The browser tab icon is a vector, so it stays sharp on high-DPI screens.
- Opening and closing the sidebar no longer re-renders the whole workspace, and expanding folders no longer rewrites the stored workspace on every click.

## [1.11.2] - 2026-11-03

### Fixed

- Hovering a {{variable}} in the URL bar no longer shows the browser tooltip over the variable info box.
- The header logo is drawn as a vector, so its ring stays crisp on Linux.

## [1.11.1] - 2026-11-02

### Added

- Watch a linked spec: the folder menu has **Watch this spec**. When the spec file changes on disk (desktop), or the spec at an address has changed when you return to the window (at most every 10 minutes, also on the web), a notice offers **Review**, which opens **Spec updates**. Nothing is applied until you choose it.

## [1.11.0] - 2026-11-02

### Added

- API design: write an OpenAPI spec in Gostman before the backend exists. The **Specs** tab of the sidebar lists your specs; each opens with a YAML or JSON editor beside the documentation. The editor suggests OpenAPI keywords, values and `$ref` targets, marks lint findings and syntax errors on their lines, lists them in a Problems panel, and moves between the editor and the operations and models of the documentation. Start from a template, a file or an address. A spec is the file `specs/<name>.yaml` or `.json` in a workspace folder, and is kept with your other data in the app and the browser. The toolbar generates and updates requests, starts the mock server (desktop), checks responses against the spec and compares versions, and the same file works with `gostman lint`, `mock --openapi`, `run --contract`, `fuzz` and `diff`.

### Changed

- The website footer and the About dialog have a heart icon that links to GitHub Sponsors, and the docs say sponsorship goes toward code-signing certificates.
- Static explanations in settings, environments, secrets, trash, monitors, capture, gRPC, MCP, GraphQL and body panels are now an info icon beside the section they explain instead of a full row; warnings, errors, empty states and trust banners stay as rows.

## [1.10.2] - 2026-11-02

### Fixed

- The status-bar resize grip also shows when the window uses the system title bar (Windows and Linux), so there is always a visible place to resize from.

## [1.10.1] - 2026-11-02

### Fixed

- On Windows the frameless window shows resize cursors on every edge and corner again and can be resized from them. The desktop status bar also has a resize grip in its right corner.
- Searching the sidebar highlights the matching text in request tags, and tags that match are listed first on the row.
- Opening a request again, after closing its tab or from the sidebar, shows its latest response until a new one replaces it. The responses are kept in memory only, up to 50 requests, and are dropped when you leave a workspace or delete all data.
- The default timeout in Preferences accepts input from the numeric keypad and drops anything that is not a digit.

### Changed

- Preferences: text size, the interface and code fonts, the editor font size and line wrapping are on one page, Fonts. Text size says how it combines with the window zoom.

### Added

- History can be filtered by date range, folder and tag, and grouped by day.
- The Export format picker and the import list show the logos of the tools they name, and What's new uses a newspaper icon.

## [1.10.0] - 2026-11-02

### Added

- A [VS Code extension](docs/vscode.md) that runs collections, folders and flows, sends a saved request, lints an OpenAPI spec and scans for secrets through the Gostman CLI. The landing page now shows it next to the MCP server for coding agents.
- Inline AI suggestions in the pre-request and post-response script editors: opt-in in the AI settings, sent only after a pause, with variable names but never values, and accepted with Tab; see [Inline suggestions](docs/ai.md#inline-suggestions).
- NATS requests: request and reply, publish, or wait for one message on a subject, over the plain text protocol, in the desktop app; see [NATS](docs/protocols.md#nats).
- The importers read Firecamp collection exports; see [Other tools](docs/import-export-and-specs.md#other-tools).
- `gostman fuzz <spec> --base-url <url>` sends schema-derived valid, boundary and invalid inputs for every operation of an OpenAPI or Swagger document, with `--seed`, `--max` and `--per-operation`, and reports 5xx answers, timeouts and contract violations; see [Fuzzing from an OpenAPI spec](docs/cli.md#fuzzing-from-an-openapi-spec).
- A mock rule can answer with the row of a CSV, JSON or XLSX data file that matches a path parameter, query value, header or body field, with `{{row.column}}` in the body; see [Data file rules](docs/workspaces-and-mock.md#data-file-rules).

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
