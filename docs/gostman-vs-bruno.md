# Gostman and Bruno compared

Bruno and Gostman share an idea: a collection is a folder of plain files that you commit with your code, and neither needs an account to use. They differ in format, in which features sit behind a paid plan, in protocols and in the command line. This page lists the differences, including those that favour Bruno, so you can decide which fits. To move a collection, see [Coming from Bruno](coming-from-bruno.md).

Checked on 26 October 2026. Plans and limits change often, so read the current [Bruno pricing](https://www.usebruno.com/pricing) before you decide.

## Who each tool suits

- **Gostman** suits people and teams who want the file-based workflow with every feature free, a web app, a single-binary CLI, a load test and secret scanner, and an MCP server for coding agents.
- **Bruno** suits people who want an established open source, offline-only client with a VS Code extension, a large documentation set and optional paid support and licence management.

## At a glance

| Topic | Gostman | Bruno |
| --- | --- | --- |
| Storage and Git | YAML files, one per request, in a folder you open (desktop), or the browser (web). The desktop app has a [Git panel](collections-and-git.md#git-panel) with commit, push, branches, stash and conflict resolution. | Plain text files in a folder: `.bru` or OpenCollection YAML. Git is the collaboration model. The Git UI lists clone, diff and pull for every plan and commit, push, branches, stash and conflict resolution for Pro and Ultimate. |
| Offline and accounts | No accounts. Also a [web app](getting-started.md#choose-how-to-run-it) with no sign-in. | Offline only. The README says there are no plans to add cloud sync. |
| Protocols | REST, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, Server-Sent Events, SOAP and MCP. See [Protocols](protocols.md). | HTTP and REST, GraphQL, gRPC, WebSocket, SOAP and Server-Sent Events. |
| Scripting and checks | JavaScript in an isolated worker, assertion rows, extraction rules and [flows](flows.md). `bru.*` scripts are rewritten on import. See [Scripts and checks](scripting-and-settings.md). | JavaScript with `bru`, `req` and `res`, tests, assertions and variables. A safe-mode sandbox is the default; developer mode allows files, commands and npm packages. |
| CLI and CI | One `gostman` binary, a GitHub Action and a Docker image. `gostman run` also reads a Bruno folder directly. See [Gostman in CI](ci.md). | `bru` from `@usebruno/cli` (npm, needs Node.js), a Docker image and a GitHub Action. Reports in JSON, JUnit and HTML. |
| Collaboration and sync | Through Git, or an [encrypted link or file](sharing-and-docs.md). | Through Git. Workspaces: 2 on Open Source, unlimited on Pro and Ultimate. |
| Secrets | Secret variables in the system keychain, and HashiCorp Vault, AWS, Azure, Google Cloud, KeePassXC, 1Password and Bitwarden, all free. See [Secrets and network](secrets-and-network.md). | Secret variables and `.env` files. Integration with HashiCorp Vault, AWS, Azure and Google Cloud secret managers, listed under Ultimate. |
| Mock, load and scan | A local mock server, load test and secret scanner, in the app and the CLI. See [Running, load testing and scanning](runner-load-and-scan.md) and [Folders, mock server and capture](workspaces-and-mock.md). | Local mock servers from response examples or an OpenAPI spec, marked Beta. The documentation index lists no load test or secret scanner. |
| AI and agents | Off by default, your own key. `gostman mcp` serves a workspace to coding agents with secret redaction and a host allowlist. See [AI features](ai.md) and [Use from a coding agent](agents.md). | Bruno AI, in Beta from v4.0.0, with your own key: script, test and documentation generation. Setup guides for Cursor, Copilot, Codex, Claude and Devin. |
| Platforms | Windows, macOS, Linux, a web app and a CLI. | Windows, macOS and Linux, a CLI and a VS Code extension. |
| Licence and price | MIT licence. No paid tier. | MIT licence for the open source repository. Open Source is $0, Pro $6 and Ultimate $11 per user a month, billed annually. |

## Where Gostman is different

- **Every feature in the download.** Bruno's pricing table lists data-driven runs and the Git commit and push actions under Pro, and secret managers and report generation under Ultimate. Gostman has no plans. See [What is free in Gostman](free-features.md).
- **One binary for CI.** `gostman run` installs without Node.js and also runs `gostman flow`, `gostman load` and `gostman scan`. Bruno's CLI is an npm package; its Docker image removes the need for Node.js on the runner.
- **A web app.** Open [gostman.com/web](https://gostman.com/web) and send a request with nothing to install. See [Limits of the web version](getting-started.md#limits-of-the-web-version).
- **More protocols.** Socket.IO, MQTT and MCP servers are in Gostman's request types; the Bruno documentation index lists none of them. See [MCP servers](protocols.md#mcp-servers).
- **Flows, load tests and secret scanning.** Gostman draws [flows](flows.md) with retries and branches, runs load tests and scans a workspace for credentials.
- **An agent server built for secrets.** `gostman mcp` replaces secret values with their names in what the agent sees and limits the hosts the agent can call.
- **Runs a Bruno folder as it is.** `gostman run ./bruno-collection` converts the folder in memory and changes nothing in it. See [Try it on the Bruno folder first](coming-from-bruno.md#try-it-on-the-bruno-folder-first).

## Where Bruno is stronger

- **A VS Code extension.** It opens and edits `.bru` files and sends requests from the editor. Gostman has no editor extension.
- **Scripts with more reach.** In developer mode, Bruno scripts can read files, run commands and use npm packages. Gostman scripts always run in an isolated worker with a fixed set of bundled modules.
- **Support and administration.** The pricing page lists a 48-hour support response on Pro and 24 hours on Ultimate, with SSO, SCIM, audit logs and licence management for organizations. Gostman's support is its [GitHub issues](https://github.com/kunalgoesbyken/gostman/issues).
- **Documentation and reach.** Bruno's documentation covers a wide range of topics, including HTML documentation with a playground, OpenAPI sync and importers for Postman, Insomnia, OpenAPI and WSDL. Gostman is a smaller project with fewer users, and its desktop builds are not code-signed yet.
- **Bruno AI inside the editor.** Inline autocomplete in script editors and generation of scripts, tests and documentation.

## Moving between them

- Run a Bruno folder with `gostman run` first, or import it in the app or with `gostman import`. [Coming from Bruno](coming-from-bruno.md) lists what maps to what, how `bru.*` scripts are rewritten, and the `gostman run` flags that match `bru run`. The formats are in [Import, export and OpenAPI specs](import-export-and-specs.md#importing).
- To go back, run `gostman export --format bruno`. See [Working with the collection afterwards](coming-from-bruno.md#working-with-the-collection-afterwards).

## Sources

- [Bruno pricing](https://www.usebruno.com/pricing): plan prices, Git UI actions, data-driven runs, secret managers, workspaces and support.
- [Bruno README](https://github.com/usebruno/bruno): MIT licence, offline-only statement, platforms, CLI and Docker.
- [Bruno documentation index](https://docs.usebruno.com/llms.txt): protocols, mock servers, secret managers, GitHub Actions, VS Code extension, importers and AI.
- [Mock servers](https://docs.usebruno.com/mock-servers/overview.md): local, Beta.
- [Bruno AI](https://docs.usebruno.com/ai/bruno-ai/introduction.md): Beta, your own key.
- [Bruno CLI installation](https://docs.usebruno.com/bru-cli/overview): npm install and reports.
- [JavaScript sandbox](https://docs.usebruno.com/get-started/configure/javascript-sandbox.md): safe mode and developer mode.
- [VS Code extension](https://docs.usebruno.com/vs-code-extension/overview).
