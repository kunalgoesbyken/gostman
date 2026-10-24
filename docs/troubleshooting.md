# Troubleshooting

Problems people run into most often, with the reason and the fix. If yours is not here, [open an issue](https://github.com/kunalgoesbyken/gostman/issues) with the steps, what you expected and what happened.

## Installing

**Windows shows "Windows protected your PC".** The builds are not code-signed yet. Choose **More info**, then **Run anyway**.

**macOS says the app cannot be opened.** Right-click Gostman in Applications, choose **Open**, then confirm. For the command line, run `xattr -d com.apple.quarantine gostman` once.

**The Linux app does not start.** The `.tar.gz` build needs GTK 3 and WebKitGTK 4.1 from your distribution's packages. The `.deb` installs them for you, and the AppImage carries its own.

## Sending requests

**The web app cannot reach `localhost` or a private address.** The web version sends requests through a hosted proxy, which is not allowed to reach your machine or your network. Run `gostman relay` and choose **Local relay on this computer** under **Preferences**, **Privacy** (see [Local relay for the web app](cli.md#local-relay-for-the-web-app)), or use the [desktop app](getting-started.md#install-the-desktop-app) or the command line.

**"The local relay did not answer."** The web app is set to send through a relay on your computer and nothing answered at its address. Start `gostman relay` with the port you entered, check the address under **Preferences**, **Privacy** and press **Test**, or switch back to **Hosted relay**. If the browser asked whether the page may reach apps on this device, allow it.

**A `{{name}}` is sent as written.** No variable with that name is defined in a scope the request sees. In the editor the name is orange when it is missing and green when it is defined. Check that the right environment is picked in the header and that the name matches exactly; names are case-sensitive. See [Variables](variables.md).

**Could not connect, or the host could not be found.** The response panel says which: nothing answered at that host and port, or the name did not resolve. Check that the server is running, the port is right and the address has no typo. On the desktop app a `localhost` address reaches your own machine; a request that goes through a proxy needs the proxy address under **Network**.

**A certificate error on an internal API.** Add your company's CA certificate in the desktop network settings (**Network**, at the bottom left of the window). Switching off verification per request is possible under **Settings** but sends the request without checking who answers. On the command line, pass the CA file with `--cacert`, or `--insecure` to skip verification; the error names these flags. See [Secrets and network settings](secrets-and-network.md).

**The server ended the TLS handshake.** The server often does this when it requires a client certificate and none was sent. Add one for that host in the desktop network settings, pass `--client-cert` on the command line, or start `gostman relay` with `--client-cert` for the web app. When a certificate is already set for the host, check that the server accepts it. gRPC requests get the same hints.

**The command line says a private key is protected by a passphrase.** An encrypted PEM key or a PFX file needs its passphrase. Put it in an environment variable and pass the variable's name, for example `CERT_PASS=... gostman send --client-cert client.p12 --client-cert-pass-env CERT_PASS GET https://api.example.com`. The same flag opens the certificates in a workspace's `gostman.yaml`. See [Proxies and certificates](ci.md#proxies-and-certificates).

**An OAuth 2.0 token is not sent after switching environments.** A token belongs to the environment that was active when it was fetched. The Auth tab says so, a client credentials or password token is fetched again for the new environment, and for the authorization code and device code grants you choose **Get token** again. See [Auth](requests-and-responses.md#auth).

**The response is cut off.** The web app keeps up to 3 MB of a response, and the desktop app and the CLI keep up to 50 MB. The response panel shows a notice when a response was cut off, and what is shown and saved is only the first part.

**A large response is shown as plain text.** Bodies over 500,000 characters skip the tree and the colours so the window stays responsive. For JSON, press **Format anyway** above the body; it formats in the background. Search and the JSONPath filter work on the whole body.

**A file is too large to attach in the web app.** The web app sends files up to 3 MB, because its hosted proxy accepts requests of at most 4.5 MB. A larger request answers with a message saying so. The desktop app reads attachments from disk while it sends, up to 1 GB per request.

**"Changes could not be saved" or "There is no room left in this browser's storage".** The web app keeps your collection and your open tabs in the browser's IndexedDB, which can use the space the browser allows for the site. The message says how much Gostman uses and how much the browser allows; if Gostman uses far less than that, the disk itself is nearly full. Free up disk space, make the body smaller or delete requests you no longer need, and export your data to keep a copy. In a browser without IndexedDB, as in some private windows, the data is in local storage, which holds only about 5 MB. The desktop app saves the collection to a file, but keeps open tabs in its window's storage, which also holds only a few megabytes: save a very large body to the collection and close its tab.

**A request works in another tool but not in Gostman.** Press **Code** and copy the request as cURL to see exactly what Gostman sends, including inherited headers and auth, then compare.

## Chaining and variables

**An extraction rule does not set its variable.** The **Extract** tab shows why for each rule after a response, for example that nothing in the body matches the JSONPath. Paths start at `$`: `$.data.token` for an object, `$[0].id` for the first item of a list.

**The next request still uses the old value.** Values are written to the active environment when the response arrives. In a run, requests go in the order of the sidebar, so the request that extracts a value has to come before the one that uses it.

**A secret variable is empty after cloning a collection.** Secret values are kept in the operating system keychain, not in the folder, so they stay on the computer where they were typed. Enter them again, or pass them to the command line with `--var-from-env`.

## Tests and runs

**A run passes although the API returned an error.** A `4xx` or `5xx` status is not a failure by itself. Add the assertion `res.status equals 200` (or the status you expect) to the request, or once to the collection settings.

**`gostman run` exits with 2.** The command or its input is wrong: a path that does not exist, an unknown flag, an environment name that is not in the collection or a data file that cannot be read. The message on stderr names the problem.

**A missing secret does not fail the run.** An undefined variable is left as `{{name}}` and the request is still sent. Add a script check such as `expect(env.get("API_TOKEN")).to.be.a("string")`; the [CI tutorial](tutorial-ci.md#3-make-a-missing-secret-fail-the-run) shows it.

**"The script ran for more than 10 seconds and was stopped."** Scripts have a time limit, 10 seconds unless the collection sets another. A script that waits on slow `sendRequest` calls or loops over a large body can need more: raise **Time limit** on the **Script** tab of the collection settings, up to 120 seconds. The response panel shows **Script failed** and the request is not sent when a pre-request script stops.

**Scripts, OAuth 2.0 or a local MCP server do nothing in a folder I opened.** A folder you did not create opens restricted, and its scripts, OAuth 2.0 settings, local MCP commands and file reads are switched off until you trust it. Open the storage menu in the header and choose **Trust this folder**. Read the scripts first: they run when a request is sent and can read your variables.

**An MCP server answers 401 Unauthorized.** Select **Sign in** on the MCP tab. Gostman walks through the server's OAuth discovery step by step and stops at the first step that fails, with the requests it made and what the specification expects there. Common causes are a `resource` in the protected resource metadata that does not match the server URL, an `issuer` that differs from its address by a trailing slash, and an identity provider without dynamic client registration; for the last one, register a client yourself and enter its client ID on the Auth tab. See [Sign in with OAuth](protocols.md#sign-in-with-oauth).

**A tool call passes its status check but the run marks it failed.** The tool returned `isError: true`. Tool errors keep the HTTP status 200 and count as failed calls; assert `res.body.isError` is false to see the check in the results. See [MCP results](protocols.md#result).

**An imported Postman or Bruno script fails.** Common `pm.*` and `bru.*` calls are rewritten on import, but not every Postman or Bruno API exists in Gostman. The import summary lists what was left out. See [Variables, scripts and settings](scripting-and-settings.md) for the script API.

**A secret manager reference fails on the command line.** References are read only when the run allows it with `--secrets` or `--secrets-env-file`. See [Command line](cli.md).

## Data

**Where is my data?** On the desktop, in the app data folder, or as YAML files in the folder you opened. On the web, in the browser's IndexedDB, with preferences in its local storage, so clearing site data deletes it. Export a **Gostman** backup first; see [Import, export and OpenAPI specs](import-export-and-specs.md).

**Requests disappeared after an update or a mistake.** Open **Preferences**, **Data**, **Backups** and restore a copy from before it happened. The current data is copied first, so the restore can be undone. See [Backups](preferences-and-shortcuts.md#backups).

**"Changes could not be saved" on the web.** The browser has no room left for this site; the message shows how much Gostman uses of what the browser allows. Export a **Gostman** backup, then free up disk space or remove what you no longer need, or use the desktop app, which saves to a file. Some private windows offer only local storage, about 5 MB, so use a normal window for a large collection.

**"This browser's database, where your Gostman data is kept, could not be opened".** The web app moved your data into the browser's IndexedDB earlier, and the browser now refuses to open it, for example because a site-data setting changed or another Gostman tab holds it. Nothing was changed. Close other Gostman tabs or restart the browser, then press **Try again**.

**Two people changed the same request in Git.** Each request is its own file, so conflicts are rare and limited to that request. The Git panel lists conflicts first; resolve them, and the folder reloads by itself once the files are saved. **Reload from disk** lists any file that still cannot be read. See [Collections and Git](collections-and-git.md).
