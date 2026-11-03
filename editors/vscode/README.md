# Gostman for VS Code

Send requests, run collections and check their results from the editor. The extension calls the Gostman command line, so a request or a run in VS Code gives the same result as the app, a run in CI and the MCP server.

## Requirements

Install the Gostman CLI and put `gostman` on the PATH, or set `gostman.path` to the full path. Downloads: https://github.com/kunalgoesbyken/gostman/releases

The collection is the workspace folder that holds `gostman.yaml`. With several folders open, the Testing view, the status bar item and the commands use the first one that has it; the Send lens works in any of them. A collection in a subfolder of a workspace folder is not found, and the extension does not run in virtual workspaces.

## Send from the file

Open a request file of the collection. A **Send** lens above the first line runs `gostman send --json <id>` and shows the status, time, size, checks, body and response headers in a panel beside the editor. The panel is plain HTML with no scripts and a strict content security policy. Secret values stay redacted as `{{name}}`; the extension never passes `--reveal`. An unsaved file is saved first. The panel also lists placeholders that had no value, secrets Gostman did not fill in, skipped requests, script logs and the CLI's warnings, so a literal `{{token}}` from a wrong or missing environment is explained. Bodies are shown as received.

## Test Explorer

The folders and requests of the collection appear in the Testing view. Run everything, a folder or a request: the extension runs `gostman run . --reporter json --redact` with `--folder` or `--only` and marks each request passed or failed. A failed request shows the failed checks, or the error, as its message.

## Environment

The status bar shows the environment passed as `--env`. Select it, or run **Gostman: Select environment**, to choose one of the files in the collection's `environments` folder. The choice is stored in the `gostman.environment` workspace setting, which is `.vscode/settings.json` in a single folder, so add that file to `.gitignore` if the choice should stay personal. The setting is used by Run collection, Run a folder, Send a saved request, Run a flow, the Send lens and the Test Explorer; Scan, Lint, Create a collection and Open the documentation do not take an environment. The status bar item shows a warning when the stored name is not one of the collection's environments.

## Commands

Open the Command Palette and type `Gostman`.

| Command | Runs |
| --- | --- |
| Run collection | `gostman run .` |
| Run a folder of the collection | `gostman run . --folder <name>` |
| Send a saved request | `gostman send --workspace . <request>` |
| Send this request | `gostman send --json <id>`, also the Send lens |
| Select environment | sets `--env` for the commands that take one |
| Run a flow | `gostman flow run <name> --workspace .` |
| Lint an OpenAPI spec | `gostman lint <file>`, also in the Explorer context menu |
| Scan the collection for leaked secrets | `gostman scan .` |
| Create a collection in this folder | `gostman init .` |

The commands that are not the lens or the Testing view show their output in the Gostman terminal.

## Settings

- `gostman.path`: command that starts the CLI.
- `gostman.environment`: environment name passed as `--env`; empty uses the first environment of the collection.

## Trust

Running a collection sends requests and runs its scripts, so the extension is off in untrusted workspaces.

## Translating

The text uses VS Code's own localisation. English is the source and the only language so far. To add one, create `package.nls.<locale>.json` (a copy of `package.nls.json`) and `l10n/bundle.l10n.<locale>.json` (a copy of `l10n/bundle.l10n.json`) with the values translated and the keys, `{0}` placeholders and command names kept. The locale is VS Code's display language, such as `de`, `fr`, `pt-br` or `zh-cn`. Request a language, or report a translation, on https://github.com/kunalgoesbyken/gostman/issues/15. After adding a message, run `npm run l10n:export` to refresh `l10n/bundle.l10n.json`.

Documentation: https://gostman.com/docs
