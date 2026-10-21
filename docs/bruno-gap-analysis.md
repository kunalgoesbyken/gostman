# Bruno vs Gostman: gap analysis

Method: read Gostman's frontend (`gostman-gui/frontend/src`, README, AGENTS.md) and Bruno's public docs (index: https://docs.usebruno.com/llms.txt). Bruno behaviour is described only, not copied. Bruno 4.2.1 is installed locally but was not launched; claims below come from the docs. Where a doc page did not confirm a behaviour it is marked "unconfirmed". Effort S/M/L, impact H/M/L.

## Where Gostman is already ahead

- Protocol breadth: REST, GraphQL, gRPC (reflection and .proto), WebSocket and MCP servers in one app (README; `GrpcPanel.jsx`, `McpPanel.jsx`, `WebSocketPanel.jsx`).
- Agent story: MCP server (`gostman mcp`) with secret redaction and host allowlist. Bruno's AI pages (https://docs.usebruno.com/ai/integration/overview.md) are editor and agent integrations, not a redacting tool server.
- Traffic capture, mock server from saved examples (Bruno has a mock server too, https://docs.usebruno.com/mock-servers/overview.md), encrypted share links with no upload (`ShareTab.jsx`), HTML docs generation.
- Web version plus desktop plus CLI from one React codebase; no license tiers. Bruno gates visual diff, commit, push, branches and conflict resolution behind Pro/Ultimate (https://docs.usebruno.com/git-integration/using-gui/intro.md).
- Folder-trust model for untrusted workspaces (scripts and OAuth off until trusted).
- Cookie jar with manager, OAuth2 with PKCE and auto-renew, curl paste into the URL bar, extraction rules (no-code chaining), CLI reporters (JUnit), runner with delay and stop-on-failure.
- Lazy-loaded dialogs, virtual list for the tree (`ui/VirtualList.jsx`).

## Prioritized gaps

### 1. Variable UX in inputs (highlight, hover value, autocomplete) - impact H, effort M
- Bruno: variables are a first-class concept with seven scopes and a defined precedence (https://docs.usebruno.com/variables/overview.md, https://docs.usebruno.com/variables/interpolation.md). The in-editor highlighting, hover and autocomplete behaviour is not described on the pages fetched (unconfirmed from docs; it is known from the app UI that `{{var}}` is coloured and shows a value popover).
- Gostman: absent. `RequestBar.jsx`, `KeyValueEditor.jsx` and `BodyPanel.jsx` contain no `{{` handling; `MonacoEditor.jsx` registers no completion or hover provider. Variables are resolved only in the Go engine.
- Idea: tint `{{x}}` green when defined in the active environment and red when not; hover shows resolved value and its source; typing `{{` opens a list of known variables, including extractor outputs.
- Files: `RequestBar.jsx`, `KeyValueEditor.jsx`, `MonacoEditor.jsx`, new `lib/variableTokens.js`, `store/appStore.js` (`selectActiveVariables` already exists).

### 2. Secret environment variables - impact H, effort M
- Bruno: a `secret` checkbox per variable; values are kept out of the environment file and stored encrypted locally; secrets are shown in a separate tab and excluded from export (https://docs.usebruno.com/secrets-management/secret-variables.md). Also `.env` file access via `{{process.env.X}}` (https://docs.usebruno.com/secrets-management/dotenv-file.md).
- Gostman: absent. Variables are one JSON object per environment (`ui` in `RequestTabs.jsx` "Env vars" tab, `docs/variables.md`); README says values "are written as typed" into the folder and tells users to gitignore the file. The CLI has `--var-from-env`, which is a partial answer.
- Idea: per-variable secret flag, masked field with reveal, stored outside the YAML in `workspaces.json`/app data, omitted from export and share by default.
- Files: `RequestTabs.jsx` (vars editor), new env editor component, `store/appStore.js`, `workspace/` (environment YAML), `gostman-gui/workspace_state.go`, `lib/importExport.js`.

### 3. Environment editor and quick switcher polish - impact M, effort S-M
- Bruno: environment selector top-right, edit shortcut (Ctrl+E), variable filter by name or value, environment colours, environment inheritance via `extends` (4.2.0+), global environments across collections, default environment (https://docs.usebruno.com/variables/environment-variables.md, https://docs.usebruno.com/variables/global-environment-variables.md).
- Gostman: `EnvironmentSwitcher.jsx` is a native `<select>` plus add/rename/delete icon buttons; the command palette can switch environments (`ui/CommandPalette.jsx`). Variables are edited as raw JSON in the request panel. No global environment, no colour, no inheritance.
- Idea: a table editor (key, value, secret, enabled) in a dialog, a colour dot per environment (production red), and a "Global" scope below the active one.
- Files: `EnvironmentSwitcher.jsx`, `RequestTabs.jsx`, `store/appStore.js`, `engine/` variable merge, `workspace/`.

### 4. Folder- and collection-level settings (headers, auth, scripts, vars) - impact H, effort L
- Bruno: folder and collection settings with their own headers, auth, scripts, tests and variables, inherited by children; folder variables sit in the precedence stack (https://docs.usebruno.com/variables/folder-variables.md, https://docs.usebruno.com/variables/collection-variables.md, https://docs.usebruno.com/auth/oauth2-2.0/collection-level-configuration.md). The fetched create-a-folder page itself does not describe folder settings; they are documented on the variable and auth pages above.
- Gostman: absent. `Folder` is `{id, name, isOpen, parentId}` (`gostman-gui/app.go`); the folder menu offers new request, subfolder, run, share, rename, delete only (`CollectionTree.jsx`). Auth and scripts are per request.
- Idea: a folder settings tab with inherit-from-parent auth, shared headers and a pre-request script; request auth type "Inherit".
- Files: `app.go` and `workspace/types.go` (Folder fields, kept in the same order), `engine/` merge, `lib/execution.js`, `runner/`, `CollectionTree.jsx`, new folder settings component, `lib/docs/`.

### 5. Drag-and-drop reorder and move in the tree - impact M-H, effort M
- Bruno: drag requests and folders to reorder and move (known app behaviour; the docs pages fetched do not describe it, unconfirmed). Also copy/paste (Ctrl+C/V) and clone (Ctrl+D), rename (Ctrl+R) in the sidebar (https://docs.usebruno.com/get-started/configure/keybindings.md).
- Gostman: absent. No draggable code in `CollectionTree.jsx` or `Sidebar.jsx`; only "Move to folder" via context menu, "Duplicate" for requests. Folders cannot be duplicated or moved. Order within a folder cannot be changed.
- Files: `CollectionTree.jsx`, `lib/collectionTree.js`, `lib/workspaceActions.js`, `store/appStore.js`, a `sortOrder` field in `Request`/`Folder` (`app.go`, `workspace/types.go`).

### 6. Keyboard shortcuts: tab navigation, customization, sidebar - impact M, effort S-M
- Bruno: ~25 shortcuts (close tab, reopen closed tab Ctrl+Shift+T, Ctrl+1..9 tab jump, move tab, search sidebar Ctrl+F, change layout orientation Ctrl+J, zoom, preferences) and a Preferences > Keybindings page with rebinding and conflict detection (https://docs.usebruno.com/get-started/configure/keybindings.md). Global search is Ctrl+K.
- Gostman: four shortcuts only: Ctrl/Cmd K (palette), N, S, Enter (`Workspace.jsx` `shortcuts` map, `hooks/useShortcuts.js`). Close tab exists only as a palette command.
- Files: `hooks/useShortcuts.js` (needs shift and key-chord support), `Workspace.jsx`, `store/appStore.js` (closed-tab stack), `ui/CommandPalette.jsx` (show shortcut for every command).

### 7. Command palette as global search - impact M, effort S-M
- Bruno: Ctrl+K global search (keybindings page above); described as searching across the workspace, details unconfirmed.
- Gostman: a palette exists with 18 commands plus environment switching (`ui/CommandPalette.jsx`) but it does not search requests, folders or history, so it cannot jump to a request. Sidebar search covers name and URL separately (`CollectionTree.jsx`).
- Files: `ui/CommandPalette.jsx`, `lib/workspaceActions.js` (`runCommand`).

### 8. Response viewer: search, filter, syntax-highlighted editor view, layout toggle - impact H, effort M
- Bruno: Ctrl+F search inside the response, Editor and Preview views, a data-type selector, copy response, download, clear, save as example, and a Change Layout action (vertical or horizontal split) (https://docs.usebruno.com/send-requests/res-data-cookies/res-data.md). A response filter (JSONPath-style) exists in the app but is not confirmed in the fetched page.
- Gostman: Body has Pretty (collapsible JSON tree via `JsonView`), Raw (`<pre>`, truncated at a display limit) and Preview; Headers, Cookies, Tests tabs; copy and download; save example; drag-to-resize split with double-click reset (`ResponsePanel.jsx`). Absent: search in body, JSONPath/filter box, line numbers or Monaco read-only view for large raw bodies, side-by-side layout, clear response.
- Idea: add a filter input above the tree driven by the existing JSONPath code in `lib/chaining.js`, which already evaluates paths for extraction; add a "right of request" layout toggle.
- Files: `ResponsePanel.jsx`, `lib/layout.js`, `lib/chaining.js`, `lib/response.js`.

### 9. Timeline and network timing - impact M, effort M
- Bruno: Timeline tab with request, response and network-log sections (DNS, connect, SSL, transfer timing, protocol), lists extra requests made by scripts, filter All/Request/Pre-Request/Post-Response, Clear Timeline (https://docs.usebruno.com/debugging/timeline.md).
- Gostman: only total duration and size in `StatusSummary` (`ResponsePanel.jsx`). No sent-request view in the response (code generation shows the prepared request via `backend.prepare`), no timing breakdown, no redirect chain.
- Idea: add `httptrace` phase timings and the redirect hops to `engine.Response`, show the actual sent request and a timeline tab.
- Files: `engine/` (response and client), `app.go`, `api/proxy.go`, `ResponsePanel.jsx`, `lib/execution.js`.

### 10. Script console and inline script errors - impact M, effort M
- Bruno: Dev Tools with a Console tab (v2.8.0+); script failures also show as inline error cards in the response pane with source snippet, message and collapsible stack (https://docs.usebruno.com/debugging/dev-tools.md).
- Gostman: sandbox worker with `test()` and `expect()` (`lib/scripting/`); results in `TestResults.jsx`. No console panel, so `console.log` output has no visible home (not verified inside the worker; no Console component exists in `components/`).
- Files: `lib/scripting/sandbox.worker.js`, `sandbox.js`, `job.js`, `TestResults.jsx`, new console component, `runner/sandbox/bundle.js` regeneration (`npm run build:cli`).

### 11. Scripting API surface and additional script phases - impact M, effort M-L
- Bruno: `bru` API (variables at several scopes, `bru.sendRequest`, `bru.runRequest`, `bru.setNextRequest`), `req`/`res` objects with query helper, inbuilt and external libraries, JS files, dynamic variables, script flow doc (https://docs.usebruno.com/testing/script/javascript-reference.md, https://docs.usebruno.com/testing/script/inbuilt-libraries.md, https://docs.usebruno.com/testing/script/dynamic-variables.md, https://docs.usebruno.com/testing/script/request-chaining.md). Also data-driven testing (https://docs.usebruno.com/testing/automate-test/data-driven-testing.md).
- Gostman: `req`, `res`, `env.get/set`, `test`, Chai `expect` (README; `lib/scripting/subjects.js`). Sandbox forbids network by design, so there is no `sendRequest`. No dynamic variables like `{{$guid}}` (not found in `engine/` variable code by this review; verify), no data-driven runs (runner has delay and stop-on-failure only, `RunnerDialog.jsx`). Network isolation is a deliberate security choice; treat `sendRequest` as a trade-off, not a pure gap.
- Files: `lib/scripting/*`, `lib/runner.js`, `RunnerDialog.jsx`, `engine/` (dynamic variables), `runner/`.

### 12. Assertions UI breadth - impact L-M, effort S
- Bruno: Assert tab with expression, operator, value rows and about 30 operators (comparison, string, type, `in`, `between`, `length`, `matches`) (https://docs.usebruno.com/testing/tests/assertions.md).
- Gostman: already has an assertions list with `OPERATORS` in `lib/scripting/assertions.js` and a `res.body.x is a number` style. Compare the operator list against Bruno's (`matches`, `in`, `between`, `length`, `isEmpty`, `isDefined`) and fill gaps. Near parity; low priority.
- Files: `lib/scripting/assertions.js`, `TestsPanel.jsx`.

### 13. Theming and display preferences - impact M, effort M
- Bruno: Dark, Light or System plus several colour schemes, editor font, auto save, layout orientation (https://docs.usebruno.com/get-started/configure/settings.md).
- Gostman: dark only. `index.css` sets `color-scheme: dark`; Monaco theme is a hard-coded `gostman-dark` (`MonacoEditor.jsx`); no theme setting in `NetworkDialog.jsx`/`SettingsPanel.jsx` (that panel is per-request options). The README forbids glows and gradients but that is orthogonal.
- Idea: CSS variable palette for light and system modes, a matching Monaco theme, a "Preferences" dialog separate from network settings.
- Files: `index.css`, `tailwind.config.*`, `MonacoEditor.jsx`, `AppHeader.jsx`, `store/appStore.js` (`settings`).

### 14. Git integration UI - impact M, effort L
- Bruno: init repo, view diffs, pull, clone in the free tier; commit, push, branches, PRs, per-request history, conflict editor in paid tiers (https://docs.usebruno.com/git-integration/using-gui/intro.md).
- Gostman: files-on-disk only, with "Reload from disk" after a manual `git pull` (README "Folders and Git"). No git status, no changed-request markers, no commit UI. Cheaper wins first: show changed-file badges per request by shelling out to `git status` in `gostman-gui/workspace.go`, and a diff viewer for a single request YAML.
- Files: new `gostman-gui/git.go`, `StorageMenu.jsx`, `CollectionTree.jsx`.

### 15. Auth types - impact M, effort M
- Bruno: Basic, Bearer, Digest, AWS Signature, NTLM, OAuth1, OAuth2 (several grants), Akamai EdgeGrid, client certificates (https://docs.usebruno.com/auth/overview.md).
- Gostman: Basic, Bearer, API key, OAuth2 (`AuthPanel.jsx`; client certs in network settings). Missing Digest, AWS SigV4, NTLM, OAuth1. AWS SigV4 and Digest are the most requested.
- Files: `AuthPanel.jsx`, `AuthInputs.jsx`, `engine/` auth, `docs/` generator.

### 16. Import breadth - impact M, effort M
- Bruno: Postman, Insomnia, OpenAPI, WSDL, plus OpenAPI sync and export to OpenAPI; Postman export organiser and a script translator for Postman scripts (https://docs.usebruno.com/get-started/import-export-data/import-collections.md, https://docs.usebruno.com/open-api/openapi-sync.md, https://docs.usebruno.com/get-started/import-export-data/script-translator.md).
- Gostman: Postman v2.1, OpenAPI 3, Gostman exports and share links (`ImportTab.jsx`); export to Postman, OpenAPI, Markdown, backup. Missing: Insomnia, HAR, Bruno `.bru`/OpenCollection, Postman environment files (verify), Postman script translation.
- Files: `lib/importExport.js`, `ImportTab.jsx`, `ExportTab.jsx`.

### 17. Request tabs: preview tabs, reorder, context menu, reopen - impact M, effort S-M
- Bruno: preview (single-click) tabs that are replaced, tab reorder via drag, reopen last closed (Ctrl+Shift+T), close all, move tab left/right (keybindings page). Preview-tab behaviour is from app UX, not in the fetched docs (unconfirmed).
- Gostman: tabs with dirty dot and close button (`TabBar.jsx`); no drag reorder, no right-click menu, no close others/all, no preview mode. Auto-saves open tab drafts (`useAutoSave`, `lib/tabReconcile.js`).
- Files: `TabBar.jsx`, `store/appStore.js`, `ui/ContextMenu.jsx`.

### 18. Response examples and request docs - impact L, effort S-M
- Bruno: save a response as an example under the request, examples used by mocks, and a Docs tab per request/folder/collection in Markdown (https://docs.usebruno.com/send-requests/res-data-cookies/response-examples.md, https://docs.usebruno.com/api-docs/request-docs.md).
- Gostman: examples exist (`ExamplesDialog.jsx`) and requests have a `description` field edited in `SettingsPanel.jsx`, but it is plain text inside the Settings tab, with no folder or collection docs and no Markdown rendering. Gostman's HTML docs export is stronger than Bruno's per-item docs for publishing.
- Files: `SettingsPanel.jsx`, `RequestTabs.jsx`, `lib/docs/`.

### 19. Request-level extras - impact L-M, effort M each
- SSE streaming view (https://docs.usebruno.com/send-requests/REST/sse.md); GraphQL query builder (https://docs.usebruno.com/send-requests/graphql/query-builder.md); request-level path variables and per-request vars tab; prompt variables `{{?Prompt}}` (https://docs.usebruno.com/variables/prompt-variables.md); typed variables (string, number, boolean, object).
- Gostman: no SSE handling found in `components/` or `lib/`; GraphQL has schema browser, formatting and validation but no builder (`GraphQLPanel.jsx`); extraction rules are its chaining mechanism (`ExtractPanel.jsx`). Gostman's GraphQL schema browser covers most of the builder value.

### 20. Onboarding and empty states - impact M, effort S
- Bruno: Quick Start, create collection/workspace flows, Postman migration guide, sample public collections (https://docs.usebruno.com/introduction/quick-start.md). Workspaces group collections (https://docs.usebruno.com/get-started/bruno-basics/create-a-workspace.md).
- Gostman: has `ui/emptyState.jsx` and a landing page for the web build; I did not find a first-run sample collection or a guided "import from Postman" prompt in the desktop app. Multiple collections or workspaces: Gostman has a single collection tree plus recent folders (`StorageMenu.jsx`).
- Files: `Workspace.jsx`, `Sidebar.jsx`, `ui/emptyState.jsx`, `lib/mockData.js`.

### 21. Performance with large collections - impact unknown, effort S to measure
- Bruno: no documented claim; it is Electron with a file watcher and has known slowness on very large collections. Not a place to copy.
- Gostman: the tree uses `ui/VirtualList.jsx`; the whole `folders` array and `requests` are persisted by a debounced `useAutoSave` (`Workspace.jsx` `usePersistence`), so large collections rewrite one document. Folder mode writes one YAML per request. There is a `docs/benchmarks` directory already. Recommend measuring a 5,000-request import before treating this as a gap.

## Top 8 by impact over effort

1. Variable highlighting, hover value and `{{` autocomplete (gap 1) - H / M
2. Secret environment variables (gap 2) - H / M
3. Response body search and JSONPath filter (gap 8) - H / M, reusing `lib/chaining.js`
4. Expanded shortcuts: tab jump, close, reopen closed tab, sidebar search (gap 6) - M / S
5. Command palette searching requests and history (gap 7) - M / S
6. Light/system theme with Monaco theme (gap 13) - M / M, high perceived polish
7. Drag-and-drop reorder and folder duplicate in the tree (gap 5) - M-H / M
8. Folder-level headers, auth and scripts with inheritance (gap 4) - H / L, largest payoff for real API suites but the biggest change (touches engine, workspace YAML, runner, CLI bundle)

Close runners-up: environment table editor with colours (gap 3), Timeline with phase timings (gap 9), script console (gap 10), tab context menu and reorder (gap 17).

## Caveats

- Several UX behaviours (variable highlighting, drag reorder, response filter, preview tabs) are known from using the app, not from the docs pages fetched; they are marked unconfirmed. Verify against the installed Bruno at `C:\Program Files\Bruno` before building.
- A few Gostman absences are based on grep and file listing (no match in components/lib), not a full read of every component.
- Nothing in D:\code\gostman other than this file was modified.
