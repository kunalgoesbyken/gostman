# Bruno parity roadmap (including Pro and Ultimate)

Goal: Gostman (MIT, free) matches every Bruno feature, including the paid tiers. This extends `docs/bruno-gap-analysis.md` (21 gaps) and does not repeat its prose; it adds the tier inventory, the paid-only features, and a work-package plan.

Rules for this document
- Bruno behaviour is described only from public docs/pricing text. No Bruno source is to be read or copied; paid features are under a commercial license. Every package below is a clean-room build from the behaviour descriptions.
- `D` = `https://docs.usebruno.com`. Evidence for each Bruno feature is the page path after `D`. "Pricing" = https://www.usebruno.com/pricing.
- Tier word `Pro` means Pro and Ultimate; `Ultimate` means Ultimate only. "Unconf." = the doc/pricing page did not state or did not render a tier. The pricing page rendered prices ($0 / Pro $6 / Ultimate $11 per user per month, annual) and some text cells, but most checkmark cells did not render, so tiers come mainly from the docs pages that state them.
- Status = Has / Partial / Absent for Gostman; `N/A` = needs a hosted service (see section 4). Gostman evidence is from reading code at commit `2093067`.
- The gap analysis is partly stale. Since it was written, commits `d4972e4` (variable highlight/hover/autocomplete: `VariableInput.jsx`, `variables.css`), `1253f82` (response body search and JSONPath filter: `ResponseSearchBar.jsx`, `lib/responseSearch.js`), `6f8bc45` (palette searches requests/history; tab and sidebar keybindings: `lib/shortcuts.js`) landed. Gaps 1, 7, 8 are done and gap 6 is mostly done (fixed bindings, no rebinding UI).

## 1. Tier inventory and Gostman status

### 1a. Paid-gated features (the new work this document adds)

