# Changelog

## 0.2.0

- A Send lens above each request file of the collection shows the status, time, size, checks, body and headers in a panel, with the placeholders that had no value, withheld secrets and warnings. Secret values stay redacted.
- The collection's folders and requests appear in the Test Explorer. Run all, a folder or a request; failed checks become the failure message.
- A status bar item and the Select environment command choose the environment passed as `--env`, read from the collection's environment files, with a warning when the stored name does not exist. Run collection, Run a folder, Send a saved request, Run a flow, the lens and the Test Explorer use it; Scan, Lint and Create a collection do not. `gostman.environment` stores the choice.
- The text of the extension uses VS Code's localisation (`package.nls.json` and `l10n/bundle.l10n.json`); English is the only language so far.
- The collection is the workspace folder that has `gostman.yaml`. The extension does not run in virtual workspaces.

## 0.1.0

- Commands to run a collection, a folder or a flow, send a saved request, lint an OpenAPI spec, scan for secrets and create a collection.
- Settings for the CLI path and the environment.
