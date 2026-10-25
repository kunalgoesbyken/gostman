# Coming from Insomnia

Gostman reads Insomnia exports in both formats, turns Insomnia's template tags into Gostman variables, rewrites the common `insomnia.*` script calls to its own script API, and runs the result from the app or from a single `gostman` binary. This page covers exporting from Insomnia, what changes on the way, and how to run the collection in CI.

Gostman has no paid tier, no account and no licence key. Git in the app, secret managers, collection runs, mock servers and any number of users are in the free download. See [What is free in Gostman](free-features.md).

## Export from Insomnia

Gostman reads both export formats:

- **Insomnia v4**, a JSON (or YAML) file with `"__export_format": 4` and a `resources` list, which older versions of Insomnia export.
- **Insomnia v5**, a YAML file with `type: collection.insomnia.rest/5.0`, or `spec.`, `environment.`, `mock.` or `mcpClient.` in place of `collection.`. Current versions of Insomnia export it, and Git Sync keeps the same files in the repository.

To export one collection, open its menu in the project view and choose **Export**, then the format. To export everything, open **Preferences**, **Data** and export the data of the project. A file from either path works, and so does a `.zip` or folder of several files.

## Import

1. In Gostman, choose **Import** in the header and drop the file, or choose **Choose files**.
2. Read the summary. It counts the requests, folders and environments, and lists the template tags, script lines and settings that need a look.
3. Choose **Import**. When the collection carries scripts, OAuth 2.0 settings or file tags, Gostman asks before keeping them.

From the command line, `gostman import` writes a folder of YAML files that `gostman run` and the desktop app read:

```bash
gostman import Insomnia_2026-10-24.yaml --out store
gostman run store --env Local
```