| ID | Feature | Tier | Status | Behaviour (Bruno) and evidence | Gostman evidence |
|---|---|---|---|---|---|
| P01 | Visual (non-text) diff view in Git UI | Pro | Absent | Side-by-side visual diff of a changed request; `D/git-integration/using-gui/intro.md` | No git code in `gostman-gui/*.go`; README "Folders and Git" says reload-from-disk only |
| P02 | Git commit and push from the UI | Pro | Absent | Stage, commit, push changes; same page | none |
| P03 | Branch create/checkout, pull/push from any branch | Pro | Absent | same page | none |
| P04 | Connect remote, create GitHub repo, create pull request (4.2.0+) | Pro | Absent | same page | none |
| P05 | Stash changes | Pro | Absent | same page | none |
| P06 | Merge conflict resolution UI | Pro | Absent | same page | none |
| P07 | Per-request Git history | Pro | Absent | same page | none (app "history" is sent-request history, not git) |
| P08 | Private Git providers | Pro | Absent | Pricing row "Git Providers: Public vs Public + Private"; `D/git-providers/overview.md` | none |
| P09 | Unlimited open workspaces (free = 2) | Pro | Absent | `D/get-started/bruno-basics/create-a-workspace.md` | one folder/workspace at a time; `workspace_state.go` keeps a recent list only (max 8) |
| P10 | OpenAPI Sync unlimited (free = 5/month) | Pro | Absent | Compares collection to spec, shows drift and pending spec updates, Sync/Reset per endpoint, polls every 5 min, caches spec offline; `D/open-api/openapi-sync.md` | OpenAPI import only (`lib/importExport.js`); no re-sync |
| P11 | Data-driven runs from CSV/JSON files | Pro | Absent | Each row/object is one iteration, columns become `{{vars}}`; GUI runner and `--csv-file-path`; `D/testing/automate-test/data-driven-testing.md`, `D/get-started/bruno-basics/run-a-collection.md` | `RunnerDialog.jsx` has delay/stop-on-fail only; `cmd/gostman/run.go` flags: env, folder, bail, delay, timeout, insecure, reporter, output, redact |
| P12 | Parallel execution in the runner | Pro | Absent | `D/testing/automate-test/data-driven-testing.md` ("parallel execution require Pro or Ultimate"); mechanics unconf. | runner is sequential (`runner/run.go`) |
| P13 | HTML test report download | Ultimate (GUI); CLI `--reporter-html` tier Unconf. | Absent | `D/testing/automate-test/data-driven-testing.md`, `D/bru-cli/run/reports.md` | `runner/report/` has json, junit, text, terminal only |
| P14 | Secret managers in the app: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, Google Secret Manager | Ultimate | Absent | Fetch external secrets into an environment, reference as `{{name.key}}`; `D/secrets-management/secret-managers/overview.md` | no secret provider code anywhere (`agent/secrets.go` is MCP redaction only) |
| P15 | Secret managers in the CLI | Unconf. (v4.0.0+; page has no tier) | Absent | `--secrets-env-file`, `externalSecrets` block in env file; `D/bru-cli/secret-managers.md` | none |
| P16 | Bulk Postman import (collections + environments + globals, grouped by workspace) | Ultimate | Absent | `D/get-started/import-export-data/import-collections.md`, `.../postman-export-organizer.md` | Postman v2.1 collection import only |
| P17 | Bruno AI governance policy (org allow/deny providers, models, redaction) | Ultimate | N/A | `D/license-administrators/ai-policy.md` | no AI assistant exists; see F-AI |
| P18 | SAML SSO | Ultimate | N/A | `D/license-administrators/saml-sso/overview.md` | no accounts at all |
| P19 | SCIM provisioning | Ultimate | N/A | `D/license-administrators/scim-provisioning/overview.md` | n/a |
| P20 | Audit logs (license portal) | Ultimate (Pricing: Audit Logs "-" for Pro) | N/A | `D/license-administrators/license-portal.md` | n/a |
| P21 | License portal: seats, admins (2 on Pro, unlimited Ultimate), CSV user upload (Ultimate), billing | Pro/Ultimate | N/A | same page, Pricing | n/a |
| P22 | Support SLA, custom ToS/DPA/security review, dedicated account manager | Pro/Ultimate/Enterprise | N/A | Pricing | not software |

Enterprise: the pricing page lists no Enterprise column, only "Contact Sales"; no feature is tied to a tier called Enterprise. Ultimate plus custom contract terms is the top tier.

### 1b. Free-tier features (full inventory, with the status the gap analysis did not give)

