# Changelog

## 0.3.0

- Every collection in the workspace is found: each folder with `gostman.yaml` at the root of a workspace folder or up to four folders below it, in every folder of a multi-root workspace. Hidden folders, `node_modules`, `bower_components`, `vendor` and `__pycache__` are skipped. This includes the `gostman` folder that `gostman init` and Create a collection make in a folder that already holds files, which 0.2.0 did not find. Collections created, moved or deleted while VS Code is open are picked up.
- With several collections, the Testing view shows one item per collection; a run that covers several runs the CLI once per collection, in its folder.
- The Send lens and Send this request use the collection the file is in, at any depth.
- The environment is chosen per collection and kept in VS Code's workspace storage, so it no longer lands in `.vscode/settings.json`. `gostman.environment` is the default for collections with no choice. The status bar shows the environment of the active editor's collection.
- Run collection, Run a folder, Send a saved request, Run a flow and Scan use the active editor's collection, or ask which one; their terminal is named after it and starts in its folder. Create a collection asks for the workspace folder when there are several.
- When `gostman.path` is left at `gostman` and the CLI is not on the PATH, the extension also looks in `GOBIN`, `GOPATH/bin` and `~/go/bin`, and on macOS and Linux in `/opt/homebrew/bin`, `/usr/local/bin` and `~/.local/bin`.
- An error starting a terminal task is shown instead of being dropped.
- Checked in VS Code 1.145 with `@vscode/test-electron`: activation, the Send lens and panel, the Testing view, the environment picker, the terminal commands and finding the CLI.

## 0.2.0

- A Send lens above each request file of the collection shows the status, time, size, checks, body and headers in a panel, with the placeholders that had no value, withheld secrets and warnings. Secret values stay redacted.
- The collection's folders and requests appear in the Test Explorer. Run all, a folder or a request; failed checks become the failure message.
- A status bar item and the Select environment command choose the environment passed as `--env`, read from the collection's environment files, with a warning when the stored name does not exist. Run collection, Run a folder, Send a saved request, Run a flow, the lens and the Test Explorer use it; Scan, Lint and Create a collection do not. `gostman.environment` stores the choice.
- The text of the extension uses VS Code's localisation (`package.nls.json` and `l10n/bundle.l10n.json`); English is the only language so far.
- The collection is the workspace folder that has `gostman.yaml`. The extension does not run in virtual workspaces.

## 0.1.0

- Commands to run a collection, a folder or a flow, send a saved request, lint an OpenAPI spec, scan for secrets and create a collection.
- Settings for the CLI path and the environment.
