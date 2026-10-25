# Coming from Bruno

Gostman reads Bruno collections in both of Bruno's formats, rewrites the common `bru.*` script calls to its own script API, and runs the result from the app or from a single `gostman` binary. `gostman run` also takes a Bruno folder as it is, so a CI job can try Gostman before anyone converts anything. This page covers moving a collection across, what changes on the way, and the `gostman run` flags that match `bru run`.

Gostman has no paid tier, no account and no licence key. CSV and JSON data files, parallel runs, secret managers, commit and push in the Git panel and any number of collections are in the free download. See [What is free in Gostman](free-features.md).

## Try it on the Bruno folder first

`gostman run`, `gostman send` and `gostman docs` read a Bruno collection folder directly: the folder with `bruno.json`, or the one with `opencollection.yml`. The collection is converted in memory on every run and nothing is written into the Bruno folder.

```bash
gostman run ./shop-bruno --env Local --reporter junit:report.xml
gostman send --workspace ./shop-bruno "Shop/Orders/List orders" --env Local
```

Script lines that need rewriting and settings that were left out are printed as warnings before the run. The collection's `.env` file is read too, so `{{process.env.NAME}}` works as in Bruno. Folder names start with the collection's name, as after an import: `--folder Shop/Orders`.

Secret variables have no value in the Bruno folder, so pass them the way you passed `--env-var` to `bru run`: `--var password=...`, or `--var-from-env password` to read the environment variable named `password`.

Nothing a run sets is written back: values from `bru.setVar`, `bru.setEnvVar` and post-response variables last for the run, and the Bruno folder is only read.

`gostman mcp` needs a Gostman workspace, so import the collection before you serve it to a coding agent.

## Import a collection

Gostman reads:

- a `.bru` collection: the folder with `bruno.json`, `collection.bru`, `folder.bru` files and `environments/`;
- an OpenCollection YAML collection, Bruno's default format since v3: the folder with `opencollection.yml`, or one bundled YAML file;
- a Bruno workspace folder with `workspace.yml`: its collections, and the environments in its own `environments/` folder as global environments;
- environments exported from Bruno as JSON, one per file or several in one file;
- a `.zip` of any of these folders.

1. Choose **Import** in the header, then **Choose folder** and pick the collection or workspace folder. You can also drop the folder or a `.zip` on the drop area.
2. Read the summary. It counts the requests, folders and environments, and lists what was left out, the script lines that need rewriting and the secret variables to fill in.
3. Choose **Import**. When the collection carries scripts or OAuth 2.0 settings, Gostman asks before keeping them.

From the command line, `gostman import` writes the collection as a folder of YAML files, one per request:

```bash
gostman import ./shop-bruno --out shop
gostman run shop --env Local
```

Warnings and skipped items are printed after the counts. Open the new folder in the desktop app with **Open folder**. Your Bruno files are only read, never changed.

