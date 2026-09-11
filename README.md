# Gostman

<div align="center">
  <img src="gostman-gui/frontend/src/assets/logo.jpg" alt="Gostman Logo" width="120" height="120" style="border-radius: 20px; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.3);">
  
  <h1 style="margin-top: 20px;">Modern API Client for GraphQL, REST & WebSocket</h1>
  
  <p style="font-size: 1.2em; color: #666;">
    Native, Privacy-First, and 10x Lighter than Postman.
  </p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  ![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go&logoColor=white)
  ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
</div>

<br>

![Gostman Landing Page](screenshots/landing_page.png)

## Overview

Gostman is a modern, cross-platform API client built with **Wails** (Go + React). It combines the performance of a native Go backend with the beautiful, reactive UI of modern web technologies. Designed for developers who value speed, privacy, and simplicity without compromising on power.

## Features

- 🚀 **Multi-Protocol Support**: Native support for **REST**, **GraphQL**, and **WebSockets**.
- ⛓️ **Request Chaining**: Use response data as variables in subsequent requests for complex workflows.
- 📤 **Response Extraction**: Pull values out of a response with JSONPath (or dot notation) straight into environment variables.
- ⚡ **Lightning Fast**: Built with Go for instant startup and blazing-fast response times.
- 🎨 **Beautiful UI**: Modern glassmorphic design with smooth animations and dark mode.
- 🔄 **Import/Export**: Effortlessly migrate with support for **Postman collections** and OpenAPI specs.
- 🔒 **Local & Private**: All data stays on your machine. No cloud sync, no tracking, no accounts.
- 📂 **Collections & Environments**: Organize requests and manage Dev/Staging/Prod variables with ease.
- ⌨️ **Power User UX**: Native keyboard shortcuts and intuitive workflow.

## Installation

### Download Pre-built Binaries

Visit the [Releases](https://github.com/krockxz/gostman/releases) page to download the latest version:

| OS | Format | Download |
|----|--------|----------|
| **macOS** | `.zip` | [Universal Binary (Intel + Apple Silicon)](https://github.com/krockxz/gostman/releases/latest/download/Gostman-darwin-universal.zip) |
| **Windows**| `.exe` | [64-bit Installer](https://github.com/krockxz/gostman/releases/latest/download/Gostman-windows-amd64.exe) |


### Build from Source

**Prerequisites:**
- Go 1.23+ for the desktop app (`gostman-gui/go.mod`); Go 1.24.5+ if you also build the web proxy, which the root and `api/` modules require
- Node.js 20+
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

```bash
# 1. Install Wails
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# 2. Clone the repository
git clone https://github.com/krockxz/gostman.git
cd gostman/gostman-gui

# 3. Build the application
wails build
```

Run the binary from `build/bin/`.

## Why Gostman?

| Feature | Gostman | Postman | Insomnia |
|---------|---------|---------|----------|
| **Launch Speed** | < 1s | 10-20s | 5-10s |
| **Privacy** | 🔒 100% Local | ☁️ Cloud Sync | ☁️ Cloud Sync |
| **Memory Usage**| ~100MB | ~1GB+ | ~500MB+ |
| **GraphQL/WS** | ✅ Built in | ✅ Native | ✅ Native |
| **Data Ownership**| You own it | Vendor lock-in | Vendor lock-in |

## Technical Details

### Multi-Protocol Power
Gostman isn't just for REST. **GraphQL** requests get query validation, formatting, and automatic
operation-name/variable detection (via the `graphql` + `graphql-request` libraries), and **WebSocket** URLs
open a live connection panel with message history, JSON pretty-printing, and optional auto-reconnect — all
within the same interface.

> WebSocket connections use the browser's native `WebSocket` API, which cannot send custom request headers.
> Only `Sec-WebSocket-Protocol` is honoured, and it is passed as a subprotocol. Schema introspection is not
> yet surfaced in the GraphQL editor, so there is no schema-driven autocomplete.

### Response Extraction & Chaining
The **Extract** tab turns a response into variables. Add extraction rules that name a variable and point at a
value using a JSONPath expression (`$.data.token`), plain dot notation (`data.user.id`), a response header
(`header.Location`), or `statusCode`. Matches are previewed live against the last response; hitting
**Extract Variables** merges them into your variables, where `{{placeholders}}` in later requests pick them up.

| Variable | Path | Result |
|----------|------|--------|
| `auth_token` | `$.data.token` | the token from the login response |
| `user_id` | `data.user.id` | nested id via dot notation |
| `created_at` | `header.Location` | a response header |

The panel also renders a read-only, Postman-compatible script preview of your rules
(`pm.environment.set("auth_token", pm.response.json().data.token);`) so the same chaining can be pasted into
Postman. Note that Gostman does not execute those scripts — there is no assertion/test runtime yet, so
scripted assertions are not available.

### Zero-Friction Migration
Don't get stuck. Import your existing **Postman Collections** (v2.1) and Environment files instantly. Export your Gostman collections anytime in standard formats.

## Development

### Live Development (Hot Reload)

Run the application in development mode. This starts both the Go backend and the Vite frontend server.

```bash
cd gostman-gui
wails dev
```

### Web Version

Gostman also runs as a pure web application (with some limitations like CORS, handled via proxy in production).

```bash
cd gostman-gui/frontend
npm run dev:web
```

## Project Structure

```bash
gostman/
├── gostman-gui/     # Desktop application (Wails v2)
│   ├── main.go      # Application entry point
│   ├── app.go       # Wails app context and backend methods
│   ├── wails.json   # Wails project configuration
│   ├── frontend/    # React frontend (Vite), shared by desktop and web
│   │   ├── src/
│   │   │   ├── App.jsx       # Desktop app component
│   │   │   ├── WebApp.jsx    # Web app component (with landing page)
│   │   │   ├── components/   # UI Components
│   │   │   ├── store/        # Zustand state
│   │   │   └── lib/          # Utilities (API, Storage, etc.)
│   └── build/       # Build output
├── api/             # Vercel Go serverless functions (proxy.go = CORS proxy)
├── cmd/local/       # Local HTTP server exposing /api/proxy for `npm run dev:web`
├── docs/            # Additional documentation
├── vercel.json      # Vercel deployment config
└── README.md        # Project Documentation
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the MIT License.
