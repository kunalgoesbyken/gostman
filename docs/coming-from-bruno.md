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
| Collection variables | Collection variables. With `gostman import` they are written to `gostman.yaml` |
| Environments in `environments/` | Environments with the same names, colours and `extends`. Switched-off variables stay switched off. Secret variables come across marked secret with empty values, because Bruno keeps their values outside the files |
| External secrets of an environment (`vars:externalsecrets:<provider>`, or `externalSecrets` in YAML) | With `gostman import` and `gostman run`, variables that read from a [secret manager](secrets-and-network.md#secret-managers): each one refers to a connection named after the Bruno provider, such as `hashicorp-vault-server`, so add a connection with that name and check the paths. The app's import leaves them as empty variables, because an imported file never chooses which secrets a connection reads; point them at a connection with the key button |
| Global environments of a Bruno workspace | Global environments in the app. `gostman import` writes them as environments, because a workspace folder has no global scope |
| `assert` rows, or `runtime.assertions` in YAML | Assertion rows with the same operators, such as `eq`, `contains`, `isNumber` and `matches` |
| `vars:post-response`, or `set-variable` actions in YAML | Extraction rules: `res.body.data[0].id` becomes the JSONPath `$.data[0].id`, `res.headers['x-session']` and `res.getHeader(...)` read a header, and `res.status` reads the status code. Each rule keeps its value as a session value, like Bruno's runtime variables, so it is never saved into an environment |
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

- Assertions with an operator Gostman does not have, such as `notIn`, `between`, `isTruthy` and `isJson`, and post-response variables that read anything other than the body, a header or the status.
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
| `bru.getEnvVar`, `bru.setEnvVar`, `bru.hasEnvVar`, `bru.deleteEnvVar` | `env.get`, `env.set`, `env.has`, `env.unset` |
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
| `bru.getProcessEnv("NAME")` | `env.get("NAME")`. Pass the value with `--var-from-env NAME` |

`sendRequest` and `bru.cookies.jar()` reach only localhost and the hosts that requests in the collection already use.

Calls with no equivalent are kept as written and listed in the summary with their line, so you can rewrite them before running:

- `bru.cwd`, `bru.getCollectionName`, `bru.getSecretVar`, the OAuth 2.0 credential calls, `bru.getTestResults` and `bru.getAssertionResults`.
- `req.setMaxRedirects`, `req.onFail`, `req.getAuthMode`, `req.getTags`, `req.getPathParams`, `req.getExecutionMode` and `req.disableParsingResponseJson`.
- `require` of anything other than the bundled `lodash`, `crypto-js`, `uuid`, `moment`, `dayjs`, `ajv` and `chai`. In a trusted folder on the desktop, `./` and `../` files inside the folder also load.

Values set with `bru.setVar`, and post-response variables, are session values: they stay in memory and are never written to an environment or its file. `bru.setEnvVar` becomes `env.set`, which saves the value into the active environment, in a folder workspace into its YAML file, whether or not the Bruno call passed `{ persist: true }`. Bruno keeps such a value in memory unless `persist` is set, so change `bru.setEnvVar` to `bru.setVar` for tokens and other values that should not be saved.

For the iteration number, read `env.get("iteration")` (from 1) and `env.get("iterationCount")`, which `gostman run --data` and `--iterations` set.

Scripts run in an isolated worker with no network access of their own and stop after the time limit set on the Script tab of the [collection settings](folder-settings.md): 10 seconds unless you change it, up to 120. There is no equivalent of Bruno's developer mode. The full script API is in [Variables, scripts and settings](scripting-and-settings.md#script-api).

## From bru run to gostman run

`gostman run` takes the Bruno folder, the folder that `gostman import` wrote, or a Gostman export. It runs every request, including those in nested folders, so there is no `-r`. It exits 0 when everything passed, 1 when a check failed, 2 when the command or input is wrong and 3 when a request got no response.

| `bru run` | `gostman run` |
| --- | --- |
| `bru run orders -r` | `gostman run shop --folder Orders`, with a folder name or a path such as `Shop/Orders`. Every folder sits under one named after the collection |
| `--env Local` | `--env Local` |
| `--env-var key=value` | `--var key=value`, or `--var-from-env NAME` to read the value from the process environment |
| `--csv-file-path users.csv`, `--json-file-path users.json` | `--data users.csv` or `--data users.json` |
| `--iteration-count 5` | `--iterations 5` |
| `--parallel` | `--parallel 4`, with the number of runs at once. With one iteration the requests run side by side and do not see each other's extracted values, as with Bruno |
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
- **Back to Bruno.** `gostman export shop --format bruno --out shop-bruno` writes `.bru` files again.

## What Bruno has that Gostman does not

- A VS Code extension. Gostman has the desktop app, the web app and the command line.
- A redirect limit per request, and per-request switches for URL encoding and omitted headers.
- A larger community and a longer history. Gostman is a smaller project; report problems on [GitHub](https://github.com/kunalgoesbyken/gostman/issues).
