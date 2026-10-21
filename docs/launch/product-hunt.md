# Product Hunt

## Tagline (<= 60 chars)

    One API collection for you, your CI and your coding agent

(57 chars)

Alternate: `API client for humans, CI pipelines and AI agents` (51)

## Description (<= 260 chars)

    Gostman is an API client for REST, GraphQL, gRPC, WebSocket and MCP. Collections are YAML files in your repo, run in CI with the CLI, and are exposed to coding agents over MCP with secrets redacted. Desktop, web and CLI. No account. MIT.

(about 238 chars; recount before submitting)

## Maker first comment

Hi Product Hunt, I'm the maker.

I built Gostman because I kept handing API calls to coding agents and watching tokens end up in transcripts, or the agent re-inventing a request I had already saved. So the collection is a folder of YAML files, and three things read the same files: the desktop/web app for you, the `gostman` CLI for CI (JUnit output, exit codes), and `gostman mcp` for agents like Claude Code, Codex and Cursor.

For agents, secrets stay as `{{name}}` and are redacted from responses, calls are limited to hosts your collection already uses, and bodies are capped to keep answers small.

Honest caveats: builds aren't code-signed yet (expect a SmartScreen or Gatekeeper warning), the web version routes through a proxy that can't reach localhost, there are no team or cloud features, and it is young. It is MIT licensed with no account or sign-in.

I'd love to hear what's missing for you.

## Gallery ideas (5)

1. Agent flow (hero GIF). Claude Code calls `send_request` against a saved collection; the result shows `{{token}}` instead of the secret. Caption: "Your agent uses the requests you already wrote. Secrets stay out of the chat."
2. Collection in Git. Side by side: the app's request tree and the YAML folder in an editor or `git diff`. Caption: "Collections are plain YAML. Review them in a pull request."
3. CI run. Terminal showing `gostman run ... --reporter junit` with a failed check and exit code 1. Caption: "The same collection runs in CI. Exit 0, 1 or 2."
4. Protocols. Existing screenshots/app.png and screenshots/graphql.png, plus gRPC/WebSocket/MCP tabs. Caption: "REST, GraphQL, gRPC, WebSocket and MCP servers."
5. Local-first. Mock server and capture panel. Caption: "Mock server and traffic capture on 127.0.0.1. No account."

Existing assets: screenshots/*.png, gostman-gui/frontend/src/assets/landing/tests.png and runner.png.

## Topics

Developer Tools, API, Open Source, Artificial Intelligence, GitHub
