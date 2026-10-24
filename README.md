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
| ![Assertions and test results](gostman-gui/frontend/src/assets/landing/tests.webp) | ![Collection runner](gostman-gui/frontend/src/assets/landing/runner.webp) |

Save a request once and use it three ways: send it from the app, check it on every pull request with `gostman run`, and let a coding agent call it through `gostman mcp` without seeing your secrets. Requests, collections and environments are plain files on your machine, and there is nothing to sign in to. New here? The [tutorial](docs/tutorial-first-collection.md) builds a tested collection step by step, and the [documentation](https://gostman.com/docs) covers every feature.

Gostman is a native desktop application built with Go and [Wails](https://wails.io), with the same interface in the browser at [gostman.com](https://gostman.com).

## Why not Bruno or Postman?

Both are good tools. Gostman is for people who want the paid-tier workflow without a paid tier or an account.

- **Nothing to sign in to.** Collections are plain YAML files in a folder you can commit. The desktop app and the browser version both work without an account.
- **No tiers.** Data-driven runs, parallel runs, HTML reports, secret managers (Vault, AWS, Azure, Google Cloud, 1Password, Bitwarden, KeePassXC), the Git panel and any number of collections are all in the download. Bruno documents several of these under its [Pro and Ultimate plans](https://www.usebruno.com/pricing), and Postman lists custom data files in the Collection Runner on its [paid plans](https://www.postman.com/pricing/).
- **Sharing without Git.** Send a folder to a teammate as an encrypted link or file that is built on your machine and never uploaded.
- **More in the same download.** Load testing, Socket.IO, MQTT, GraphQL subscriptions, MCP servers, HAR import, traffic capture, a secret scanner and a mock server, plus a command line that is one binary with no Node.js to install.

Prices and plans change, so check their pages before you decide. Gostman has no accounts, so it has no hosted collaboration, SSO or cloud monitors, and it has no VS Code extension. A side-by-side table is on [gostman.com](https://gostman.com). Moving from Bruno? [Coming from Bruno](docs/coming-from-bruno.md) covers importing a collection, its scripts and the `bru run` flags.

### Will Gostman add a paid tier?

Gostman has no paid tier, no account and no licence key, and every feature is in the free download. It is released under the [MIT licence](LICENSE), so the published code stays free to use, change and fork whatever happens to the project.

## Quick start

- **Browser:** open [gostman.com/web](https://gostman.com/web), paste a URL and press Send.
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
PASS  GET      Todos/List todos  200 OK  99 ms  3/3 tests
PASS  GET      Todos/Get one todo  200 OK  13 ms  3/3 tests
PASS  POST     Todos/Create a todo  201 Created  286 ms  3/3 tests

Requests  3 passed
Tests     9 passed
```

Open the same folder in the desktop app with **Open folder** to see the requests, the checks and the variable passed from one request to the next.

## Learn

- [Tutorial: test an API](docs/tutorial-first-collection.md) builds that collection step by step: variables, folders, assertions, chaining, scripts and a data-driven run.
- [Tutorial: run your API tests in CI](docs/tutorial-ci.md) runs it on every pull request with secrets kept out of the files.
- [Guides by task](docs/guides.md): migrate from Postman, mock a backend before it exists, record real traffic, load test, publish docs, let a coding agent call your API.
- [Script reference and examples](docs/scripting-and-settings.md#tests-and-scripts): JSON Schema checks, request signing, fetching a token, polling.
- [Troubleshooting](docs/troubleshooting.md)

## Features

- **Protocols:** REST, GraphQL (schema browser), gRPC (reflection or `.proto`), WebSocket, Socket.IO, MQTT over WebSocket, GraphQL subscriptions, Server-Sent Events, SOAP and MCP servers, over HTTP or, on the desktop, as a local command (stdio).
- **Auth:** Basic, Bearer, API key, OAuth 2.0 (with PKCE and automatic renewal), OAuth 1, Digest, AWS SigV4, NTLM, Akamai EdgeGrid, JWT Bearer, Atlassian ASAP and Hawk.
- **Workflow:** collections with nested folders, environments and variables, extraction rules to chain requests, a cookie jar, history, earlier responses with a side-by-side compare, and a command palette.
- **Tests:** assertions plus pre-request and post-response scripts with `test()` and `expect()` in a sandbox, and a collection runner with CSV or JSON data files, parallel runs and HTML, JUnit and JSON reports.
- **Local load testing** with `gostman load`: latency percentiles and pass or fail thresholds.
- **Secret scanner:** `gostman scan` and an in-app check find credentials typed into a collection before you commit or share it.
- **Collections as files:** plain YAML in a folder with a Git panel (diff, commit, push, branches, stash, conflicts) on the desktop.
- **Mock server and capture:** serve saved examples or an OpenAPI spec locally, and record traffic from your own app.
- **OpenAPI:** import, sync with a remote spec, and a spec viewer with a linter (`gostman lint`).
- **Docs:** generate one HTML page with Markdown descriptions and an optional Try it panel.
- **Secret managers:** HashiCorp Vault, AWS, Azure and Google Cloud; the password managers KeePassXC, 1Password and Bitwarden; and your OS keychain for stored values.
- **Sharing:** encrypted share links that never upload anything, and Open in Gostman links.
- **For coding agents:** `gostman mcp` lets Claude Code, Codex and Cursor call your API through the collection without seeing your secrets.
- **AI assistant** (optional, bring your own key): generate requests, tests and scripts, and explain errors.
- **Import and export:** Postman, OpenAPI, Insomnia, HAR, WSDL, Bruno, .http files (VS Code REST Client, JetBrains HTTP Client) and curl in; Postman, OpenAPI, HAR, Bruno, .http files, Markdown and a Gostman backup out.
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

## Web version

[gostman.com](https://gostman.com) runs the same interface in the browser. Browsers cannot call arbitrary APIs directly, so requests are relayed through a small proxy. Two consequences:

- The hosted proxy cannot reach `localhost` or private network addresses. Use the desktop app for local APIs.
- Proxy, CA certificate and client certificate settings exist only in the desktop app.
- A gRPC stream is collected and shown when it ends; messages for a client stream are written up front as a JSON array.
- Responses larger than 3 MB are truncated. The desktop app reads up to 50 MB.

Data in the web version is kept in the browser's local storage.

## Documentation

The same pages are published at [gostman.com/docs](https://gostman.com/docs). The tutorials and guides are listed under [Learn](#learn); the reference pages are:

- [Getting started](docs/getting-started.md) and [what is free in Gostman](docs/free-features.md)
- [Requests and responses](docs/requests-and-responses.md) and [protocols](docs/protocols.md)
- [Command line](docs/cli.md): `run`, `send`, `load`, `scan`, `lint`, `docs`, `mock`, `capture`, secret managers, data files, reports
- [CI recipes](docs/ci.md): GitHub Actions, GitLab CI, Jenkins, Docker
- [Use from a coding agent](docs/agents.md)
- [Folders, Git, mock server and capture](docs/workspaces-and-mock.md)
- [Sharing, generated docs and Open in Gostman links](docs/sharing-and-docs.md)
- [Variables, scripts and settings](docs/scripting-and-settings.md)
- [AI assistant](docs/ai.md)

## Contributing

Issues and pull requests are welcome. For anything larger than a small fix, please open an issue first to agree on the approach. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build, test and release.
