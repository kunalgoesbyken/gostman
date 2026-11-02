# Gostman for VS Code

Run Gostman collections from the editor. The extension calls the Gostman command line, so a run in VS Code gives the same result as a run in CI.

## Requirements

Install the Gostman CLI and put `gostman` on the PATH, or set `gostman.path` to the full path. Downloads: https://github.com/kunalgoesbyken/gostman/releases

## Commands

Open the Command Palette and type `Gostman`.

| Command | Runs |
| --- | --- |
| Run collection | `gostman run .` |
| Run a folder of the collection | `gostman run . --folder <name>` |
| Send a saved request | `gostman send --workspace . <request>` |
| Run a flow | `gostman flow run <name> --workspace .` |
| Lint an OpenAPI spec | `gostman lint <file>`, also in the Explorer context menu |
| Scan the collection for leaked secrets | `gostman scan .` |
| Create a collection in this folder | `gostman init .` |

Output appears in the Gostman terminal.

## Settings

- `gostman.path`: command that starts the CLI.
- `gostman.environment`: environment name passed as `--env`.

## Trust

Running a collection sends requests and runs its scripts, so the extension is off in untrusted workspaces.

Documentation: https://gostman.com/docs