| ID | Feature | Tier | Status | Bruno behaviour / evidence | Gostman evidence |
|---|---|---|---|---|---|
| F01 | REST requests (headers, params, bodies) | Free | Has | `D/send-requests/REST/overview.md` | `engine/`, `RequestTabs.jsx`, `BodyPanel.jsx` |
| F02 | GraphQL request + variables | Free | Has | `D/send-requests/graphql/graphql-api.md` | `GraphQLPanel.jsx`, `lib/graphqlSchema.js` |
| F03 | GraphQL query builder | Free | Partial | `D/send-requests/graphql/query-builder.md` | schema browser only |
| F04 | gRPC (reflection, protos, streams, scripting) | Free | Has (gRPC scripting: Absent) | `D/send-requests/grpc/*` | `rpc/`, `GrpcPanel.jsx` |
| F05 | WebSocket | Free | Has | `D/send-requests/websocket/*` | `WebSocketPanel.jsx`, `gostman-gui/websocket.go` |
| F06 | SOAP requests / WSDL import | Free | Absent | `D/send-requests/soap/soap-request.md`, `D/converters/wsdl-to-bruno.md` | XML body only; no WSDL parse |
| F07 | Server-Sent Events view | Free | Absent | `D/send-requests/REST/sse.md` | no event-stream handling in `engine/` or components |
| F08 | MCP client | not in Bruno | Has (ahead) | n/a | `mcpclient/`, `McpPanel.jsx` |
| F09 | Collections, nested folders, tree, search | Free | Has | `D/get-started/bruno-basics/*` | `CollectionTree.jsx`, `workspace/` |
| F10 | Folder/collection-level headers, auth, scripts, vars, docs, with inheritance | Free | Absent | `D/variables/folder-variables.md`, `D/auth/oauth2-2.0/collection-level-configuration.md` | `Folder{Id,Name,ParentId}` in `workspace/types.go` |
| F11 | Drag-drop reorder/move, copy/paste, clone folder | Free | Absent | `D/get-started/configure/keybindings.md` (unconf. for DnD) | no draggable code in tree |
| F12 | Environment variables | Free | Has | `D/variables/environment-variables.md` | `engine/expand.go`, `EnvironmentSwitcher.jsx` |
| F13 | Global environments across collections | Free | Absent | `D/variables/global-environment-variables.md` | per-workspace envs only |
| F14 | Collection, folder, request-level variables | Free | Absent | `D/variables/collection-variables.md`, `folder-variables.md`, `request-variables.md` | none; `Request` has no vars field |
| F15 | Runtime variables (script and post-response vars) | Free | Partial | `D/variables/runtime-variables.md`, `D/testing/script/vars.md` | `env.set` in scripts and extractors write to env; no separate runtime scope |
| F16 | Prompt variables `{{?Name}}` | Free | Absent | `D/variables/prompt-variables.md` | none |
| F17 | Process env and `.env` variables | Free | Partial | `D/variables/process-env.md`, `D/secrets-management/dotenv-file.md` | CLI `--var-from-env` only; no `{{process.env.X}}` |
| F18 | Dynamic variables (random/timestamp/uuid) | Free | Absent | `D/testing/script/dynamic-variables.md` | none in `engine/expand.go` |
| F19 | Variable interpolation + editor highlight/hover/complete | Free | Has | `D/variables/interpolation.md` | `VariableInput.jsx`, `lib/variables.js` |
| F20 | Secret variables (masked, stored outside env file, excluded from export) | Free | Absent (auth fields have a masked `SecretInput`) | `D/secrets-management/secret-variables.md` | `AuthInputs.jsx` only |
| F21 | Secret masking in reports | Free | Has | `D/secrets-management/secret-masking.md` | `--redact`, `redact/` |
| F22 | Auth: Basic, Bearer | Free | Has | `D/auth/basic.md` | `AuthPanel.jsx`, `engine/types.go` |
| F23 | Auth: API key (not in Bruno list) | n/a | Has | n/a | engine Auth.In |
| F24 | Auth: Digest | Free | Absent | `D/auth/digest.md` | none |
| F25 | Auth: AWS Signature | Free | Absent | `D/auth/aws-signature.md` | none |
| F26 | Auth: NTLM | Free | Absent | `D/auth/ntlm.md` | none |
| F27 | Auth: OAuth 1.0 | Free | Absent | `D/auth/oauth1.md` | none |
| F28 | Auth: Akamai EdgeGrid | Free | Absent | `D/auth/akamai-edgegrid.md` | none |
| F29 | OAuth 2.0 (code+PKCE, client creds, password), system browser, auto-renew | Free | Has | `D/auth/oauth2-2.0/*` | `engine/oauth.go`, `loopback/`, `gostman-gui/oauth.go` |
| F30 | Collection-level auth / inherit mode | Free | Absent | `D/auth/oauth2-2.0/collection-level-configuration.md` | per-request only |
| F31 | Client certificates, CA certs, proxy | Free | Has | `D/auth/add-and-manage-certs.md`, `D/get-started/configure/proxy-config.md` | `engine/network.go`, `NetworkDialog.jsx` |
| F32 | Cookie jar + manager | Free | Has | `D/send-requests/res-data-cookies/cookies.md` | `engine/cookies.go`, `CookiesDialog.jsx` |
| F33 | Response viewer (preview, copy, download, search, filter) | Free | Has | `D/send-requests/res-data-cookies/res-data.md` | `ResponsePanel.jsx`, `ResponseSearchBar.jsx` |
| F34 | Response layout toggle (vertical/horizontal) | Free | Absent | same page | `lib/layout.js` resize only |
| F35 | Response examples | Free | Has | `D/send-requests/res-data-cookies/response-examples.md` | `ExamplesDialog.jsx` |
| F36 | Response visualization (`bru.visualize` table/html) | Unconf. (page states no tier) | Absent | `D/advanced-guides/visualize.md` | none |
| F37 | Request history | Unconf. (page states no tier; Pricing row unrendered) | Has | `D/send-requests/history.md` | `HistoryList.jsx` |
| F38 | Timeline (request/response/network log, redirects, script requests) | Free | Absent | `D/debugging/timeline.md` | only `DurationMs` in `engine/types.go` |
| F39 | Dev tools console | Free | Partial | `D/debugging/dev-tools.md` | `console` passed into scripts (`lib/scripting/job.js`) but no panel |
| F40 | Code generator | Free | Has | `D/send-requests/REST/code-generator.md` | `lib/codeGenerator.js`, 6 languages (Bruno's list unconf.) |
| F41 | Assertions (about 30 operators) | Free | Has | `D/testing/tests/assertions.md` | `lib/scripting/assertions.js`, 24 operators |
| F42 | Tests + Chai expect | Free | Has | `D/testing/tests/introduction.md` | `TestsPanel.jsx`, `lib/scripting/` |
| F43 | `bru` scripting API (vars at scopes, `bru.sendRequest`, `runRequest`, `setNextRequest`, runner iteration data) | Free | Partial | `D/testing/script/javascript-reference.md`, `.../request-chaining.md` | `bru` is an argument (`job.js` line 100) but surface is `req/res/env/test/expect`; sandbox blocks network by design |
| F44 | Script flow, inbuilt/external libraries, JS files | Free | Absent | `D/testing/script/script-flow.md`, `inbuilt-libraries.md`, `external-libraries.md`, `js-file.md` | no module system |
| F45 | JavaScript sandbox modes (safe vs developer) | Free | Has (one safe mode) | `D/get-started/configure/javascript-sandbox.md` | `runner/sandbox/`, `sandbox.worker.js` |
| F46 | Collection runner (sequential, delay, run folder) | Free | Has | `D/get-started/bruno-basics/run-a-collection.md` | `runner/`, `RunnerDialog.jsx` |
| F47 | CLI run, reporters json+junit, redact | Free | Has | `D/bru-cli/run/overview.md` | `cmd/gostman/run.go`, `runner/report/` |
| F48 | CLI import (`bru import`) | Free | Absent | `D/bru-cli/import/overview.md` | cmds: init, run, send, mock, capture, docs, mcp |
| F49 | CLI docs generation | Free | Has | `D/bru-cli/docs/overview.md` | `cmd/gostman/docs.go` |
| F50 | CLI proxy/mTLS flags, Docker images, CI recipes (GH Actions, Jenkins, Azure) | Free | Partial (insecure flag only; no Docker image) | `D/bru-cli/proxyConfiguration.md`, `docker.md`, `github-actions/overview.md` | none |
| F51 | HTML API docs generation | Free | Has | `D/html-docs/generate.md` | `lib/docs/`, `cmd/gostman/docs.go` |
| F52 | Docs in generated HTML: env switcher, full-text search, interactive playground, deploy | Free | Partial | `D/html-docs/environments.md`, `search.md`, `playground.md` | playground Absent; search and env switcher unconf. in `lib/docs/page.js` |
| F53 | Markdown docs for request/folder/collection/workspace | Free | Partial | `D/api-docs/*` | plain `description` field in `SettingsPanel.jsx` |
| F54 | Mock server from collection examples | Free (Beta) | Has | `D/mock-servers/overview.md`, `mock-from-response-examples.md` | `mock/`, `MockServerDialog.jsx`, `DelayMs` field |
| F55 | Mock server from OpenAPI; header/query/body match rules; request log dashboard; multiple servers | Free (Beta) | Absent | `D/mock-servers/tutorial/mock-from-openapi.md`, `create-mock-server.md` | one server, path+method match only |
| F56 | Import: Postman collection, OpenAPI 2/3, Insomnia, WSDL, Bruno collection, Git clone | Free | Partial (Postman, OpenAPI 3 only) | `D/get-started/import-export-data/import-collections.md` | `ImportTab.jsx` |
| F57 | Postman script translator | Free | Absent | `D/get-started/import-export-data/script-translator.md` | none |
| F58 | Export: Bruno/OpenAPI/Postman; workspace zip; env import/export | Free | Partial | `D/get-started/import-export-data/export-collections.md`, `import-export-workspace.md`, `import-export-environments.md` | Postman, OpenAPI, Markdown, backup (`ExportTab.jsx`); env-only file export unconf. |
| F59 | OpenCollection YAML / `.bru` file format | Free | Absent | `D/opencollection-yaml/overview.md`, `D/bru-lang/overview.md` | own YAML (`workspace/requestfile.go`) |
| F60 | Workspaces (2 open) | Free | Absent | `D/get-started/bruno-basics/create-a-workspace.md` | single folder |
| F61 | Git UI free subset: init, text diff, fetch, pull, clone | Free (3.0.0+) | Absent | `D/git-integration/using-gui/intro.md` | none |
| F62 | "Fetch in Bruno" README button | Free | Partial | `D/git-integration/embed-bruno-collection.md` | share links (`ShareTab.jsx`), no URL scheme button |
| F63 | Bruno AI assistant (BYOK OpenAI/Anthropic/custom; script/test/doc generation, autocomplete; beta, v4.0.0+) | Unconf. (governance is Ultimate) | Absent | `D/ai/bruno-ai/introduction.md` | none (Gostman has an MCP server instead: Has, ahead) |
| F64 | Bruno Apps (custom HTML/React UIs per request/collection via `bru.ctx`; v4.0.0+) | Unconf. (no tier stated) | Absent | `D/apps/overview.md` | none |
| F65 | VS Code extension | Unconf. | Absent | `D/vs-code-extension/overview.md` | none |
| F66 | Settings: theme (dark/light/system), editor font, auto-save, layout | Free | Partial (dark only) | `D/get-started/configure/settings.md` | `index.css` color-scheme dark |
| F67 | Keybindings with rebinding and conflict detection | Free | Partial (fixed set, no rebinding) | `D/get-started/configure/keybindings.md` | `lib/shortcuts.js`, `ShortcutsDialog.jsx` |
| F68 | Tab features: preview tabs, reorder, context menu, reopen closed | Free | Partial (reopen done) | keybindings page | `TabBar.jsx` |
| F69 | Global search (Ctrl+K) | Free | Has | keybindings page | `ui/CommandPalette.jsx` |
| F70 | Test result history / saved run history | not found in Bruno docs | n/a | no page found; not counted | n/a |

## 2. Counts

Counted from the tables above (excluding F08, F23, which Bruno lacks, and F70, which has no evidence).

- Paid-gated (Pro or Ultimate or Unconf. paid, rows P01-P16): Has 0, Partial 0, Absent 16. Rows P17-P22 are N/A (hosted org administration).
  - Pro-tier: P01-P12 (12 rows) all Absent. Ultimate-only: P13 (GUI HTML report), P14, P16 (3 rows) Absent; P15 tier unconfirmed Absent.
- Free tier (F01-F69 minus F08, F23): 67 rows. Has 25, Partial 14, Absent 28 ( Unconf.-tier rows F36, F37, F63, F64, F65 are included in this tally: they are probably free but unconfirmed).
- Everything together: 89 rows; Has 25, Partial 14, Absent 44 (16 paid-gated plus 28 free), N/A 6 (hosted org administration).
- Of the 42 free-tier rows that are not Has, the previous gap analysis already covered roughly 17; this document adds the rest, notably F06, F07, F13, F14, F16-F18, F24-F28, F44, F48, F50, F52, F55, F57, F59, F60-F65 and all of P01-P16.

## 3. Work packages

Each package is one parallel agent's job. "Owns" lists the files only that package may edit; if a package needs a file owned by another, it must wait for that package or add a new file. Shared hot spots that need one owner at a time: `gostman-gui/frontend/src/store/appStore.js`, `gostman-gui/app.go`, `workspace/types.go`. Where a package must add fields there, it is serialized (see order).

| WP | Name | Covers | Effort | Owns (new or edited) | Depends on | Server/legal notes |
|---|---|---|---|---|---|---|
| WP1 | Variables core | F13 F14 F15 F16 F17 F18 F20 and env table editor/colours/extends (gap 3) | L | `engine/expand.go`, `runner/variables.go`, `workspace` environment files (`disk.go`/`metafiles.go`), `EnvironmentSwitcher.jsx`, new `EnvironmentDialog.jsx`, `docs/variables.md` | none | none. Secret values go in OS keychain or an app-data file, never the YAML. Keychain via a Go library is fine to add. |
| WP2 | Folder and collection settings | F10 F30 F53 (folder docs), gap 4 | L | `workspace/types.go` (Folder fields), `workspace/nodes.go`, `engine` merge helper (new file), `runner/collection.go`, `CollectionTree.jsx`, new `FolderSettings.jsx` | WP1 (needs the variable scope resolver) | none |
| WP3 | Auth breadth | F24 F25 F26 F27 F28 | M | new `engine/auth_digest.go`, `auth_sigv4.go`, `auth_ntlm.go`, `auth_oauth1.go`, `auth_edgegrid.go`, `AuthPanel.jsx`, `AuthInputs.jsx` | none | implement from the RFCs and AWS/Akamai public specs; NTLM and SigV4 libraries exist under MIT/Apache |
| WP4 | Runner v2 | P11 P12 P13 F43 (iteration data), F50 (run flags) | L | `runner/*.go`, `runner/report/html.go` (new), `cmd/gostman/run.go`, `RunnerDialog.jsx`, `lib/runner.js` | none (use WP1 for prompt vars later) | none. Parallelism needs the cookie jar and OAuth token cache to be goroutine-safe. |
| WP5 | Git UI (local-first) | F61 P01-P07 | L | new `gostman-gui/git.go`, new `GitPanel.jsx`, `GitDiffView.jsx`, `ConflictEditor.jsx`, `StorageMenu.jsx` | none | shell out to the user's `git` binary (works with any provider, public or private, via their credential helper). Create-PR and create-repo need the user's own GitHub/GitLab token, optional. Not available in the web build (no filesystem). |
| WP6 | OpenAPI sync and import | P10, OpenAPI 2/3 hardening, spec cache | M | new `openapi/` Go package (kin-openapi, MIT), `gostman-gui/openapi.go`, `ImportTab.jsx`, new `SpecSyncDialog.jsx` | none | none |
| WP7 | Secret managers | P14 P15 | L | new `secrets/` Go package with provider interface and Vault, AWS, Azure, GCP adapters, `cmd/gostman/run.go` flag additions via a small shim file, `SecretsDialog.jsx` | WP1 (secret variable type) | needs the user's own cloud accounts (their cost, not ours). Use official SDKs (Apache-2.0). Credentials come from standard env vars or a `--secrets-env-file`. |
| WP8 | Scripting v2 + visualizer | F36 F39 F43 F44 F57 | L | `lib/scripting/*`, `runner/sandbox/*` (regenerate bundle), new `ConsolePanel.jsx`, `VisualizeTab.jsx` | none (sendRequest needs a decision: allow only to hosts already in the collection, like the MCP allowlist) | none |
| WP9 | Timeline and network timing | F38 | M | `engine/send.go` (httptrace), `engine/types.go`, `api/proxy.go`, new `TimelineTab.jsx`, `ResponsePanel.jsx` | none | none |
| WP10 | Import/export breadth | F48 F56 F57 F58 F59 P16 | M | new `lib/import/` modules (insomnia, wsdl, har, bruno-bru, postman-bulk), `ImportTab.jsx`, `ExportTab.jsx`, new `cmd/gostman/import.go` | none | read formats from public format docs only (`.bru`, OpenCollection YAML are documented); do not read Bruno source |
| WP11 | Protocol extras | F03 F06 F07 | M | `engine/stream.go` (SSE, new), new `SseView.jsx`, `GraphQLPanel.jsx` builder part, SOAP template helper | none | none |
| WP12 | Multi-workspace | P09 F60 F62 | M | `gostman-gui/workspace_state.go`, `Sidebar.jsx`, `StorageMenu.jsx`, new workspace switcher | none (coordinate with WP5 on StorageMenu: do WP5 first) | none |
| WP13 | Docs v2 | F52 F53 (rest) | M | `lib/docs/*`, `DocsOptions.jsx`, `cmd/gostman/docs.go` | WP2 for folder/collection docs fields | playground in generated HTML: runs requests from the reader's browser, so it needs CORS on the API; note that in the output |
| WP14 | Mock v2 | F55 | M | `mock/*`, `gostman-gui/mock.go`, `MockServerDialog.jsx` | WP6 (`openapi/` package) | none |
| WP15 | Theme and preferences | F66, gap 13 | M | `index.css`, tailwind config, `MonacoEditor.jsx`, new `PreferencesDialog.jsx` | none | none |
| WP16 | Tree and tab interaction | F11 F34 F68, gaps 5 and 17 | M | `CollectionTree.jsx`, `lib/collectionTree.js`, `TabBar.jsx`, `lib/layout.js` | WP2 for a sortOrder field in `workspace/types.go` (or add it with WP2) | none |
| WP17 | Keybinding editor | F67 | S | `lib/shortcuts.js`, `ShortcutsDialog.jsx`, `hooks/useShortcuts.js` | none | none |
| WP18 | AI assistant (BYOK/local) | F63 | M | new `lib/ai/`, `AiPanel.jsx`; provider calls from Go in a new `ai/` package | none | user brings an OpenAI/Anthropic key or a local model (Ollama): free software, third-party usage cost is the user's. Redaction before send reuses `redact/`. |
| WP19 | Gostman Apps | F64 | M | new `lib/apps/`, sandboxed iframe host | WP8 (`bru.ctx` equivalent) | design our own message API; do not mirror Bruno's names beyond what docs publish |
| WP20 | Distribution and CI | F50 (Docker, CI recipes), F65 (VS Code extension) | M | `packaging/`, new `Dockerfile`, docs, new extension repo | WP4 for final flag set | none |
| WP21 | Team/hosted equivalents | P17-P22 | S for local files, L for any server | see section 4 | none | see section 4 |

### Ranking (value over effort, then unblockers)

1. WP1 Variables core (L): unblocks WP2, WP7; secret variables is the most visible hole.
2. WP4 Runner v2 (L): data-driven plus parallel plus HTML report are three paid items in one package.
3. WP5 Git UI (L): seven paid items; local-first so truly free end to end.
4. WP3 Auth breadth (M): five free-tier items, fully independent, easy to parallelize.
5. WP10 Import/export breadth (M): migration is the adoption path.
6. WP6 OpenAPI sync (M): a paid item (unlimited), plus feeds WP14.
7. WP2 Folder settings (L): biggest structural change; after WP1.
8. WP7 Secret managers (L): paid Ultimate item; after WP1.
9. WP8 Scripting v2 + visualizer (L).
10. WP9 Timeline (M), WP11 Protocol extras (M), WP14 Mock v2 (M), WP13 Docs v2 (M), WP12 Multi-workspace (M).
11. WP15 Theme, WP16 Tree/tabs, WP17 Keybindings, WP18 AI, WP19 Apps, WP20 Distribution, WP21 Team equivalents.

### Dependency order (waves)

- Wave 1 (all parallel, disjoint files): WP1, WP3, WP4, WP5, WP6, WP8, WP9, WP10, WP11, WP15, WP17, WP18.
- Wave 2: WP2 (needs WP1), WP7 (needs WP1), WP12 (after WP5), WP14 (needs WP6), WP19 (needs WP8).
- Wave 3: WP13 (needs WP2), WP16 (needs WP2 sortOrder), WP20 (after WP4), WP21.
- After each wave that touches `runner/sandbox/bundle.js`, regenerate with `npm run build:cli` and re-run `go test ./...`.

## 4. What "free end to end" can and cannot mean

Achievable offline and free (everything in WP1-WP20): Git workflows (system `git`), data-driven and parallel runs, HTML reports, OpenAPI sync, secret variables and manager integrations, auth types, scripting, docs, mocks, AI with a user-supplied key or local model.

Honest limits
- Third-party services are never "free" to the user: secret managers (Vault, AWS, Azure, GCP), cloud AI providers, GitHub/GitLab PR creation, and private Git hosting each need the user's own account. Gostman can ship the integration free; it cannot make the service free. Local equivalents: an encrypted local secrets file or OS keychain; a local model for AI; plain `git` for everything Git.
- SAML SSO, SCIM, a license portal, seat management and CSV user upload only make sense with a multi-user hosted identity service. Gostman has no accounts and no server; building them would require a hosted component and ongoing operations. Infeasible as a local-first feature. Honest equivalents: teams authenticate through Git hosting (their own SSO already protects the repo), and a self-hosted optional server would be a separate product decision, not part of parity.
- Audit logs: a local append-only JSONL log of runs and sends is feasible (S). A tamper-evident, org-wide log is not without a server.
- AI governance policy: feasible as a committed policy file (allowed providers, models, redaction flags) read by the app and CLI (S), enforced client-side only. It is not enforceable against a user who edits the file.
- Support SLA, custom ToS/DPA, dedicated account manager are commercial services, not features.
- Web build limits: Git UI, secret managers, filesystem workspaces, and mock servers cannot run in the browser build; desktop and CLI only.

Legal and licensing cautions
- Paid Bruno features are under a commercial license. Implement from the public behaviour descriptions only; do not read, port or translate Bruno's paid source, and do not copy its UI strings, icons, or docs text.
- Do not mimic the `.bru` / OpenCollection formats by reading source; the format specs are published and are fine to implement as importers/exporters.
- Avoid the Bruno trademark in product marketing beyond factual comparison.
- New dependencies must be MIT/BSD/Apache-2.0 (check each; avoid GPL/AGPL for NTLM, SigV4, git libraries). Shelling out to `git` avoids linking issues.

## 5. Unconfirmed items and open questions

- Tier for: Bruno AI assistant itself (only governance is Ultimate), Bruno Apps, response visualization, request history, mock servers, HTML docs, CLI secret managers, CLI `--reporter-html`. The pages state no tier, and the pricing page cells did not render. Treat as free until shown otherwise; Gostman should build them regardless.
- What parallel execution means in Bruno (concurrency model, ordering) is not described on the pages fetched.
- How many workspaces Pro allows beyond "unlimited" and the exact Pricing cell values for Data Driven and Report Generation per tier did not render; the docs sentences used above are the authority.
- Whether Gostman handles Swagger 2.0, Postman environments, and SSE was not exhaustively verified; marked from grep and file listings.
