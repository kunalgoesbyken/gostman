# Gostman and Insomnia compared

Insomnia and Gostman are both API clients for REST, GraphQL, gRPC and WebSocket that can keep collections in Git. Insomnia is open source, made by Kong, and offers local, Git and cloud storage with an optional account. Gostman has no accounts and keeps collections as files you choose where to store. This page lists the differences, including those that favour Insomnia, so you can decide which fits. To move a collection, see [Coming from Insomnia](coming-from-insomnia.md).

Checked on 26 October 2026. Plans and limits change often, so read the current [Insomnia pricing](https://insomnia.rest/pricing) before you decide.

## Who each tool suits

- **Gostman** suits people and teams who want collections as files in the repository, a free runner, load test, scanner and secret managers, a web app that needs no sign-in, and an MCP server for coding agents.
- **Insomnia** suits people who design APIs against an OpenAPI spec in the same tool, teams who want cloud sync with organizations and roles, and teams that already use Kong.

## At a glance

| Topic | Gostman | Insomnia |
| --- | --- | --- |
| Storage and Git | YAML files in a folder (desktop), or the browser (web). The desktop app has a [Git panel](collections-and-git.md#git-panel) with commit, push, branches, stash and conflict resolution. | Local Vault, Git Sync and Cloud Sync storage. Git Sync is built into the app, with a three-way merge for conflicts. |
| Offline and accounts | No accounts. The [web app](getting-started.md#choose-how-to-run-it) and the desktop app work without signing in. | The Scratch Pad opens from the login screen without signing in. Cloud Sync needs a sign-in. Mock servers need an account. |
| Protocols | REST, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, Server-Sent Events, SOAP and MCP. See [Protocols](protocols.md). | HTTP, Event Stream (SSE), GraphQL, gRPC and WebSocket on the requests page; Socket.IO and MCP clients have their own entries in the release notes and docs; SOAP is an HTTP request with an XML body. |
| Scripting and checks | JavaScript scripts in an isolated worker, assertion rows, extraction rules and [flows](flows.md). `insomnia.*` scripts are rewritten on import. See [Scripts and checks](scripting-and-settings.md). | Pre-request and after-response scripts, unit tests, template tags and plugins. |
| CLI and CI | One `gostman` binary, a GitHub Action and a Docker image. Exit codes and text, JSON, JUnit and HTML reports. See [Gostman in CI](ci.md). | Inso CLI: `run collection`, `run test`, `lint spec`, `export spec`. Installed with Homebrew, a binary download or a Docker image. |
| Collaboration and sync | Through Git, or an [encrypted link or file](sharing-and-docs.md). No live sync. | Cloud Sync with organizations and role-based access control. SSO and SCIM are on Enterprise. Git Sync is limited to 3 users on Essentials. |
| Secrets | Secret variables in the system keychain, and HashiCorp Vault, AWS, Azure, Google Cloud, KeePassXC, 1Password and Bitwarden, all free. See [Secrets and network](secrets-and-network.md). | External vault integrations (AWS, GCP, Azure, HashiCorp) on Enterprise. A 1Password plugin is documented. |
| Mock, load and scan | A local mock server, load test and secret scanner, in the app and the CLI. See [Running, load testing and scanning](runner-load-and-scan.md) and [Folders, mock server and capture](workspaces-and-mock.md). | Cloud-hosted and self-hosted mock servers, with monthly request limits per plan. A collection runner. The documentation index lists no load test or secret scanner. |
| AI and agents | Off by default, your own key. `gostman mcp` serves a workspace to coding agents with secret redaction and a host allowlist. See [AI features](ai.md) and [Use from a coding agent](agents.md). | AI features in Insomnia 12, with your own key or a local model, free for now. Koh CLI, a Tech Preview command line for agents, works with Git projects. |
| Platforms | Windows, macOS, Linux, a web app and a CLI. | A desktop application and the Inso CLI. |
| Licence and price | MIT licence. No paid tier. | Apache 2.0, open source. Essentials is $0, Pro $12 and Enterprise $45 per user a month. |

## Where Gostman is different

- **No account at any level.** Insomnia keeps data on the device in the Scratch Pad and Local Vault, and an account adds Cloud Sync and mocks. Gostman has no account to add. See [Where your data is kept](getting-started.md#where-your-data-is-kept).
- **Git for any team size, and vaults in the download.** Insomnia's Essentials plan limits Git Sync to 3 users and puts vault integrations on Enterprise. Gostman has neither limit. See [What is free in Gostman](free-features.md).
- **A web app.** Open [gostman.com/web](https://gostman.com/web) and send a request. See [Limits of the web version](getting-started.md#limits-of-the-web-version).
- **A local mock server and a load test.** Insomnia's mock servers are hosted or self-hosted and need an account; Gostman's run on your machine and in CI.
- **MQTT.** Gostman has an MQTT client; Insomnia's documentation does not list one. See [MQTT](protocols.md#mqtt).
- **An agent server built for secrets.** `gostman mcp` replaces secret values with their names in what the agent sees and limits the hosts the agent can call.

## Where Insomnia is stronger

- **API design.** Insomnia has a spec editor with linting and generates requests from an OpenAPI spec. Gostman views, lints and syncs specs, and you edit them in your editor. See [OpenAPI specs](import-export-and-specs.md#openapi-specs).
- **Cloud sync and organizations.** Projects sync across devices and users, with role-based access control. Gostman shares through Git or links only.
- **Plugins and template tags.** Insomnia has a plugin system and tags that can reference other responses. Gostman has no plugin system.
- **Enterprise administration.** SSO, SCIM and instance-level AI administration. Gostman has no accounts, so none of these exist.
- **Kong integration.** Insomnia can link a Konnect Gateway Service and send requests to its routes.
- **Open source for years.** Insomnia is Apache 2.0, with signed binaries and published build provenance. Gostman is MIT and smaller, and its desktop builds are not code-signed yet.
- **Generated mocks.** Insomnia can create a mock from a natural-language prompt and an OpenAPI or JSON input.

## Moving between them

- Import an Insomnia v4 or v5 export in the app or with `gostman import`. [Coming from Insomnia](coming-from-insomnia.md) lists what maps to what, how template tags and `insomnia.*` scripts are translated, and the `gostman run` flags that match Inso's. The formats are in [Import, export and OpenAPI specs](import-export-and-specs.md#importing).
- Gostman does not write Insomnia's format, but Insomnia imports Postman collections. See [Back to Insomnia](coming-from-insomnia.md#back-to-insomnia).

## Sources

- [Insomnia pricing](https://insomnia.rest/pricing): plan prices, Git Sync users, mock requests, vault integrations, SSO.
- [Storage options](https://developer.konghq.com/insomnia/storage.md): Local Vault, Scratch Pad, Git Sync and Cloud Sync.
- [Requests in Insomnia](https://developer.konghq.com/insomnia/requests.md): protocols and SOAP.
- [Insomnia releases on GitHub](https://github.com/Kong/insomnia/releases): Socket.IO from the 11.x releases, MCP clients in the 12.x releases, and the Apache 2.0 licence.
- [MCP clients in Insomnia](https://developer.konghq.com/insomnia/mcp-clients-in-insomnia.md), [AI in Insomnia](https://developer.konghq.com/insomnia/ai-in-insomnia.md) and [Koh CLI](https://developer.konghq.com/koh.md).
- [Mocks](https://developer.konghq.com/insomnia/mock-servers.md): hosted and self-hosted, account needed.
- [Inso CLI](https://developer.konghq.com/inso-cli.md): commands and install methods.
- [External vault integration](https://developer.konghq.com/insomnia/external-vault.md) and [Konnect integration](https://developer.konghq.com/insomnia/konnect-integration.md).
