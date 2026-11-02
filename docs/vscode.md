# VS Code extension

The Gostman extension runs collections from the editor. It calls the Gostman command line, so a run in VS Code gives the same result as a run in CI. Install it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Gostman.gostman). Its source is in [`editors/vscode`](https://github.com/kunalgoesbyken/gostman/tree/main/editors/vscode).

## Install

1. Install the Gostman CLI and put `gostman` on the PATH, or set `gostman.path` to its full path. Downloads are on the [releases page](https://github.com/kunalgoesbyken/gostman/releases); see [Command line](cli.md).
2. Install the extension from the Marketplace, or run `ext install Gostman.gostman` in the Quick Open box (`Ctrl+P`).

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

## See also

- [Gostman in CI](ci.md): the same runs in a pipeline.
- [Use from a coding agent](agents.md): the MCP server.