`gostman run` does not read Insomnia files directly; import them once. The values of secret rows and of private environments are not written to the folder, so pass them to the run with `--var password=...` or `--var-from-env password`. The rules every import follows, such as never turning off TLS verification and never carrying tokens, are in [Import, export and specs](import-export-and-specs.md#what-imports-never-do).

## What comes across

| In Insomnia | In Gostman |
| --- | --- |
| Collections (v4 workspaces) | A folder named after the collection, with the same tree and order |
| Folders: headers, auth, environment, scripts and description | [Folder settings](folder-settings.md). A folder's environment becomes folder variables. Requests set to inherit auth stay on **Inherit** |
| HTTP and GraphQL requests | The same requests, with query parameters, headers, body, auth and description |
| Path parameters such as `/users/:id` | `/users/{{id}}` with `id` as a variable of the request, so the value stays editable. A value that is itself a variable is put into the URL |
| gRPC requests | gRPC requests with the method, metadata and message. In v4 exports the `.proto` file and the other files of its proto folder are attached; v5 exports do not carry them, so add them in the gRPC tab or use server reflection |
| WebSocket requests and their saved payloads | WebSocket requests, with each payload as a [saved message](protocols.md#saved-messages) |
| Socket.IO requests and their saved payloads | WebSocket requests with the Socket.IO protocol and the request's custom path, if it has one. Each payload becomes a saved message with its event and first argument |
| MCP client requests | MCP requests. A stdio client becomes a `stdio:` command whose environment rows become its headers, which Gostman passes to the command as its environment |
| Base environment and sub environments | The base environment's variables become the collection's collection variables, which apply under whichever environment is active, as the base environment does in Insomnia; values that are private or confidential are marked secret, and switched-off values stay switched off. The sub environments become environments with their names and colours. In the app they belong to the collection's folder, so another collection's environments do not mix with them (see [Environments per collection](variables.md#environments-per-collection)). An Insomnia global environment, which has no collection, stays an environment |
| Secret rows, private environments and vault secrets | Variables marked secret. Vault secrets (`{{ _.vault.name }}`, the **Secret** rows of a private environment) come across as empty secret variables named `vault.name`, because Insomnia exports them encrypted or masked. JSON rows are split into dotted variables, so `{{ _.limits.page }}` keeps working |
| Global environment files (`environment.insomnia.rest/5.0`, or a v4 workspace of the environment kind) | Global environments in the app. `gostman run` has no global scope, so `gostman import` adds their variables to the collection variables in `gostman.yaml`; a collection variable with the same name keeps its value |
| Unit test suites | A `test()` block in the post-response script of the request each test targets, named after the suite and the test |
| Mock servers and their routes | A folder of requests with one saved example each, which the [mock server](workspaces-and-mock.md) serves |
| Design documents (`spec.insomnia.rest/5.0`, or a v4 `api_spec`) | The collection and tests as above, with the spec kept in the description of the collection's folder. A design document without requests gets requests generated from its spec |
| `pre-request` and `after-response` scripts | Pre-request and post-response scripts, translated as described below |
| Basic, Digest, Bearer, API key, NTLM, AWS IAM, OAuth 1.0, Hawk and ASAP auth | The same auth types. A bearer token with a prefix other than `Bearer` becomes an `Authorization` header |
| OAuth 2.0 with the client credentials, password or authorization code grant | OAuth 2.0 with the same grant, PKCE, credentials placement, `resource` and token prefix. Tokens are never imported, so sign in again |
| Follow redirects switched off | The request's **Follow redirects** option switched off |
| Send cookies or store cookies switched off | The request's **Send cookies from the cookie jar** or **Store cookies the response sets** option switched off |

## Template tags

Tags with a Gostman equivalent are replaced when the collection is imported. The rest are kept as written and listed in the summary by name, with the requests that use them.

| Insomnia tag | In Gostman |
| --- | --- |
| `{{ _.name }}`, `{{ name }}`, `{{ _['my-name'] }}` | `{{name}}`, `{{my-name}}` |
| `{% uuid 'v4' %}`, `{% uuid 'v1' %}` | `{{$uuid}}` (Insomnia also returns a v4 UUID for both) |
| `{% now 'iso-8601' %}`, `'millis'` or `'ms'`, `'unix'` or `'seconds'` | `{{$isoTimestamp}}`, `{{$timestampMs}}`, `{{$timestamp}}` |
| `{% faker 'randomFullName' %}` and the other faker names | `{{$randomFullName}}`: Insomnia's faker names are Postman's dynamic variable names, which Gostman generates too |
| `{% prompt 'Title', 'Label', 'Default', ... %}` | `{{?Label}}`, a [prompt variable](variables.md#prompt-variables) that asks when the request is sent. A default value becomes a request variable named after the label, which fills in the dialog and is what `gostman run` sends |
| `{% file '/path/data.txt' %}` | `{{$file(/path/data.txt)}}`. Files are read only inside the workspace folder, so copy the file there and fix the path. See [Reading files](variables.md#reading-files) |
| `{% base64 'encode', 'normal', 'text' %}`, `'decode'`, `'url'` | The encoded or decoded text, computed once on import, when the value is plain text |
| `{% hash 'sha256', 'hex', 'text' %}`, also `md5`, `sha1`, `sha512` and `base64` output | The hash, computed once on import, when the value is plain text |
| `{% response 'body', 'req_…', '$.token' %}` | `{{Login_token}}`, filled by an [extraction rule](variables.md#setting-variables-from-a-response) added to the request it reads, which keeps the value as a session value. Send that request first: Insomnia could send it for you, Gostman does not |
| `{% response 'header', 'req_…', 'Location' %}` | `{{Login_Location}}`, from an extraction rule on the header |

Kept as text and listed: `{% now 'custom', ... %}`, `base64` and `hash` of a value that holds variables, `response` reading the raw body, the URL or an XPath, `cookie`, `request`, `os`, `jsonpath`, `vault` and plugin tags, and Liquid filters such as `{{ name | upcase }}`.

## Scripts

`insomnia.*` scripts are translated with the same rules as Postman's `pm.*` scripts, with `insomnia` in place of `pm`:

| Insomnia | Gostman |
| --- | --- |
| `insomnia.test`, `insomnia.expect` | `test`, `expect` |
| `insomnia.environment`, `insomnia.variables`, `insomnia.collectionVariables`, `insomnia.baseEnvironment` and `insomnia.globals` with `.get`, `.set`, `.has`, `.unset` | The same calls on `env` (the active environment), `env.session` (session values, never saved), `env.collection` (collection variables, for both `collectionVariables` and `baseEnvironment`) and `env.globals` (the global environment). `insomnia.variables.get`, `.has` and `.toObject` become `env.get`, `env.has` and `env.all()`, which read every scope |
| `.toObject()`, `.clear()`, `.replaceIn(text)` on those scopes | `all()`, `clear()` and `interpolate(text)` on the matching object |
| `insomnia.iterationData.get`, `.has` | `env.get`, `env.has`: the columns of a data row are variables |
| `insomnia.info.iteration`, `insomnia.info.iterationCount`, `insomnia.info.requestName` | The `iteration` variable less one, `iterationCount`, `req.name` |
| `insomnia.cookies.get`, `has` and the other list methods | The same methods on `bru.cookies` |
| `insomnia.request.method`, `insomnia.request.url`, `insomnia.request.headers.get(name)` | `req.method`, `req.url`, `req.getHeader(name)` |
| `insomnia.response.json()`, `insomnia.response.text()` | `res.body`, and the body as text |
| `insomnia.response.code`, `status`, `responseTime`, `headers` | `res.status`, `res.statusText`, `res.responseTime`, `res.headers` |
| `insomnia.response.to.have.status(code)` and the other `to.be` and `to.have` checks | The same expectations as for Postman, see [Coming from Postman](coming-from-postman.md#scripts) |
| `insomnia.sendRequest(request, callback)` | `await sendRequest(request)`, with the callback called as before |
| `insomnia.execution.setNextRequest`, `insomnia.execution.skipRequest` | `setNextRequest`, `skipRequest` |
| `insomnia.send()` in a unit test | The response of the request the test belongs to, with Insomnia's `status`, `statusMessage`, `data`, `headers` and `responseTime` |
| `insomnia.send('req_…')` in a unit test | `sendRequest` with that request |

`sendRequest` reaches only localhost and the hosts that requests in the collection already use. Insomnia's `setNextRequest` also takes a request id, which is copied as written; replace it with the request's name.

A name your script declares that Gostman scripts already have, such as `const res = insomnia.response.json()` or a helper `function test(name, fn)`, gets a number added, `res1` or `test1`, everywhere the script uses it, so the rewritten calls still reach Gostman's `res` and `test`. A name counts as declared only where JavaScript sees it, such as inside the function whose parameter it is or the block that declares it with `let` or `const`: `function pick(insomnia) { ... }` keeps its own `insomnia` inside, and the `insomnia.*` calls outside it are still rewritten.

Kept as written and listed in the summary with their line, so you can rewrite them before running: `insomnia.vault`, `insomnia.parentFolders`, `insomnia.cookies.jar()`, `insomnia.test.skip`, `insomnia.info.eventName`, the request editing calls such as `insomnia.request.addQueryParams`, and `require` of modules Gostman does not bundle, such as `cheerio`, `xml2js` and `csv-parse`. Gostman bundles `lodash`, `crypto-js`, `uuid`, `moment`, `dayjs`, `ajv` and `chai`.

Scripts run in an isolated worker with no network access of their own and stop after the time limit set on the Script tab of [Settings for all collections](folder-settings.md) (**Collection settings** in a folder workspace): 10 seconds unless you change it, up to 120. The script API is in [Scripts and checks](scripting-and-settings.md#script-api).

## What does not come across

Listed in the summary:

- Template tags without an equivalent, as above.
- The OAuth 2.0 implicit grant and the `audience` parameter, and the `netrc` auth type.
- gRPC requests that load their services from a Buf schema registry.
- Socket.IO payloads with more than one argument: Gostman sends the first.
- Unit tests that target no request.
- The cookie jar. Gostman keeps cookies on your computer and sets them from responses.
- CA certificate paths of v5 files. Add them under **Network settings**, or pass `--cacert` to `gostman run`.
- A design document that points to a spec file instead of carrying the spec.

Not carried over, and not listed: the URL encoding and body rendering switches of a request, Socket.IO event listeners (Gostman shows every event), and plugin data.

## Running in CI

Import the collection once and commit the folder. These `gostman run` flags match Inso's:

| Inso | `gostman run` |
| --- | --- |
| `inso run collection "Store" --env Local` | `gostman run store --env Local` |
| `inso run test "Smoke"` | `gostman run store`: the unit tests are part of the requests they target |
| `--iteration-data users.csv`, `--iteration-count 5` | `--data users.csv`, `--iterations 5` |
| `--delay-request 200` | `--delay 200` |
| `--bail` | `--bail` |
| `--env-var key=value` | `--var key=value`, or `--var-from-env NAME` |

Reports are written with `--reporter junit:report.xml`, also `text`, `json` and `html`, repeatable.

The `gostman` binary has nothing else to install, so CI needs no Node.js. See [Gostman in CI](ci.md).

## Back to Insomnia

Gostman does not write Insomnia's format, but Insomnia imports Postman collections. Export with the **Postman** format in the **Export** tab of the app, or with `gostman export store --format postman --out store.json`, and import that file in Insomnia. What the file holds is listed in [Back to Postman](coming-from-postman.md#back-to-postman). Scripts and checks are adapted to Postman's `pm.*` API, which Insomnia runs in imported Postman collections, so they need no rewriting. Extract rules become lines at the top of the post-response script that set collection variables, which Insomnia keeps in its base environment. The file carries no global variables, so check scripts that use `env.globals`; the export summary lists the other calls that will not run. See [Scripts and checks in Postman, Bruno and Insomnia](import-export-and-specs.md#scripts-and-checks-in-postman-bruno-and-insomnia).

## What Insomnia has that Gostman does not

- Cloud sync, organizations and roles. Gostman shares through Git or encrypted links. See [Sharing and documentation](sharing-and-docs.md).
- Hosted mock servers. Gostman's mock server runs where you run it.
- A spec editor. Gostman views, lints and syncs OpenAPI specs, and you edit them in your editor.
- Template tags that send a request for you when a value is missing or old, and plugin tags.
- A larger community and a longer history. Gostman is a smaller project; report problems on [GitHub](https://github.com/kunalgoesbyken/gostman/issues).
