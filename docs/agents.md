# Use from a coding agent

`gostman mcp` serves a workspace over the Model Context Protocol, so Claude Code, Codex, Cursor and other MCP clients can call your APIs through Gostman in place of `curl`.

```bash
gostman init
claude mcp add gostman -- gostman mcp --workspace /path/to/project/gostman --var-from-env API_TOKEN
```

`gostman init` creates the workspace in the current folder, or in a `gostman` folder inside it when the current folder already holds other files, such as a repository root. It never overwrites a file, and it prints the registration command with the workspace's absolute path, because MCP clients start the server from their own folder. For other clients, register the command `gostman` with the arguments `mcp --workspace <path>`.

## Tools

| Tool | What it does |
| --- | --- |
| `list_requests` | Lists saved requests with their ids, folders, tags, and whether they have checks and examples. |
| `get_request` | Shows one request in full, credentials masked; `options` lists only the settings changed from the defaults. |
| `send_request` | Sends a saved request, or an ad hoc one, with scripts, assertions, cookies and tokens. `variables` win over the environment and the request's own Vars for the rest of the session. Placeholders that no variable defines are listed under `unresolved`. |
| `run_folder` | Runs a folder or the whole workspace; `tags` and `exclude_tags` pick a subset, `data` (one object per iteration; its fields win over the environment and the request's own Vars) and `iterations` repeat it, at most 100 times. Requests sent with undefined placeholders are listed under `unresolved`, even when they passed. |
| `last_response` | Shows the last response a request got in this session and compares it with a saved example: status, content type and the JSON paths that differ. `shape_only` compares only structure and types. |
| `save_request` | Creates a request, or changes one by id: name, description, folder, method, URL, headers, body, tags, assertions and extraction rules. An extraction rule such as `{"name": "token", "source": "body", "expression": "$.token"}` on a login request keeps the token in the session, so later requests use `{{token}}` and the agent never sees its value. |
| `import_requests` | Adds requests from an OpenAPI or Swagger spec, a Postman, Insomnia or Bruno collection, a HAR file, `.http` requests or a curl command, given as text or fetched from an address. |
| `list_environments` | Lists environments and the names of their variables. |
| `set_environment` | Switches the active environment for the session. Variables set by earlier requests are cleared; cookies and OAuth 2.0 tokens are kept. |
| `set_variables` | Saves plain values such as `baseUrl` in an environment file; a new name creates the environment. The session uses them once that environment is active (`set_environment`). |
| `lint_spec` | Checks an OpenAPI or Swagger document with the rules of `gostman lint`. |
| `scan_secrets` | Looks for credentials typed into the workspace, as `gostman scan` does. |
| `load_test` | Sends one saved request repeatedly: at most 20 at once, 30 seconds and 5,000 requests. |
| `start_mock`, `stop_mock`, `mock_status` | Run a mock server on localhost from the saved examples. |

Tools return JSON both as text and as structured content, describe themselves with read-only and destructive hints, and report progress during `run_folder` (requests done out of the planned total) and `load_test` when the client asks for it. While a request, a run or a load test is going on, `list_requests`, `get_request`, `save_request`, `import_requests`, `lint_spec` and `scan_secrets` still answer; tools that use the session's cookies and variables wait for it to finish.

### A collection as tools

`--expose-tag <tag>` turns every request with that tag into a tool of its own, named after the request, with the request's description as the tool's description. The description ends with the tool's arguments, so a parameter that the description lists but the tool does not take, such as one documented by an OpenAPI import, keeps its saved value. Each `{{variable}}` in the request's address, headers and body becomes a parameter; variables the active environment does not define are required. Credential-named variables and credential headers are never parameters. Values given to a tool apply to that call only and must be plain: a value that holds `{{...}}`, reads a file or holds the value of a variable or credential is refused.

```bash
gostman mcp --workspace api --expose-tag agent
```

## Safety

- **Secrets stay out of the conversation.** Requests reference `{{name}}`; values are filled in inside Gostman and replaced with their names in everything returned, including URL-encoded, base64 and JSON-escaped echoes. Variable values shorter than six characters, with fewer than four different characters, or such as `true` and `null`, are not treated as secrets; passwords, tokens and keys in a request's auth settings are, from three characters. This guards against accidental exposure; it is not a barrier against a value the server returns in a transformed form.
- **The agent can only call hosts your own requests use**, plus localhost. Add more with `--allow-host api.example.com`, or `--allow-host '*'` for any. `--block-private` also refuses private and loopback addresses. A refused request comes back with a hint telling the agent to ask you rather than reach the host another way. The same list applies to fetching a spec for `import_requests` or `lint_spec`, and to `load_test`.
- **Agent work never widens that list.** Requests the agent creates or imports, and requests whose address the agent changes, do not count; editing another field of your request, such as adding an assertion, keeps it yours. Values the agent writes with `set_variables` or brings in with an import are ignored when the list is worked out, until you change them yourself. The ids and value fingerprints are kept in `.gostman/agent-requests.json` and `.gostman/agent-variables.json`.
- **No literal credentials are written.** `save_request` refuses a value that matches any variable or credential; write `{{name}}` instead. `set_variables` and `import_requests` refuse the values of credentials and of credential-named or secret variables, literal `Authorization` and `Cookie` headers, and values that look like tokens to `gostman scan`. `set_variables` also refuses credential-named variables, and variables you marked secret or linked to a secret manager cannot be changed.
- **Imports are inert.** Scripts, OAuth 2.0 settings and the values of secret variables are left out of what an agent imports, and imports that read local files with `{{$file(...)}}` or run local commands are refused. Import those yourself in the app or with `gostman import`.
- **No local files or commands.** Agent sessions never read files with `{{$file(...)}}` and never run `stdio:` MCP commands.
- **State carries across calls.** Cookies, OAuth 2.0 tokens and variables last for the session.
- **Small answers.** Bodies are capped at 8 KB by default. The agent can narrow one with a JSONPath (`select`) or raise the cap up to 256 KB (`max_body_bytes`).
- **Shared work.** Requests the agent saves are YAML files in the workspace, visible in the app and in Git.

The OAuth 2.0 authorization code and device code grants need a person to sign in in a browser, so an agent cannot start them; pass a token you already have with `--oauth-token-env NAME` or `--oauth-refresh-token-env NAME` and it is hidden from the agent like any credential. WebSocket requests are not available to agents.

## Server options

`gostman mcp` takes `--workspace`, `--env`, `--var`, `--var-from-env`, `--env-file`, `--secrets`, `--secrets-env-file`, `--allow-host`, `--block-private`, `--expose-tag`, `--oauth-token-env` and `--oauth-refresh-token-env`, plus the network flags of `gostman run`: `--timeout`, `--insecure`, `--cacert`, `--client-cert`, `--client-key`, `--client-cert-pass-env`, `--proxy` and `--noproxy`. See [Command line](cli.md).

### Over HTTP

stdio is the default. `--listen <port>` serves the same tools over Streamable HTTP at `http://127.0.0.1:<port>/mcp`, for clients that connect to a running server:

```bash
gostman mcp --workspace api --listen 3401
claude mcp add --transport http gostman http://127.0.0.1:3401/mcp --header "Authorization: Bearer <token>"
```

The server binds to 127.0.0.1 only, refuses requests whose `Host` or `Origin` is not a loopback address, and requires the bearer token it prints when it starts. Set `GOSTMAN_MCP_TOKEN` (at least 24 characters) to keep the same token across restarts. Every connected client shares one session.

### Protocol versions

The server speaks MCP 2025-11-25 and earlier, which start with `initialize`, and the stateless 2026-07-28 revision, where every request carries its protocol version and client capabilities in `_meta` and `server/discover` reports the supported versions. Over HTTP, 2026-07-28 requests must send `MCP-Protocol-Version`, `Mcp-Method` and, for `tools/call`, `Mcp-Name` headers that match the body; a mismatch is refused with `400`.

## Agent Skill

`skills/gostman/SKILL.md` in the repository is an [Agent Skill](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) that teaches coding agents to use Gostman's MCP tools and command line. `gostman init --skill` writes it to `.claude/skills/gostman/SKILL.md` in the current folder, where Claude Code finds it; an existing file is left as it is. For other agents, copy the file to the folder they read skills from.
