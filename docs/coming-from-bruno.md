# Coming from Bruno

Gostman reads Bruno collections, rewrites the common `bru.*` script calls to its own script API, and runs the result from the app or from a single `gostman` binary. This page covers moving a collection across, what changes on the way, and the `gostman run` flags that match `bru run`.

Gostman has no paid tier, no account and no licence key. CSV and JSON data files, parallel runs, secret managers, commit and push in the Git panel and any number of collections are in the free download. See [What is free in Gostman](free-features.md).

## Import a collection

Gostman reads both Bruno formats: the `.bru` files of a folder with a `bruno.json`, and the YAML layout with an `opencollection.yml` at the top. It also reads a `.zip` of either folder and a single exported collection file.

1. Choose **Import** in the header, then **Choose folder** and pick the collection folder. You can also drop the folder or a `.zip` on the drop area.
2. Read the summary. It counts the requests, folders and environments, and lists the script lines that need rewriting.
3. Choose **Import**. When the collection carries scripts or OAuth 2.0 settings, Gostman asks before keeping them.

From the command line, `gostman import` writes the collection as a folder of YAML files, one per request:

```bash
gostman import ./shop-bruno --out shop
gostman run shop --env Local
```

Warnings and skipped items are printed after the counts. Open the new folder in the desktop app with **Open folder**. Your `.bru` files are only read, never changed.

