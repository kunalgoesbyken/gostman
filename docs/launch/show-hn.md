# Show HN

## Title options (<= 80 chars)

Primary:

    Show HN: Gostman – an API client your coding agent and CI share (MCP + CLI)

Alternates:

- Show HN: Gostman – API collections as YAML that agents call over MCP, CI over CLI
- Show HN: An API client with an MCP server and a CI runner, collections in Git

Count characters of whichever you pick before submitting (the primary is about 76).

URL to submit: https://github.com/kunalgoesbyken/gostman

## First comment (post immediately after submitting)

Hi HN, I'm the author.

Gostman is an API client (REST, GraphQL, gRPC, WebSocket, and MCP servers) that comes as a desktop app, a web app and a `gostman` command line. The point of this post is the last part: the same collection can be used by you, by CI, and by a coding agent.

- CLI: `gostman run orders-api --env CI --reporter junit` sends every request in a folder in order, with scripts, extraction rules, cookies, OAuth 2.0 tokens and assertions. Exit code 0 means everything passed, 1 means a request or check failed, 2 means bad input.
- Agents: `gostman mcp --workspace api` is an MCP server, so Claude Code, Codex, Cursor and similar clients call your API through the collection instead of improvising `curl`.
- Storage: a collection is a folder of YAML files (one per request), so it lives in Git next to the code. No account, nothing is uploaded.

Why I built it: when I let an agent poke at an API, it either pastes tokens into `curl` commands (which end up in the transcript) or reinvents the request every time. I wanted the agent to use the requests I had already written, and I wanted the same file to run in CI.

What the agent integration does, and doesn't do:

- Requests reference `{{name}}`. Values are filled in inside Gostman and replaced by their names in anything returned to the agent, including URL-encoded, base64 and JSON-escaped echoes. This guards against accidental exposure. It is not a barrier against a server that returns a secret in a transformed form. Variable values shorter than six characters aren't treated as secrets.
- The agent can only call hosts your collection already uses, plus localhost, unless you pass `--allow-host`. Requests an agent saves don't widen that list, and it can't save a literal credential.
- Response bodies are capped at 8 KB by default.
- The OAuth 2.0 authorization-code grant and WebSocket requests aren't available to agents.

Known limits:

- Builds are not code-signed. Windows SmartScreen and macOS Gatekeeper will warn you the first time, and the macOS CLI isn't notarized.
- The web version at gostman.vercel.app relays requests through a small proxy, because browsers can't call arbitrary APIs. The hosted proxy can't reach localhost or private addresses, responses over 3 MB are truncated, and proxy/CA/client-certificate settings, folder storage, the mock server and capture exist only in the desktop app. Use the desktop app or CLI for local APIs.
- gRPC streams are collected and shown when they end, not interactive.
- Scripts are JavaScript with `test()` and Chai `expect()`, in an isolated worker with no network access. [TODO verify: whether Postman's `pm.*` scripts run unchanged after import; say so here once checked.]
- Imports exist for Postman v2.1 and OpenAPI only.
- It is young and has few users: no plugin ecosystem, no team features, no cloud sync.

Stack: Go for the request engine (shared by desktop, CLI and the web proxy, so they behave identically), Wails v2 and React for the UI, an embedded JS engine (goja) so the CLI runs the same script code as the app. MIT licensed.

Performance: [benchmark results pending]. I'd rather not claim anything until it's measured.

I'd especially like feedback on the agent security model (is an allowlist plus redaction the right default?) and on what would stop you from putting a collection like this in your repo. Happy to answer anything.
