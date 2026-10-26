# About the project

Gostman is open source under the MIT licence, built in public on GitHub since 2025. This page says who maintains it, how releases work, what happens to your collections if development stops, and where to report a problem.

## Who maintains Gostman

Gostman is written and maintained by one developer, the owner of the [kunalgoesbyken/gostman](https://github.com/kunalgoesbyken/gostman) repository. The code, the issue tracker and every release are public, and translations come from volunteers on [Weblate](translating.md). There is no paid plan, so nothing pushes features behind an account; see [What is free in Gostman](free-features.md).

## Releases

Every release is published on [GitHub Releases](https://github.com/kunalgoesbyken/gostman/releases) with installers for Windows, macOS and Linux, the `gostman` command line and release notes. The web version at gostman.com is updated with each push, so it is always current.

The desktop app never updates itself. Switch on **Check for new versions** under **Preferences**, **Privacy** to see a new release in the status bar; see [Privacy](preferences-and-shortcuts.md#privacy). Before a new version first touches your data, Gostman makes a backup you can restore under **Preferences**, **Data**; see [Backups](preferences-and-shortcuts.md#backups).

## If Gostman stops being developed

Your collections do not depend on the project carrying on:

- **They are plain files.** A folder workspace is one YAML file per request, readable in any editor and kept in your own Git repository. App storage is one JSON file on desktop. See [Where your data is kept](getting-started.md#where-your-data-is-kept).
- **They export to other tools.** Export a collection to Postman (with scripts and checks adapted to run there), Bruno, OpenAPI, HAR, `.http` files or Markdown. See [Exporting](import-export-and-specs.md#exporting).
- **The installed app keeps working.** The desktop app and the command line need no account, no licence server and no Gostman server. Only the web version is served from gostman.com, so keep the desktop app or an export if you rely on it.
- **Anyone can carry it on.** The MIT licence lets anyone fork the code, build it and publish their own releases.

## Reporting a problem

- **Bugs and feature requests:** open an issue on [GitHub](https://github.com/kunalgoesbyken/gostman/issues). Open issues show what is being discussed and worked on.
- **Security vulnerabilities:** do not open a public issue. Report them privately as described in the [security policy](https://github.com/kunalgoesbyken/gostman/security/policy).
- **Translations:** see [Translating Gostman](translating.md).

## What Gostman connects to

The desktop app, the web app and the command line send nothing to the project: no analytics, no telemetry and no crash reports. Only the home page at gostman.com counts visits, without cookies. The full list of the hosts each version talks to, and when, is in [What Gostman connects to](getting-started.md#what-gostman-connects-to).
