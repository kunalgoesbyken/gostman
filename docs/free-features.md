# What is free in Gostman

Gostman has no paid tier, no account and no licence key, so every feature in these docs is in the download. This page lists the features that Postman, Bruno and Insomnia document under paid plans and shows where Gostman covers each one.

## What the download includes

- **Data-driven runs:** run a collection once per row of a CSV or JSON file, in the app or with `gostman run --data`. See [Command line](cli.md) and [Runner, load testing and secret scanning](runner-load-and-scan.md).
- **Parallel runs and reports:** run requests side by side and write text, JSON, JUnit or HTML reports. See [Gostman in CI](ci.md).
- **Secret managers:** read values from HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, Google Cloud Secret Manager, KeePassXC, 1Password, Bitwarden or Bitwarden Secrets Manager at send time. See [Secrets and network](secrets-and-network.md).
- **Git in the app:** diff, commit, push, branches, stash and conflict resolution in the desktop app. See [Collections and Git](collections-and-git.md).
- **Mock server:** serve saved examples or an OpenAPI spec locally, with rules, delays and a live request log. See [Folders, mock server and capture](workspaces-and-mock.md).
- **Command line for CI:** `gostman run` exits non-zero when a request or a check fails, and a GitHub Action and a Docker image are available. See [Gostman in CI](ci.md).
- **Load testing and secret scanning:** `gostman load` and `gostman scan` ship in the same binary. See [Command line](cli.md).
- **OpenAPI tools:** import, sync with a remote spec, view it, lint it and check responses against it. See [Import, export and specs](import-export-and-specs.md).
- **MCP server testing:** tools, resources and prompts in collections and CI runs, an OAuth sign-in that shows each discovery step, tool definition checks and warnings when a server's tools change. See [MCP servers](protocols.md#mcp-servers).
- **An MCP server for coding agents,** with secret redaction and a host allowlist. See [Use from a coding agent](agents.md).
- **Collections as plain YAML files** you can commit next to your code, with no account needed to open them. See [Folders, mock server and capture](workspaces-and-mock.md).

## What Gostman does not include

Gostman has no accounts, so it has no hosted collaboration, single sign-on or cloud monitors. Teams share a collection through Git or an encrypted link. See [Sharing and documentation](sharing-and-docs.md). The builds are not code-signed yet.

## How the comparison was made

The rows for Postman, Bruno and Insomnia come from their public pricing and documentation pages, read in October 2026. Plans change, so check the current [Postman pricing](https://www.postman.com/pricing/), [Bruno pricing](https://www.usebruno.com/pricing) and [Insomnia pricing](https://insomnia.rest/pricing) before you decide. Moving a collection over is covered in [Coming from Postman](coming-from-postman.md), [Coming from Bruno](coming-from-bruno.md) and [Coming from Insomnia](coming-from-insomnia.md).

## Compare feature by feature

The table is built from the same data as the comparison on the landing page, so it appears on [gostman.com/docs/free-features](https://gostman.com/docs/free-features#compare-feature-by-feature) but not in this file on GitHub.
