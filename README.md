<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="screenshots/logo-dark.png">
    <img src="screenshots/logo-light.png" alt="Gostman" width="96" height="96">
  </picture>
  <h1>Gostman</h1>
  <p>An open source API client for REST, GraphQL, gRPC and WebSocket. Desktop app, web app and command line, with no account and no paid tier.</p>

  [![CI](https://github.com/kunalgoesbyken/gostman/actions/workflows/ci.yml/badge.svg)](https://github.com/kunalgoesbyken/gostman/actions/workflows/ci.yml)
  [![Release](https://img.shields.io/github/v/release/kunalgoesbyken/gostman)](https://github.com/kunalgoesbyken/gostman/releases/latest)

  <p>
    <a href="https://gostman.com/web"><strong>Open the web app</strong></a> ·
    <a href="https://github.com/kunalgoesbyken/gostman/releases/latest">Download for Windows, macOS and Linux</a> ·
    <a href="https://gostman.com/docs">Documentation</a> ·
    <a href="docs/tutorial-first-collection.md">Tutorial: test an API</a>
  </p>
  <p>No account. Your requests stay on your device. The web app installs as an app and works offline.</p>
</div>

![Gostman sending a request and generating code](screenshots/demo.gif)

| | |
| --- | --- |
| ![Multipart body with auth](screenshots/request-body.png) | ![GraphQL query with the schema browser](screenshots/graphql.png) |
| ![Assertions and check results](gostman-gui/frontend/src/assets/landing/tests.webp) | ![Collection runner](gostman-gui/frontend/src/assets/landing/runner.webp) |

Save a request once and use it three ways: send it from the app, check it on every pull request with `gostman run`, and let a coding agent call it through `gostman mcp` without seeing your secrets. Requests, collections and environments are plain files on your machine, and there is nothing to sign in to. New here? The [tutorial](docs/tutorial-first-collection.md) builds a tested collection step by step, and the [documentation](https://gostman.com/docs) covers every feature.

Gostman is a native desktop application built with Go and [Wails](https://wails.io), with the same interface in the browser at [gostman.com](https://gostman.com).

## Why not Bruno or Postman?

Both are good tools. Gostman is for people who want the paid-tier workflow without a paid tier or an account.

- **Nothing to sign in to.** Collections are plain YAML files in a folder you can commit. The desktop app and the browser version both work without an account.
- **No telemetry.** No analytics or crash reporting in the apps or the command line; they contact only the hosts you send to and the services you set up. Only the home page at gostman.com counts visits, without cookies. [What Gostman connects to](docs/getting-started.md#what-gostman-connects-to) lists every network call.
- **No tiers.** Data-driven runs, parallel runs, HTML reports, secret managers (Vault, AWS, Azure, Google Cloud, 1Password, Bitwarden, Bitwarden Secrets Manager, KeePassXC), the Git panel and any number of collections are all in the download. Bruno documents several of these under its [Pro and Ultimate plans](https://www.usebruno.com/pricing), and Postman lists custom data files in the Collection Runner on its [paid plans](https://www.postman.com/pricing/).
- **Sharing without Git.** Send a folder to a teammate as an encrypted link or file that is built on your machine and never uploaded.
- **More in the same download.** Load testing, Socket.IO, MQTT, GraphQL subscriptions, MCP servers, HAR import, traffic capture, a secret scanner and a mock server, plus a command line that is one binary with no Node.js to install.

Prices and plans change, so check their pages before you decide. Gostman has no accounts, so it has no hosted collaboration, SSO or cloud monitors, and it has no VS Code extension. [What is free in Gostman](docs/free-features.md) compares the paid features of Postman, Bruno and Insomnia with Gostman. Moving from Postman, Bruno or Insomnia? [Coming from Postman](docs/coming-from-postman.md), [Coming from Bruno](docs/coming-from-bruno.md) and [Coming from Insomnia](docs/coming-from-insomnia.md) cover importing a collection, its scripts and the matching `gostman run` flags.

### Will Gostman add a paid tier?

Gostman has no paid tier, no account and no licence key, and every feature is in the free download. It is released under the [MIT licence](LICENSE), so the published code stays free to use, change and fork whatever happens to the project.

## Quick start

- **Browser:** open [gostman.com/web](https://gostman.com/web), paste a URL and press Send. Requests go through a hosted proxy; run [`gostman relay`](#web-version) to use your own.
- **Desktop:** download the installer from [Install](#install) and open it.
- **Command line:** send a request, or run a collection you saved to a folder in the app.

```bash
go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest
gostman send GET https://example.com -H 'Accept: text/html'
gostman run path/to/collection
```

### Try a working collection

The [`examples`](examples) folder holds collections that call public test APIs, so they run as soon as you clone the repository:

```bash
git clone https://github.com/kunalgoesbyken/gostman && cd gostman
gostman run examples/todo-api --env Public
```

```
PASS  GET      Todos/List todos  200 OK  99 ms  3/3 checks
PASS  GET      Todos/Get one todo  200 OK  13 ms  3/3 checks
PASS  POST     Todos/Create a todo  201 Created  286 ms  3/3 checks

Requests  3 passed
Checks    9 passed
Duration  412ms
```

Open the same folder in the desktop app with **Open folder** to see the requests, the checks and the variable passed from one request to the next.

## Learn

- [Tutorial: test an API](docs/tutorial-first-collection.md) builds that collection step by step: variables, folders, assertions, chaining, scripts and a data-driven run.
- [Tutorial: run your API tests in CI](docs/tutorial-ci.md) runs it on every pull request with secrets kept out of the files.
- [Guides by task](docs/guides.md): migrate from Postman, mock a backend before it exists, record real traffic, load test, publish docs, let a coding agent call your API.
- [Script reference and examples](docs/scripting-and-settings.md#checks-and-scripts): JSON Schema checks, request signing, fetching a token, polling.
- [Troubleshooting](docs/troubleshooting.md)

## Features

- **Protocols:** REST, GraphQL (schema browser), gRPC (reflection or `.proto`), WebSocket, Socket.IO, MQTT over WebSocket, GraphQL subscriptions, Server-Sent Events, SOAP and MCP servers, over HTTP or, on the desktop, as a local command (stdio).
- **Auth:** Basic, Bearer, API key, OAuth 2.0 (with PKCE and automatic renewal), OAuth 1, Digest, AWS SigV4, NTLM, Akamai EdgeGrid, JWT Bearer, Atlassian ASAP and Hawk.
- **Workflow:** collections with nested folders, environments and variables, extraction rules to chain requests, a cookie jar, history, earlier responses with a side-by-side compare, and a command palette.
- **Checks:** assertions plus pre-request and post-response scripts with `test()` and `expect()` in a sandbox, and a collection runner with CSV or JSON data files, parallel runs and HTML, JUnit and JSON reports.
- **Local load testing** with `gostman load`: latency percentiles and pass or fail thresholds.
- **Secret scanner:** `gostman scan` and an in-app check find credentials typed into a collection before you commit or share it.
- **Collections as files:** plain YAML in a folder with a Git panel (diff, commit, push, branches, stash, conflicts) on the desktop.
- **Mock server and capture:** serve saved examples or an OpenAPI spec locally, and record traffic from your own app.
- **OpenAPI:** import, sync with a remote spec, and a spec viewer with a linter (`gostman lint`).
- **Docs:** generate one HTML page with Markdown descriptions and an optional Try it panel.
- **Secret managers:** HashiCorp Vault, AWS, Azure and Google Cloud; the password managers KeePassXC, 1Password and Bitwarden, and Bitwarden Secrets Manager; and your OS keychain for stored values. Fields that read from a connection are tinted with its colour.
- **Themes:** light and dark, eight palettes, accent colours, and your own background and text colour for each part of the window, with a contrast check.
- **Sharing:** encrypted share links that never upload anything, and Open in Gostman links.
- **For coding agents:** `gostman mcp` lets Claude Code, Codex and Cursor call your API through the collection without seeing your secrets.
- **AI assistant** (optional, bring your own key): generate requests, checks and scripts, and explain errors.
- **Import and export:** Postman, OpenAPI, Insomnia, HAR, WSDL, Bruno, .http files (VS Code REST Client, JetBrains HTTP Client) and curl in; Postman, OpenAPI, HAR, Bruno, .http files, a curl script, Markdown, an HTML docs page and a Gostman backup out.
- **Code generation** for cURL, JavaScript, Python, Go, Java, Kotlin, C#, PHP, Ruby, Swift, Rust, Dart and PowerShell.

## Install

Download the latest build from the [releases page](https://github.com/kunalgoesbyken/gostman/releases/latest).

| Platform | File | Notes |
| --- | --- | --- |
| Windows | [`Gostman-windows-amd64.exe`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-windows-amd64.exe) | Installer. Adds Start menu and desktop shortcuts and an uninstaller. |
| Windows | [`Gostman-windows-amd64-portable.exe`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-windows-amd64-portable.exe) | Single executable, no installation. |
| macOS | [`Gostman-darwin-universal.dmg`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-darwin-universal.dmg) | Intel and Apple Silicon. Drag Gostman to Applications. |
| Linux | [`Gostman-linux-amd64.deb`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-linux-amd64.deb) | Debian and Ubuntu. `sudo apt install ./Gostman-linux-amd64.deb` |
| Linux | [`Gostman-linux-x86_64.AppImage`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-linux-x86_64.AppImage) | Any distribution. `chmod +x Gostman-linux-x86_64.AppImage` and run it. AppImage managers keep it up to date. |
| Linux | [`Gostman-linux-amd64.tar.gz`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-linux-amd64.tar.gz) | Other distributions. `sudo tar -xzf Gostman-linux-amd64.tar.gz -C /` Requires GTK 3 and WebKitGTK 4.1. |
| Arch Linux | [`gostman-bin`](https://aur.archlinux.org/packages/gostman-bin) | Community package in the AUR, maintained by [@softexpert](https://github.com/softexpert). `yay -S gostman-bin` |

The builds are not code-signed yet, so the operating system asks for confirmation the first time:

- **Windows**: SmartScreen shows "Windows protected your PC". Choose **More info**, then **Run anyway**.
- **macOS**: right-click Gostman in Applications and choose **Open**, then confirm.

Windows needs the WebView2 runtime, which ships with Windows 10 and 11; the installer fetches it when it is missing.

## Secrets and Git

A folder workspace is meant to be committed. What goes where:

- **Safe to commit:** `gostman.yaml`, `folder.yaml`, the request files, `environments/` and `flows/`. They hold names, URLs, bodies and the values of variables you did not mark secret, so read a diff before you push.
- **Marked secret:** the value lives in the OS keychain on desktop (IndexedDB in the browser). Only the variable name is written to the YAML, so a token never lands in the folder. Mark every token: a variable you do not mark is plain text in the environment file, and the app warns when an unmarked value looks like a credential.
- **Never written to the folder:** OAuth tokens, cookies, request history and secret values.
- **Keep out of Git:** a `.env` file next to `gostman.yaml` is read as `{{process.env.NAME}}` and never written back. A new workspace gets a `.gitignore` for `.env`, `.env.*` and the `.gostman-*.tmp` leftovers of an interrupted save; `gostman init` adds it to an older workspace, and an existing `.gitignore` is never changed.
- **Check before you share:** `gostman scan <folder>` and the **Scan for secrets** command flag credentials typed into requests and variables.

See [Variables](docs/variables.md#secret-variables) for the details.

## Web version

[gostman.com](https://gostman.com) runs the same interface in the browser. Browsers cannot call arbitrary APIs directly, so requests are relayed through a small proxy, and that includes any API token in the request. The proxy's code is open source in [`api/proxy.go`](api/proxy.go) and does not store requests or responses; this repository cannot speak for the logs of the host it runs on. To keep tokens off a server you do not run, start `gostman relay` on your computer and choose it under **Preferences**, **Privacy**, or use the desktop app. It differs from the desktop app in these ways:

- The hosted proxy cannot reach `localhost` or private network addresses. Use the desktop app for local APIs, or run `gostman relay` and choose it under **Preferences**, **Privacy**.
- The web app has no proxy, CA certificate or client certificate settings. Use the desktop app, or start `gostman relay` with `--proxy`, `--cacert` or `--client-cert`.
- A gRPC stream is collected and shown when it ends; messages for a client stream are written up front as a JSON array.
- Responses larger than 3 MB are truncated. The desktop app reads up to 50 MB.

Data in the web version is kept in the browser's IndexedDB.

## Documentation

The same pages are published at [gostman.com/docs](https://gostman.com/docs). The tutorials and guides are listed under [Learn](#learn); the reference pages are:

- Start: [Getting started](docs/getting-started.md), [What is free in Gostman](docs/free-features.md), and coming from [Postman](docs/coming-from-postman.md), [Bruno](docs/coming-from-bruno.md) or [Insomnia](docs/coming-from-insomnia.md)
- Requests: [Requests and responses](docs/requests-and-responses.md), [Protocols](docs/protocols.md)
- Variables and secrets: [Variables](docs/variables.md), [Secrets and network settings](docs/secrets-and-network.md)
- Testing and automation: [Scripts and checks](docs/scripting-and-settings.md), [Running, load testing and scanning](docs/runner-load-and-scan.md), [Gostman in CI](docs/ci.md)
- Collections and Git: [Collections, tabs and Git](docs/collections-and-git.md), [Folder and collection settings](docs/folder-settings.md), [Folders, mock server and capture](docs/workspaces-and-mock.md), [Import, export and OpenAPI specs](docs/import-export-and-specs.md), [Sharing and documentation](docs/sharing-and-docs.md)
- Agents and AI: [Use from a coding agent](docs/agents.md), [AI features](docs/ai.md)
- Reference: [Command line](docs/cli.md), [Preferences, shortcuts and the command palette](docs/preferences-and-shortcuts.md)

## Translations

[![Translation status](https://hosted.weblate.org/widget/gostman/svg-badge.svg)](https://hosted.weblate.org/engage/gostman/)

Gostman is translated on [Weblate](https://hosted.weblate.org/engage/gostman/). The first drafts of each language are checked by native speakers over time. To ask for a language, offer to translate or report a wrong translation, use [issue #15](https://github.com/kunalgoesbyken/gostman/issues/15). [Translating Gostman](docs/translating.md) explains how the translation files work and how to send changes.

## Contributing

Issues and pull requests are welcome. For anything larger than a small fix, please open an issue first to agree on the approach. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build, test and release.