Hidden paths, `node_modules` and the folders listed under `ignore` in `bruno.json` are left out. The rest of the rules for imports, such as never turning off TLS verification, are in [Import, export and specs](import-export-and-specs.md#what-imports-never-do).

## What comes across

| In Bruno | In Gostman |
| --- | --- |
| HTTP and GraphQL requests | Requests in the same folders and the same `seq` order |
| Collection and folder headers, variables, auth and scripts | Copied into each request below them, so every request is complete on its own |
| Environments in `environments/` | Environments with the same names. Secret variables come across with empty values: fill them in and mark them **Secret** |
| `assert` rows | Assertion rows with the same operators, such as `eq`, `contains`, `isNumber` and `matches` |
| `vars:post-response` that read `res.body` | Extraction rules with a JSONPath, for example `res.body[0].id` becomes `$[0].id` (`.bru` files only) |
| `script:pre-request`, `script:post-response` and `tests` | Pre-request and post-response scripts, translated as described below |
| `docs` | The request description |
| Path parameters such as `:id` | Filled into the URL |
| JSON, text, XML, form and multipart bodies | The same body types. File bodies and file fields need the file picked again |
| Basic, Digest, Bearer, API key and NTLM auth | The same auth types |
| AWS Signature v4 and OAuth 2.0 auth | The same auth types, from `.bru` files. OAuth 2.0 tokens are never imported, so sign in again |

Not imported, and listed in the summary where it applies:

- gRPC and WebSocket requests. Create them again in Gostman, see [Protocols](protocols.md).
- Assertions with an operator Gostman does not have, and `vars:post-response` rows that read anything other than `res.body`.
- Auth types not in the table above.
- Tags. Select requests by name or path with `--only` instead.

## Scripts

`test()`, `expect()` (Chai), `req` and `res` have the same names in Gostman, so most test code needs no change. The `req` getters and setters (`getUrl`, `setUrl`, `getMethod`, `setMethod`, `getHeader`, `setHeader`, `getHeaders`, `setHeaders`, `getBody`, `setBody`) and the `res` getters (`getStatus`, `getHeader`, `getHeaders`, `getBody`, `getResponseTime`) work as they are. The importer rewrites the rest:

| Bruno | Gostman |
| --- | --- |
| `bru.getEnvVar`, `bru.setEnvVar`, `bru.hasEnvVar`, `bru.deleteEnvVar` | `env.get`, `env.set`, `env.has`, `env.unset` |
| The same calls for `Var`, `GlobalEnvVar` and `CollectionVar`, and `bru.getFolderVar`, `bru.getRequestVar` | `env.get`, `env.set`, `env.has`, `env.unset`. Every scope maps to the active environment, and the summary says so |
| `bru.getAllEnvVars`, `bru.getAllVars`, `bru.getAllGlobalEnvVars` | `env.all()` |
| `bru.setNextRequest`, `bru.runner.setNextRequest` | `setNextRequest` |
| `bru.runner.skipRequest`, `bru.runner.stopExecution` | `skipRequest`, `stopExecution` |
| `bru.runner.iterationData.get(name)`, `.has(name)` | `env.get(name)`, `env.has(name)`: the columns of a data row are variables |
| `bru.sleep(ms)` | A promise that resolves after `ms` milliseconds |
| `bru.sendRequest(options, callback)` | `sendRequest`, with Bruno's `data` option sent as the body and `data` kept on the response next to `body` |
| `bru.runRequest("Folder/Name")` | `sendRequest("Name")`, the saved request with that name |
| `res.getStatusText()`, `res.getUrl()` | `res.statusText`, `res.url` |

`sendRequest` reaches only the hosts that requests in the collection already use.

Calls with no equivalent are kept as written and listed in the summary with their line, so you can rewrite them before running:

- `res("path")` queries. Read the value from `res.body` instead, for example `res.body.order.total`.
- `bru.getProcessEnv("NAME")`. Pass the value with `--var-from-env NAME` and read it with `env.get("NAME")`.
- `bru.interpolate`, `bru.cookies` and any other `bru.*` call not in the table.
- `require` of anything other than the bundled `lodash`, `crypto-js`, `uuid`, `moment`, `dayjs`, `ajv` and `chai`. In a trusted folder on the desktop, `./` and `../` files inside the folder also load.

Scripts run in an isolated worker with no network access of their own and stop after 10 seconds. There is no equivalent of Bruno's developer mode. The full script API is in [Variables, scripts and settings](scripting-and-settings.md#script-api).

## From bru run to gostman run

`gostman run` takes the folder that `gostman import` wrote, not the Bruno folder. It runs every request, including those in nested folders, so there is no `-r`. It exits 0 when everything passed, 1 when a request or check failed and 2 when the command or input is wrong.

| `bru run` | `gostman run` |
| --- | --- |
| `bru run orders -r` | `gostman run shop --folder Orders`, with a folder name or a path such as `Shop/Orders`. The import puts every folder under one named after the collection |
| `--env Local` | `--env Local` |
| `--env-var key=value` | `--var key=value`, or `--var-from-env NAME` to read the value from the process environment |
| `--csv-file-path users.csv`, `--json-file-path users.json` | `--data users.csv` or `--data users.json` |
| `--iteration-count 5` | `--iterations 5` |
| `--parallel` | `--parallel 4`, with the number of runs at once |
| `--delay 200` | `--delay 200` |
| `--bail` | `--bail` |
| `--insecure` | `--insecure` |
| `--secrets-env-file secrets.env` | `--secrets-env-file secrets.env`, or `--secrets` to use the process environment |
| `--reporter-junit report.xml` | `--reporter junit --output report.xml`, also `json` and `html`. One report file per run |
| `--tags smoke` | `--only "List orders"` or `--only "Shop/Orders/List orders"`, by name, id or path, repeatable |

`--env-file` differs: in Bruno it names an environment file, and in Gostman it reads `KEY=value` lines as variables. Import the environment instead.

`--tests-only`, `--sandbox`, `--cacert`, `--client-cert-config`, `--ignore-truststore`, `--noproxy` and `--disable-cookies` have no `gostman run` flag. Every other flag is in [Command line](cli.md).

The `gostman` binary has nothing else to install, so CI needs no Node.js. The GitHub Action and the Dockerfile are described in [Gostman in CI](ci.md).

## Working with the collection afterwards

- **Git.** The imported folder is plain YAML, one file per request, and diffs read well in a pull request. The desktop app has a Git panel with commit, push, branches, stash and conflict resolution. See [Collections and Git](collections-and-git.md).
- **Teammates without Git.** Send a folder as an encrypted link or file from the **Share** tab. It is encrypted in your window and never uploaded. See [Sharing and documentation](sharing-and-docs.md).
- **Back to Bruno.** `gostman export shop --format bruno --out shop-bruno` writes `.bru` files again.

## What Bruno has that Gostman does not

- A VS Code extension. Gostman has the desktop app, the web app and the command line.
- Tags on requests.
- A larger community and a longer history. Gostman is a smaller project; report problems on [GitHub](https://github.com/kunalgoesbyken/gostman/issues).