Hidden paths, `node_modules` and the folders listed under `ignore` in `bruno.json` (or `extensions.bruno.ignore` in `opencollection.yml`) are left out. The rest of the rules for imports, such as never turning off TLS verification, are in [Import, export and specs](import-export-and-specs.md#what-imports-never-do).

## What comes across

Both formats carry the same things across.

| In Bruno | In Gostman |
| --- | --- |
| HTTP and GraphQL requests | Requests in the same folders and the same `seq` order, under a folder named after the collection |
| gRPC requests | gRPC requests with the method, metadata and message. Several messages of a client or bidirectional streaming method become one JSON array. The file in `protoPath` and the `.proto` files it imports are attached when they are inside the collection folder |
| WebSocket requests | WebSocket requests with the headers. Each message becomes a [saved message](protocols.md#saved-messages) with its name |
| Collection and folder headers, variables, auth, scripts and docs | [Folder settings](folder-settings.md) on the folder named after the collection and on each folder. Requests set to inherit auth stay on **Inherit**, and a folder set to **No auth** gives the requests below it that inherit **No auth** |
| Collection variables | Collection variables of the collection's folder, written by `gostman import` to its `folder.yaml` |
| Environments in `environments/` | Environments with the same names, colours and `extends`, kept with the collection's folder in the app, as in Bruno (see [Environments per collection](variables.md#environments-per-collection)); in a workspace folder they are the workspace's environments. Switched-off variables stay switched off. Secret variables come across marked secret with empty values, because Bruno keeps their values outside the files |
| External secrets of an environment (`vars:externalsecrets:<provider>`, or `externalSecrets` in YAML) | Secret variables without a value. An imported file never chooses which secrets a connection reads, so the app, `gostman import` and `gostman run` on a Bruno folder leave out the reference, and the summary names each variable with its Bruno provider and path. A key read as `{{auditToken.token}}` becomes its own variable named `auditToken.token`, listed with the key `token`, so it resolves once that variable points at the path and key. Add a connection under [Secret managers](secrets-and-network.md#secret-managers), then point each variable at it and its path with the key button |
| Global environments of a Bruno workspace | Global environments in the app. `gostman run` has no global scope, so `gostman import` adds their variables to the collection variables in `gostman.yaml`; a collection variable with the same name keeps its value |
| `assert` rows, or `runtime.assertions` in YAML | Assertion rows when Gostman judges them as Bruno does, such as `res.status: eq 200`, `res.body.name: contains ett` or `res.body.tags: isArray`. Any other row, including `notIn`, `between`, `isTruthy`, `isJson` and a value without an operator, becomes a test at the end of the post-response script that checks it Bruno's way, so `res.body.code: eq 200` still fails on `"200"` and `length` still fails on an object; the summary counts them, and a Bruno export writes them back as `assert` rows. A turned-off row that has to become a test is left out and listed |
| `vars:post-response`, or `set-variable` actions in YAML | Extraction rules: `res.body.data[0].id` becomes the JSONPath `$.data[0].id`, `res.headers['x-session']` and `res.getHeader(...)` read a header, `bru.cookies.get("sid")` reads a cookie, and `res.status` reads the status code. Each rule keeps its value as a session value, like Bruno's runtime variables, so it is never saved into an environment |
| `script:pre-request`, `script:post-response` and `tests` | Pre-request and post-response scripts, translated as described below |
| `docs` | The request or folder description |
| `tags` in `meta`, or `info.tags` in YAML | Request tags, for `gostman run --tags` and the tag filter of **Run requests** |
| Path parameters such as `/users/:id` | `/users/{{id}}` with `id` as a variable of the request, so the value stays editable. A value that is itself a variable, such as `{{userId}}`, is put into the URL |
| `settings`: `timeout` and `followRedirects` | The request's **Timeout** and **Follow redirects** options |
| `example` blocks, or `examples` in YAML | Examples with their name, status, headers and body, which the [mock server](workspaces-and-mock.md) serves. The first one is the default |
| JSON, text, XML, SPARQL, form and multipart bodies | The same body types, with the content type of multipart file fields. File bodies and file fields need the file picked again |
| Basic, Digest, Bearer, API key, NTLM, AWS Signature v4, OAuth 1.0 and Akamai EdgeGrid auth | The same auth types |
| OAuth 2.0 with the client credentials, password or authorization code grant | OAuth 2.0 with the same grant, PKCE, credentials placement and token header prefix. A token source of `id_token` switches on **Send the ID token instead of the access token**. Tokens are never imported, so sign in again |
| `{{process.env.NAME}}` and the collection's `.env` file | The same placeholder. `gostman run` on the Bruno folder reads its `.env`; after `gostman import`, copy `.env` next to `gostman.yaml` and keep it out of Git |

Listed in the summary and left out:

- Post-response variables that read anything other than the body, a header or the status.
- `maxRedirects` other than Bruno's default: Gostman follows up to 10 redirects or none.
- gRPC script hooks such as `before-call-start`, and gRPC requests whose `.proto` file is not inside the collection folder. Load the services through reflection instead.
- The OAuth 2.0 implicit grant, WSSE auth, and auth types Gostman does not have.

Not carried over, and not listed:

- `encodeUrl`, `omitHeaders` and the WebSocket `timeout` and `keepAliveInterval` settings. Gostman sends the URL as written, apart from spaces.
- WebSocket message types: every saved message is sent as text.
- OAuth 2.0 extra parameters, token placement in the query string and the automatic fetch and refresh settings.
- The AWS `profileName`. Fill in the keys, or read them from a secret manager.
- `bruno.json` settings for the proxy, client certificates, presets and scripts. Use **Network settings** in the desktop app, or `--proxy`, `--cacert` and `--client-cert` with `gostman run`.

## Scripts

`test()`, `expect()` (Chai), `req`, `res` and `bru` work in Gostman, so most scripts need no change, whether you import them or paste them into a request. `res("path")` queries (dotted paths, `[0]`, `..` deep search and `[?]` filters), `bru.cookies` and `bru.cookies.jar()`, and Bruno's `req` and `res` methods such as `req.setTimeout`, `req.getName`, `req.headerList` and `res.getSize` run as written. On import, the calls with a Gostman name are rewritten to it:

| Bruno | Gostman |
| --- | --- |
| `bru.getEnvVar`, `bru.hasEnvVar`, `bru.deleteEnvVar` | `env.get`, `env.has`, `env.unset` |
| `bru.setEnvVar(name, value, { persist: true })` | `env.set(name, value)`, which saves the value into the active environment |
| `bru.setEnvVar(name, value)` without `persist` | `env.session.set(name, value)`: a session value, kept in memory like Bruno's unsaved environment change |
| `bru.getProcessEnv("NAME")` | `env.get("process.env.NAME") ?? env.get("NAME")`: the collection's `.env` file, or a value passed with `--var-from-env NAME` |
| The same calls for `Var`, `CollectionVar` and `GlobalEnvVar` | The same calls on `env.session` (session values, never saved, like Bruno's runtime variables), `env.collection` (collection variables) and `env.globals` (the global environment) |
| `bru.getFolderVar`, `bru.getRequestVar` | `env.get`, which returns the value the request would use |
| `bru.getAllEnvVars`, `bru.getAllVars`, `bru.getAllCollectionVars`, `bru.getAllGlobalEnvVars` and the `deleteAll` versions | `all()` and `clear()` on the matching object |
| `bru.setNextRequest`, `bru.runner.setNextRequest` | `setNextRequest` |
| `bru.runner.skipRequest`, `bru.runner.stopExecution` | `skipRequest`, `stopExecution` |
| `bru.runner.iterationData.get(name)`, `.has(name)` | `env.get(name)`, `env.has(name)`: the columns of a data row are variables |
| `bru.sleep(ms)` | A promise that resolves after `ms` milliseconds |
| `bru.sendRequest(options, callback)` | `sendRequest`, with Bruno's `data` option sent as the body and `data` kept on the response next to `body` |
| `bru.runRequest("Folder/Name")` | `sendRequest("Name")` for the request at that path in the collection. When two requests share the name, the call names the request by its id instead |
| `res.getStatusText()`, `res.getUrl()` | `res.statusText`, `res.url` |
| `bru.interpolate(text)` | `env.interpolate(text)` |

`sendRequest` and `bru.cookies.jar()` reach only localhost and the hosts that requests in the collection already use.

A name your script declares that Gostman scripts have and Bruno's do not, such as `env`, `utils` or `sendRequest`, gets a number added, `env1` for example, everywhere the script uses it, so the rewritten calls still reach Gostman's own. A name counts as declared only where JavaScript sees it, such as inside the function whose parameter it is or the block that declares it with `let` or `const`: `function read(res) { ... }` keeps its own `res` inside, and `res`, `req` and `bru` outside it still mean Bruno's.

Calls with no equivalent are kept as written and listed in the summary with their line, so you can rewrite them before running:

- `bru.cwd`, `bru.getCollectionName`, `bru.getSecretVar`, the OAuth 2.0 credential calls, `bru.getTestResults` and `bru.getAssertionResults`.
- `req.setMaxRedirects`, `req.onFail`, `req.getAuthMode`, `req.getTags`, `req.getPathParams`, `req.getExecutionMode` and `req.disableParsingResponseJson`.
- `require` of anything other than the bundled `lodash`, `crypto-js`, `uuid`, `moment`, `dayjs`, `ajv` and `chai`. In a trusted folder on the desktop, `./` and `../` files inside the folder also load.

Values set with `bru.setVar`, `bru.setEnvVar` without `persist`, and post-response variables, are session values: they stay in memory and are never written to an environment or its file, so a token a login request sets is not committed to Git. Only `bru.setEnvVar` with `{ persist: true }` saves the value into the active environment, in a folder workspace into its YAML file.

Gostman sends a JSON body exactly as written, while Bruno parses it and sends it without spaces. `req.getBody()` returns the parsed body in both, so a signing script that hashes `JSON.stringify(req.getBody())` signs different bytes from the ones Gostman sends. The import summary points out each script that does this. Change the one line to hash the text Gostman sends:

```js
const payload = bru.interpolate(req.getBody({ raw: true }));
```

For the iteration number, read `env.get("iteration")` (from 1) and `env.get("iterationCount")`, which `gostman run --data` and `--iterations` set.

Scripts run in an isolated worker with no network access of their own and stop after the time limit set on the Script tab of [Settings for all collections](folder-settings.md) (**Collection settings** in a folder workspace): 10 seconds unless you change it, up to 120. There is no equivalent of Bruno's developer mode. The full script API is in [Scripts and checks](scripting-and-settings.md#script-api).

## From bru run to gostman run

`gostman run` takes the Bruno folder, the folder that `gostman import` wrote, or a Gostman export. It runs every request, including those in nested folders, so there is no `-r`. It exits 0 when everything passed, 1 when a check failed, 2 when the command or input is wrong and 3 when a request got no response.

| `bru run` | `gostman run` |
| --- | --- |
| `bru run orders -r` | `gostman run shop --folder Orders`, with a folder name or a path such as `Shop/Orders`. Every folder sits under one named after the collection |
| `--env Local` | `--env Local` |
| `--env-var key=value` | `--var key=value`, or `--var-from-env NAME` to read the value from the process environment |
| `--csv-file-path users.csv`, `--json-file-path users.json` | `--data users.csv` or `--data users.json` |
| `--iteration-count 5` | `--iterations 5` |
| `--parallel` | `--parallel 4`, with the number of requests at once. Requests sent together do not see each other's extracted values, as with Bruno |
| `--delay 200` | `--delay 200` |
| `--bail` | `--bail` |
| `--insecure` | `--insecure` |
| `--secrets-env-file secrets.env` | `--secrets-env-file secrets.env`, or `--secrets` to use the process environment |
| `--reporter-junit report.xml --reporter-html report.html` | `--reporter junit:report.xml --reporter html:report.html`, also `json` and `text`, repeatable |
| `--tags smoke --exclude-tags slow` | `--tags smoke --exclude-tags slow` |
| `--cacert ca.pem` | `--cacert ca.pem`, added to the system certificates |
| `--client-cert-config certs.json` | `--client-cert cert.pem --client-key key.pem`, or `--client-cert api.example.com=cert.pem,key.pem` for one host |
| `--noproxy` | No flag needed: without `--proxy`, set `NO_PROXY=*` to skip the proxy in `HTTPS_PROXY` and `HTTP_PROXY`. `--noproxy host,list` lists hosts that skip `--proxy url` |

`--env-file` differs: in Bruno it names an environment file, and in Gostman it reads `KEY=value` lines as variables. Import the environment instead.

`--tests-only`, `--sandbox`, `--global-env`, `--ignore-truststore`, `--disable-cookies` and the `--reporter-skip-*` flags have no `gostman run` flag. Requests can also be picked by name, id or path with `--only "Shop/Orders/List orders"`. Every other flag is in [Command line](cli.md).

The `gostman` binary has nothing else to install, so CI needs no Node.js. The GitHub Action and the `ghcr.io/kunalgoesbyken/gostman` image are described in [Gostman in CI](ci.md).

## Working with the collection afterwards

- **Git.** The imported folder is plain YAML, one file per request, and diffs read well in a pull request. The desktop app has a Git panel with commit, push, branches, stash and conflict resolution. See [Collections and Git](collections-and-git.md).
- **Teammates without Git.** Send a folder as an encrypted link or file from the **Share** tab. It is encrypted in your window and never uploaded. See [Sharing and documentation](sharing-and-docs.md).
- **Back to Bruno.** `gostman export shop --format bruno --out shop-bruno`, or the **Bruno** format in the **Export** tab of the app, writes `.bru` files again. When everything sits in one top-level folder, as after an import, that folder becomes the collection: its name goes into `bruno.json` and its settings into `collection.bru`. Folder headers, auth, variables, scripts and docs go into each `folder.bru`, and requests that inherit auth keep `auth: inherit`. Scripts keep the code you wrote: Bruno already has `req`, `res`, `test` and `expect`, and when a script uses `env`, `utils`, `sendRequest` or a run-order call, a few lines at the top define it with `bru.*`, so `env.set` becomes a call to `bru.setEnvVar` there without your code changing. A script that calls `pm.*` or `insomnia.*`, which Gostman runs but Bruno does not, is translated to Bruno's API, so `pm.test("ok", () => pm.expect(pm.response.code).to.eql(200))` becomes `test("ok", () => expect(res.status).to.eql(200))`. `env.get`, `env.interpolate` and the address and body of a request a script sends also read the current row of a data file passed to `bru run` with `--csv-file-path` or `--json-file-path`. `sendRequest("Log in")` finds the request by its path from the collection root, such as `auth/Log in`, which `bru.runRequest` needs. An assertion row stays in the `assert` block only when Bruno is known to judge it the same way for any response, such as `res.status: eq 200`, `res.body.name: eq Kettle`, `res.status: lt 300`, `res.body.name: contains ett` or `res.body.tags: isArray`. Any other row becomes a test: an **equals** or **is one of** row such as `eq 200` on a body field (Bruno also compares the type, Gostman compares `200` and `"200"` as the same), a comparison on anything but `res.status` and `res.responseTime`, **has length** (Bruno does not count the keys of an object), **is empty** (Bruno fails it on a missing value), **is not empty** (Bruno fails it on a number), **starts with**, **ends with** and **does not contain** (Bruno fails them on values that are not text), and **does not equal**, **is defined** and **is undefined** below the top of the body, where Bruno stops at a missing parent. [Scripts and checks in Postman, Bruno and Insomnia](import-export-and-specs.md#scripts-and-checks-in-postman-bruno-and-insomnia) lists every case. Those tests compare as Gostman does and go, like the rest and folder and collection rows, in the `tests` block; importing the folder back gives the rows back. Extract rules become `vars:post-response` that read a JSON body path, a header, a cookie or the status; a rule that writes to the environment becomes a `bru.setEnvVar` line at the top of the post-response script. Bruno lists folders before requests, so a request you placed above a folder runs after it in Bruno, and the export summary names those requests. The export summary also lists anything Bruno cannot run, such as `visualize`, a `pm.*` call with no translation such as `pm.cookies.jar()`, a `sendRequest` name that matches no request, or an Extract rule that searches with `$..`, and importing the folder back removes the added lines and gives the extract rules back. See [Scripts and checks in Postman, Bruno and Insomnia](import-export-and-specs.md#scripts-and-checks-in-postman-bruno-and-insomnia).

## What Bruno has that Gostman does not

- A VS Code extension. Gostman has the desktop app, the web app and the command line.
- A redirect limit per request, and per-request switches for URL encoding and omitted headers.
- A larger community and a longer history. Gostman is a smaller project; report problems on [GitHub](https://github.com/kunalgoesbyken/gostman/issues).
