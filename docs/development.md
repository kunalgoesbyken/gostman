# Development

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

## Layout

| Path | Contents |
| --- | --- |
| `engine/` | Go package that prepares and sends requests. Shared by the desktop app and the web proxy, so both behave the same. |
| `rpc/` | Go package for gRPC: reflection, `.proto` compilation and calls. |
| `workspace/` | A collection as YAML files in a folder. |
| `runner/` | The send pipeline in Go for the command line, running the app's script code in an embedded JavaScript engine. |
| `mock/` | The mock server. |
| `agent/`, `mcp/`, `redact/` | The MCP server, its tools and the redaction of secrets. |
| `mcpclient/` | The MCP client used to test MCP servers. |
| `capture/`, `loopback/` | The forwarding capture and the localhost-only listener it shares with the mock server. |
| `cmd/gostman/` | The `gostman` command line. |
| `gostman-gui/` | Wails desktop application: `app.go` (bindings and storage), `websocket.go`, packaging assets in `build/`. |
| `gostman-gui/frontend/` | React interface used by both targets. `src/App.jsx` is the desktop entry, `src/WebApp.jsx` the web entry. |
| `api/` | Vercel serverless functions. `proxy.go` exposes the engine to the web app. |
| `cmd/local/` | The same proxy as a local server for development. |

## Releasing

Releases are automatic. Change `info.productVersion` in `gostman-gui/wails.json` and push to `main`. If no release exists for that version, the workflow builds the installers on Windows, macOS and Linux and publishes them as `v<version>`.
