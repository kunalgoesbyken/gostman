# Gostman documentation

Gostman is an API client for REST, GraphQL, gRPC and WebSocket that you, your CI pipeline and your coding agent share. These pages cover the desktop app, the web app and the command line, and every feature in them is included in the free download.

![Gostman sending a POST request with a JSON body and showing the pretty-printed response](../gostman-gui/frontend/src/assets/landing/rest.webp)

## Start

- [Getting started](getting-started.md): open Gostman in the browser, install the desktop app or the command line, and send a first request.
- [What is free in Gostman](free-features.md): the features Postman, Bruno and Insomnia list under paid plans, and where Gostman covers each one.
- [Coming from Postman](coming-from-postman.md): import Postman collections, environments and globals, what happens to `pm.*` scripts, and the `gostman run` flags that match `newman run`.
- [Coming from Bruno](coming-from-bruno.md): import a Bruno collection, what happens to its scripts, and the `gostman run` flags that match `bru run`.
- [Coming from Insomnia](coming-from-insomnia.md): import an Insomnia export and what happens to its environments, template tags and scripts.
- [Tutorial: test an API](tutorial-first-collection.md): build a collection with variables, chained requests and checks, then run it from the app and the command line.
- [Tutorial: run your API tests in CI](tutorial-ci.md): run the collection on every pull request with secrets kept out of the files.

## Requests

- [Requests and responses](requests-and-responses.md): the request editor, every body and auth type, and the response viewer.
- [Protocols](protocols.md): REST, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, Server-Sent Events, SOAP and MCP servers.

## Variables and secrets

- [Variables](variables.md): scopes, secrets and dynamic values.
- [Secrets and network settings](secrets-and-network.md): secret variables, secret managers, proxy and certificates.

## Testing and automation

- [Scripts and checks](scripting-and-settings.md): checks, scripts, network settings and the OAuth 2.0 callback.
- [Running, load testing and scanning](runner-load-and-scan.md): the in-app runner and the dialogs for load tests and scans.
- [Flows](flows.md): chain requests with retries, other paths on failure, conditions and loops, drawn in the app and run from the command line.
- [Gostman in CI](ci.md): exit codes, reports, recipes for GitHub Actions, GitLab CI and Jenkins, and a run against the mock server.

## Collections and Git

- [Collections, tabs and Git](collections-and-git.md): the sidebar, tabs, storage and the Git panel.
- [Folder and collection settings](folder-settings.md): headers, auth, variables and scripts shared by a folder.
- [Folders, mock server and capture](workspaces-and-mock.md): collections as files, saved examples and recorded traffic.
- [Import, export and OpenAPI specs](import-export-and-specs.md): supported formats, OpenAPI tools and Open in Gostman links.
- [Sharing and documentation](sharing-and-docs.md): encrypted share links and generated HTML documentation.

## Agents and AI

- [Use from a coding agent](agents.md): the MCP server for Claude Code, Codex and Cursor.
- [AI features](ai.md): the optional assistant, which uses your own key.

## Reference

- [Command line](cli.md): `run`, `flow`, `send`, `load`, `mock`, `capture`, `docs`, `relay`, `scan`, `lint`, `init`, `import` and `export`.
- [Preferences, shortcuts and the command palette](preferences-and-shortcuts.md): the command palette, preferences and keyboard shortcuts.

## Help

- [Guides by task](guides.md): migrate from Postman, mock a backend, record traffic, load test, publish docs and more.
- [Troubleshooting](troubleshooting.md): common problems and their fixes.
- [Example collections](../examples/README.md): ready-to-run workspaces you can open or run.
