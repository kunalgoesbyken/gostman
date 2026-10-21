# Reddit posts

Before posting: read each sub's current self-promotion rules, use the right flair, disclose you are the author, answer every comment, and do not paste the same text across subs.

---

## r/golang

Title: I built an API client in Go (Wails + a shared request engine) that doubles as an MCP server and CI runner

Body:

I've been working on Gostman, an API client for REST/GraphQL/gRPC/WebSocket. Sharing it here for the architecture, and I'd like it picked apart.

- `engine/` prepares and sends requests (variable substitution, auth, body encoding, redirects, cookie jar, OAuth 2 token requests, proxy and cert handling). It is standard library plus `x/net/publicsuffix`. The Wails desktop app, the CLI and a Vercel serverless proxy for the web version all call it, so they behave the same.
- The UI is React, shared by desktop and web behind a small backend adapter interface.
- gRPC (`rpc/`) uses grpc-go with server reflection, or protocompile for `.proto` files.
- The CLI has to run the same pre/post-request scripts as the app, so `runner/` embeds goja and runs a generated JS bundle. goja is pinned to the last commit that builds on Go 1.24.
- `mcp/` is a hand-written MCP stdio server, because the official Go SDK needs Go 1.25 and the Wails v2.11 CLI can't load packages under Go 1.25+. Was that the right call?
- Collections are YAML files in a folder (`workspace/`, yaml.v3).

Things I'm unsure about: Wails v2 vs alternatives, the goja pin, and keeping a hand-rolled MCP implementation current.

Limits: builds are unsigned, the web version's proxy can't reach private addresses, gRPC streams are collected rather than interactive. MIT: https://github.com/kunalgoesbyken/gostman

(Note: go.mod module path is github.com/krockxz/gostman while the repo is kunalgoesbyken/gostman. Expect someone to notice; fix or explain before posting.)

---

## r/selfhosted

Title: Gostman: a local-first API client, collections are YAML in your Git repo, no account

Body:

Not a server you host, but it fits the usual self-hosted preferences, so I'm posting in case it's useful (I'm the author; mods, remove if off-topic).

- Requests, environments and examples are stored on your machine. With "Open folder" they are plain YAML files, one per request, that you commit like code.
- No account and no cloud sync. Share links are encrypted in the browser and the key sits after the `#`, so nothing is uploaded. [TODO verify: confirm the app and landing page have no analytics or telemetry before saying so.]
- A `gostman` CLI runs collections in CI or cron (`gostman run`, JUnit output), and `gostman mock` serves saved responses on 127.0.0.1.
- A hosted web version exists, but it relays requests through a proxy on Vercel; the desktop app does not.
- MIT licensed. Windows, macOS, Linux (.deb and tar.gz).

Caveats: unsigned builds, young project, no team or sync features right now. What would you need before trusting something like this with API credentials?

---

## r/programming (neutral)

Title: Letting coding agents call APIs without secrets in the transcript: what I built and where it falls short

Body:

When an agent tests an API it usually pastes tokens into `curl`, and those land in the conversation. I tried a different split: requests live in a collection (YAML files), the agent calls them by name over MCP, and the tool fills secrets in on its side.

What I implemented:

- Placeholders like `{{token}}` are resolved outside the agent's view. In results, secret values are replaced by their names, including URL-encoded, base64 and JSON-escaped forms.
- The agent can only reach hosts the collection already uses (plus localhost) unless you opt in, and what it saves can't expand that list or contain a literal credential.
- Responses are capped (8 KB default) and can be narrowed with a JSONPath.

What it doesn't solve: if a server echoes a secret in a form I don't recognise, it leaks. Values shorter than six characters aren't treated as secrets. It is accidental-exposure protection, not a sandbox.

The same collection runs in CI via a CLI with JUnit output. The project is Gostman, MIT, written in Go: https://github.com/kunalgoesbyken/gostman

I'm more interested in criticism of the threat model than of the app.
