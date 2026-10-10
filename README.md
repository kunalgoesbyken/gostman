<div align="center">
  <img src="gostman-gui/build/appicon.png" alt="Gostman" width="96" height="96">
  <h1>Gostman</h1>
  <p>An API client for REST, GraphQL and WebSocket. Desktop app and web app, no account.</p>

  [![CI](https://github.com/kunalgoesbyken/gostman/actions/workflows/ci.yml/badge.svg)](https://github.com/kunalgoesbyken/gostman/actions/workflows/ci.yml)
  [![Release](https://img.shields.io/github/v/release/kunalgoesbyken/gostman)](https://github.com/kunalgoesbyken/gostman/releases/latest)
  [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
</div>

![Gostman sending a request](screenshots/app.png)

| | |
| --- | --- |
| ![Multipart body with auth](screenshots/request-body.png) | ![GraphQL query with the schema browser](screenshots/graphql.png) |
| ![Image response preview](screenshots/response-image.png) | ![Generated code](screenshots/code.png) |

Gostman is a native desktop application built with Go and [Wails](https://wails.io), with the same interface available in the browser at [gostman.vercel.app](https://gostman.vercel.app). Requests, collections and environments are stored on your machine. There is nothing to sign in to.

## Features

**Requests**

- REST with any method, GraphQL, and WebSocket
- Query parameters and headers as rows you can switch on and off
- Bodies: JSON, text, XML, form URL-encoded, multipart with file uploads, or a single file
- Auth helpers: Basic, Bearer token, API key (header or query)
- Per-request timeout, redirect and TLS verification settings
- Paste a `curl` command into the URL bar to turn it into a request

**Responses**

- JSON tree and raw views, HTML preview, inline images and PDFs
- Headers, cookies, status, size and timing
- Download any response body, including binary ones
- Cancel a request in flight

**Workflow**

- Collections with nested folders, tabs, history and search
- Environments with `{{variable}}` substitution in URLs, headers, bodies and auth
- Extraction rules that copy values from a response (JSON path, header, cookie or status code) into variables after every send, for chaining requests
- GraphQL schema introspection, query formatting and validation
- Code generation for curl, JavaScript, Python, Go, PHP and Java
- Import from Postman v2.1 and OpenAPI; export to Postman, OpenAPI, Markdown or a Gostman backup

## Install

Download the latest build from the [releases page](https://github.com/kunalgoesbyken/gostman/releases/latest).

| Platform | File | Notes |
| --- | --- | --- |
| Windows | [`Gostman-windows-amd64.exe`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-windows-amd64.exe) | Installer. Adds Start menu and desktop shortcuts and an uninstaller. |
| Windows | [`Gostman-windows-amd64-portable.exe`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-windows-amd64-portable.exe) | Single executable, no installation. |
| macOS | [`Gostman-darwin-universal.dmg`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-darwin-universal.dmg) | Intel and Apple Silicon. Drag Gostman to Applications. |
| Linux | [`Gostman-linux-amd64.deb`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-linux-amd64.deb) | Debian and Ubuntu. `sudo apt install ./Gostman-linux-amd64.deb` |
| Linux | [`Gostman-linux-amd64.tar.gz`](https://github.com/kunalgoesbyken/gostman/releases/latest/download/Gostman-linux-amd64.tar.gz) | Other distributions. `sudo tar -xzf Gostman-linux-amd64.tar.gz -C /` Requires GTK 3 and WebKitGTK 4.1. |

The builds are not code-signed yet, so the operating system asks for confirmation the first time:

- **Windows**: SmartScreen shows "Windows protected your PC". Choose **More info**, then **Run anyway**.
- **macOS**: right-click Gostman in Applications and choose **Open**, then confirm.

Windows needs the WebView2 runtime, which ships with Windows 10 and 11; the installer fetches it when it is missing.

## Web version

[gostman.vercel.app](https://gostman.vercel.app) runs the same interface in the browser. Browsers cannot call arbitrary APIs directly, so requests are relayed through a small proxy. Two consequences:

- The hosted proxy cannot reach `localhost` or private network addresses. Use the desktop app for local APIs.
- Responses larger than 3 MB are truncated. The desktop app reads up to 50 MB.

Data in the web version is kept in the browser's local storage.

## Variables

Define variables per environment as a JSON object and reference them anywhere with `{{name}}`. See [docs/variables.md](docs/variables.md).

## Development

Requirements: Go 1.24.5 or newer, Node.js 20 or newer, and the [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2.11.

```bash
git clone https://github.com/kunalgoesbyken/gostman.git
cd gostman
```

Desktop app with hot reload:

```bash
cd gostman-gui
wails dev
```

Web app (two terminals):

```bash
go run ./cmd/local            # request proxy on :8787, from the repository root
```

```bash
cd gostman-gui/frontend
npm install
npm run dev:web               # http://localhost:3000
```

Production builds:

```bash
cd gostman-gui && wails build                 # desktop binary in build/bin
cd gostman-gui/frontend && npm run build:web  # static site in dist-web
```

Checks run by CI:

```bash
go build ./... && go vet ./...                           # repository root
cd gostman-gui && go build ./... && go vet ./...
cd gostman-gui/frontend && npm run build && npm run build:web
```

### Layout

| Path | Contents |
| --- | --- |
| `engine/` | Go package that prepares and sends requests. Shared by the desktop app and the web proxy, so both behave the same. |
| `gostman-gui/` | Wails desktop application: `app.go` (bindings and storage), `websocket.go`, packaging assets in `build/`. |
| `gostman-gui/frontend/` | React interface used by both targets. `src/App.jsx` is the desktop entry, `src/WebApp.jsx` the web entry. |
| `api/` | Vercel serverless functions. `proxy.go` exposes the engine to the web app. |
| `cmd/local/` | The same proxy as a local server for development. |

### Releasing

Releases are automatic. Change `info.productVersion` in `gostman-gui/wails.json` and push to `main`. If no release exists for that version, the workflow builds the installers on Windows, macOS and Linux and publishes them as `v<version>`.

## Contributing

Issues and pull requests are welcome. For anything larger than a small fix, please open an issue first to agree on the approach.

## License

[MIT](LICENSE)
