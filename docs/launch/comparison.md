# Honest comparison: Gostman vs Postman vs Bruno

Checked 2026-10-21. Rule: every claim about Postman or Bruno has a source URL, or is marked TODO verify. Gostman claims come from README.md and AGENTS.md in this repo. Do not publish any TODO verify cell as fact. Performance: [benchmark results pending].

Source keys:
- P-pricing: https://www.postman.com/pricing/
- P-scratch: https://learning.postman.com/docs/getting-started/basics/using-scratch-pad/ (found via search; the page says the Scratch Pad is deprecated, replaced by the lightweight API Client for signed-out use)
- P-lightweight: https://learning.postman.com/v11/docs/getting-started/basics/using-api-client
- P-cli: https://learning.postman.com/docs/postman-cli/postman-cli-overview/
- B-pricing: https://www.usebruno.com/pricing
- B-gh: https://github.com/usebruno/bruno
- B-docs: https://docs.usebruno.com/
- B-ws: https://docs.usebruno.com/send-requests/websocket/overview

| Area | Gostman | Postman | Bruno |
| --- | --- | --- | --- |
| License | MIT (README) | TODO verify (proprietary; no source checked) | MIT ([B-gh](https://github.com/usebruno/bruno)) |
| Price | Free, no paid tier | Free $0, Solo $9/mo, Team $19/user/mo, annual billing; Enterprise by sales ([P-pricing](https://www.postman.com/pricing/)) | Open Source $0, Pro $6/user/mo, Ultimate $11/user/mo, annual billing ([B-pricing](https://www.usebruno.com/pricing)) |
| Account needed | No (README) | Not stated on pricing page. Signed-out use is via a lightweight API Client without collections and environments ([P-scratch](https://learning.postman.com/docs/getting-started/basics/using-scratch-pad/), search summary); TODO verify on the P-lightweight page | Described as "offline-only" with collections in a folder on the filesystem ([B-gh](https://github.com/usebruno/bruno)) |
| Collections stored as | YAML files in a folder (desktop, "Open folder"); web uses browser localStorage (README) | TODO verify | Bru plain-text files in a filesystem folder ([B-gh](https://github.com/usebruno/bruno)) |
| Git-friendly collections | Yes, YAML per request (README) | TODO verify | Yes: "Git collaboration" in the API client summary ([B-docs](https://docs.usebruno.com/)); native Git integration and GitUI listed on pricing ([B-pricing](https://www.usebruno.com/pricing)) |
| REST / GraphQL / gRPC | All three (README) | TODO verify on a protocols page (lightweight client reportedly supports HTTP, WebSocket, gRPC, GraphQL per search summary) | HTTP, REST, GraphQL, gRPC listed ([B-pricing](https://www.usebruno.com/pricing)) |
| WebSocket | Yes; browser transport can send only Sec-WebSocket-Protocol, desktop sends all headers (AGENTS.md) | See lightweight client note above; TODO verify | Yes, from Bruno 2.13.0 ([B-ws](https://docs.usebruno.com/send-requests/websocket/overview)) |
| MCP server testing (client side) | Yes, Streamable HTTP: load tools, call, assert (README) | "MCP Client available" on all plans ([P-pricing](https://www.postman.com/pricing/)) | TODO verify (not found in official docs checked) |
| Exposes your collection to coding agents (MCP server) | Yes, `gostman mcp`, with redaction and host allowlist (README) | TODO verify. The Postman CLI page says it can be used "from your terminal, coding agents, or a CI/CD pipeline" ([P-cli](https://learning.postman.com/docs/postman-cli/postman-cli-overview/)); whether Postman ships an MCP server for collections is unchecked | No official MCP found in the docs checked; only third-party MCP servers exist (search results). TODO verify |
| CLI for CI | Yes, `gostman run`, JUnit/JSON/text reporters (README) | Yes, Postman CLI for running collections ([P-cli](https://learning.postman.com/docs/postman-cli/postman-cli-overview/)); login requirement not confirmed, TODO verify | Yes, CLI to "Run collections from the terminal, reports and CI/CD integration" ([B-docs](https://docs.usebruno.com/)) |
| Mock servers | Local, from saved examples, desktop and CLI (README) | Available on all plans; call limits not listed on the page ([P-pricing](https://www.postman.com/pricing/)) | TODO verify |
| Team collaboration | None built in; share via Git or encrypted link/file (README) | Yes: workspaces, commenting, RBAC on Team ([P-pricing](https://www.postman.com/pricing/)) | Via Git; Pro/Ultimate add private Git providers and more workspaces ([B-pricing](https://www.usebruno.com/pricing)) |
| Import | Postman v2.1, OpenAPI (README) | TODO verify | TODO verify |
| Cloud sync | None | TODO verify | None planned ("no plans to add cloud sync", [B-gh](https://github.com/usebruno/bruno)) |

## Where Gostman loses or is unproven

| Area | Honest status |
| --- | --- |
| Ecosystem and community | 5 GitHub stars, one maintainer. Bruno's repo shows 47.8k stars ([B-gh](https://github.com/usebruno/bruno), fetched 2026-10-21). Postman is far larger; TODO verify a user count only if you want to cite one. |
| Maturity | v1.4.0, young codebase. Test files are not committed to the repo (AGENTS.md), so users cannot see the test suite. Say this plainly if asked. |
| Team collaboration | No workspaces, comments, roles or cloud sync. |
| Signed builds | Windows and macOS builds are unsigned; macOS CLI is not notarized (README). Postman describes its CLI as "signed" ([P-cli](https://learning.postman.com/docs/postman-cli/postman-cli-overview/)). Bruno signing: TODO verify. |
| Test-script API coverage | Scripts use `test()`, `expect()` (Chai), `req`, `res`, `env.get/set` in a sandbox with no network (README). Not Postman's `pm.*` API; compatibility of imported scripts is unproven, TODO verify. No script can make HTTP calls. |
| Web version | Needs a proxy; cannot reach localhost or private addresses; responses over 3 MB truncated; network settings and folder storage are desktop-only (README). |
| gRPC streaming | Streams are collected and shown at the end, not interactive (README, AGENTS.md). |
| Agent limits | OAuth 2.0 authorization-code grant and WebSocket are not available to agents (README). |
| Import formats | Postman v2.1 and OpenAPI only (README). |
| Docs / monitoring / flows / cloud runners | Not offered. Postman lists monitoring and cloud performance testing ([P-pricing](https://www.postman.com/pricing/)). |
| Performance | [benchmark results pending] |

## Unverified claims to resolve before publishing

- Postman license, storage format, import formats, protocols page, whether an account is required for the full desktop app, whether Postman ships an MCP server, CLI login requirement.
- Bruno: MCP/agent support, mock servers, import formats, code-signing, whether gRPC and WebSocket are in the free edition (the pricing page checkmarks did not render).
- Gostman: pm.* compatibility; telemetry (none found in the docs read, but the source was not audited).
