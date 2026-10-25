# Gostman and Postman compared

Postman and Gostman are both API clients with a runner, scripts, mock servers and a command line. They differ in where your work lives: Postman keeps collections in cloud workspaces tied to an account, with Git as an option; Gostman keeps them on your computer as plain files, with Git as the way to share. This page lists the differences, including the ones that favour Postman, so you can decide which fits. To move a collection, see [Coming from Postman](coming-from-postman.md).

Checked on 26 October 2026. Plans and limits change often, so read the current [Postman pricing](https://www.postman.com/pricing/) before you decide.

## Who each tool suits

- **Gostman** suits people and teams who want collections as files in the repository, no account, a free runner, load test and secret scanner in one binary, and a way to let a coding agent call their API without seeing secrets.
- **Postman** suits teams who want shared cloud workspaces with roles and audit logs, hosted mock servers and monitors, an API network and catalog, and one vendor for design, testing and documentation.

## At a glance

| Topic | Gostman | Postman |
| --- | --- | --- |
| Storage and Git | Collections are YAML files in a folder you open (desktop), or live in the browser (web). The desktop app has a [Git panel](collections-and-git.md#git-panel) with commit, push, branches, stash and conflict resolution. | Collections live in workspaces in the Postman cloud. Native Git connects a workspace to a project folder of files; the pricing page lists it on every plan. |
| Offline and accounts | No accounts. The [web app](getting-started.md#choose-how-to-run-it) and the desktop app work without signing in. | The lightweight API Client in the desktop app works without an account. Saving to collections and using environments and variables need a workspace, so an account. |
| Protocols | REST, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, Server-Sent Events, SOAP and MCP. See [Protocols](protocols.md). | HTTP, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, MCP and AI model requests, per Postman's protocols page. |
| Scripting and checks | JavaScript scripts in an isolated worker, assertion rows, extraction rules, and [flows](flows.md). `pm.*` scripts are rewritten on import. See [Scripts and checks](scripting-and-settings.md). | `pm.*` scripts and tests, and Flows. |
| CLI and CI | One `gostman` binary, a GitHub Action and a Docker image. Exit codes and text, JSON, JUnit and HTML reports. See [Gostman in CI](ci.md). | Postman CLI, installed with the app or by npm, curl or PowerShell. Runs collections from a local Git repository without an API key in Local View; sending results to Postman's cloud needs sign-in. |
| Collaboration and sync | Through Git, or an [encrypted link or file](sharing-and-docs.md). No live sync. | Shared workspaces. Team and Enterprise plans include unlimited users; role-based access control is basic on Team and advanced on Enterprise; audit logs are on Enterprise. |
| Secrets | Secret variables in the system keychain, and HashiCorp Vault, AWS, Azure, Google Cloud, KeePassXC, 1Password and Bitwarden, all free. See [Secrets and network](secrets-and-network.md). | Local Vault on every plan, Shared Vault from Solo, vault integrations on Enterprise (Advanced Security add-on). |
| Mock, load and scan | A local mock server, load test and secret scanner, in the app and the CLI. See [Running, load testing and scanning](runner-load-and-scan.md) and [Folders, mock server and capture](workspaces-and-mock.md). | Cloud-hosted mock servers for HTTP requests. Local performance testing on every plan; cloud performance testing is billed per virtual-user hour. Hosted monitors with monthly request quotas. |
| AI and agents | Off by default, your own key. `gostman mcp` serves a workspace to coding agents with secret redaction and a host allowlist. See [AI features](ai.md) and [Use from a coding agent](agents.md). | Agent Mode and AI credits per plan (50 a month on Free). A Postman MCP server for AI agents. |
| Platforms | Windows, macOS, Linux, a web app and a CLI. | Windows, macOS, Linux, a web app, a VS Code extension (needs a Postman account) and a CLI. |
| Licence and price | MIT licence. No paid tier. | Free and Solo include one user. Solo is $9 a month and Team is $19 per user a month, both billed annually. Enterprise is by quote. |

## Where Gostman is different

- **Files, not a cloud.** A Gostman collection is a folder of YAML files, one per request. Review a change in a pull request, branch it with the code, and open it without an account. See [Folders and Git](workspaces-and-mock.md#folders-and-git-desktop).
- **Everything in the download.** Data-file runs, parallel runs, reports, secret managers, the Git panel, the mock server, `gostman load` and `gostman scan` have no plan. See [What is free in Gostman](free-features.md).
- **One binary for CI.** `gostman run` needs nothing else installed. It also runs `gostman flow`, `gostman load` and `gostman scan`.
- **An agent server built for secrets.** `gostman mcp` lets Claude Code, Codex or Cursor send your requests. Values are filled in inside Gostman and replaced by their names in what the agent sees, and the agent reaches only hosts your own requests use.
- **No telemetry.** Gostman sends nothing about your use to the project. See [What Gostman connects to](getting-started.md#what-gostman-connects-to).

## Where Postman is stronger

- **Team features.** Shared cloud workspaces with roles, SSO and SCIM, and audit logs. Gostman has no accounts, so it has none of these.
- **Hosted services.** Mock servers that run in Postman's cloud, and monitors that run on a schedule from there. Gostman runs both on your machine or your CI, so a public mock or an uptime check needs a server you run.
- **A wider platform.** Spec Hub, an API network, an API catalog and SDK generation sit on the same account. Gostman has an OpenAPI viewer, linter and contract checks, but no hosted catalog or SDK generator.
- **A VS Code extension.** Gostman has no editor extension.
- **Cloud load testing.** Postman can run performance tests from its cloud for a per-hour fee. Gostman's load test runs from the machine that starts it.
- **Integrations and maturity.** The pricing page lists up to 5 integrations on Free, 50 on Team and 100 on Enterprise. Gostman is a smaller project with no integration marketplace, and its desktop builds are not code-signed yet.

## Moving between them

- Import a Postman collection, environments and globals in the app or with `gostman import`. [Coming from Postman](coming-from-postman.md) lists what maps to what, what is rewritten in scripts, and the `gostman run` flags that match `newman run`. The formats are in [Import, export and OpenAPI specs](import-export-and-specs.md#importing).
- To go back, export Collection v2.1 from the **Export** tab or with `gostman export --format postman`. See [Back to Postman](coming-from-postman.md#back-to-postman).

## Sources

- [Postman pricing](https://www.postman.com/pricing/): plan prices, users included, vaults, AI credits, performance testing, monitors, Git, RBAC and audit logs.
- [Lightweight API Client](https://learning.postman.com/docs/getting-started/basics/using-api-client/): what works without an account.
- [Other API protocols in Postman](https://learning.postman.com/docs/use/send-requests/protocols/protocols): protocols, including MQTT and MCP.
- [Postman CLI overview](https://learning.postman.com/docs/postman-cli/postman-cli-overview/) and [run a collection](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection): install methods and Local View runs.
- [Native Git](https://learning.postman.com/docs/use/native-git/overview): collections as files in a project folder.
- [Mock servers](https://learning.postman.com/docs/design-apis/mock-apis/set-up-mock-servers/): hosted, HTTP only.
- [Agent Mode](https://learning.postman.com/docs/getting-started/basics/about-agent-mode/) and the [VS Code extension](https://learning.postman.com/docs/reference/vs-code-extension/install): AI assistant and editor extension.
