# Troubleshooting

Problems people run into most often, with the reason and the fix. If yours is not here, [open an issue](https://github.com/kunalgoesbyken/gostman/issues) with the steps, what you expected and what happened.

## Installing

**Windows shows "Windows protected your PC".** The builds are not code-signed yet. Choose **More info**, then **Run anyway**.

**macOS says the app cannot be opened.** Right-click Gostman in Applications, choose **Open**, then confirm. For the command line, run `xattr -d com.apple.quarantine gostman` once.

**The Linux app does not start.** The `.tar.gz` build needs GTK 3 and WebKitGTK 4.1 from your distribution's packages. The `.deb` installs them for you, and the AppImage carries its own.

## Sending requests

**The web app cannot reach `localhost` or a private address.** The web version sends requests through a hosted proxy, which is not allowed to reach your machine or your network. Use the [desktop app](getting-started.md#install-the-desktop-app) or the command line for local and internal APIs.

**A `{{name}}` is sent as written.** No variable with that name is defined in a scope the request sees. In the editor the name is orange when it is missing and green when it is defined. Check that the right environment is picked in the header and that the name matches exactly; names are case-sensitive. See [Variables](variables.md).

**Could not connect, or the host could not be found.** The response panel says which: nothing answered at that host and port, or the name did not resolve. Check that the server is running, the port is right and the address has no typo. On the desktop app a `localhost` address reaches your own machine; a request that goes through a proxy needs the proxy address under **Network**.

**A certificate error on an internal API.** Add your company's CA certificate in the desktop network settings (**Network**, at the bottom left of the window). Switching off verification per request is possible under **Settings** but sends the request without checking who answers. See [Secrets and network settings](secrets-and-network.md).

**The response is cut off in the web app.** The web version reads up to 3 MB of a response. The desktop app reads up to 50 MB.

**A request works in another tool but not in Gostman.** Press **Code** and copy the request as cURL to see exactly what Gostman sends, including inherited headers and auth, then compare.

## Chaining and variables

**An extraction rule does not set its variable.** The **Extract** tab shows why for each rule after a response, for example that nothing in the body matches the JSONPath. Paths start at `$`: `$.data.token` for an object, `$[0].id` for the first item of a list.

**The next request still uses the old value.** Values are written to the active environment when the response arrives. In a run, requests go in the order of the sidebar, so the request that extracts a value has to come before the one that uses it.

**A secret variable is empty after cloning a collection.** Secret values are kept in the operating system keychain, not in the folder, so they stay on the computer where they were typed. Enter them again, or pass them to the command line with `--var-from-env`.

## Tests and runs

**A run passes although the API returned an error.** A `4xx` or `5xx` status is not a failure by itself. Add the assertion `res.status equals 200` (or the status you expect) to the request, or once to the collection settings.

**`gostman run` exits with 2.** The command or its input is wrong: a path that does not exist, an unknown flag, an environment name that is not in the collection or a data file that cannot be read. The message on stderr names the problem.

**A missing secret does not fail the run.** An undefined variable is left as `{{name}}` and the request is still sent. Add a script check such as `expect(env.get("API_TOKEN")).to.be.a("string")`; the [CI tutorial](tutorial-ci.md#3-make-a-missing-secret-fail-the-run) shows it.

**Scripts, OAuth 2.0 or a local MCP server do nothing in a folder I opened.** A folder you did not create opens restricted, and its scripts, OAuth 2.0 settings and local MCP commands are switched off until you trust it. Open the storage menu in the header and choose **Trust this folder**. Read the scripts first: they run when a request is sent and can read your variables.

**An imported Postman script fails.** Common `pm.*` calls are rewritten on import, but not every Postman API exists in Gostman. The import summary lists what was left out. See [Variables, scripts and settings](scripting-and-settings.md) for the script API.

**A secret manager reference fails on the command line.** References are read only when the run allows it with `--secrets` or `--secrets-env-file`. See [Command line](cli.md).

## Data

**Where is my data?** On the desktop, in the app data folder, or as YAML files in the folder you opened. On the web, in the browser's local storage, so clearing site data deletes it. Export a **Gostman** backup first; see [Import, export and OpenAPI specs](import-export-and-specs.md).

**Two people changed the same request in Git.** Each request is its own file, so conflicts are rare and limited to that request. The Git panel lists conflicts first; resolve them, then choose **Reload from disk**. See [Collections and Git](collections-and-git.md).
