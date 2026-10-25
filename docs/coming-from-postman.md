# Coming from Postman

Gostman reads Postman collections, environments and globals, rewrites the common `pm.*` script calls to its own script API, and runs the result from the app or from a single `gostman` binary. This page maps Postman's concepts to Gostman's, covers the import, lists what changes on the way, and gives the `gostman run` flags that match `newman run`.

Gostman has no paid tier, no account and no licence key. Collection runs of any size, mock servers, secret managers, CSV and JSON data files and any number of collections are in the free download. See [What is free in Gostman](free-features.md).

## Concepts

| In Postman | In Gostman |
| --- | --- |
| Workspace | A folder on disk, usually a Git repository. Open it with **Open folder** in the desktop app. See [Collections and Git](collections-and-git.md) |
| Collection | A collection: `gostman.yaml` and one YAML file per request. An import puts each Postman collection in a folder of its own |
| Folder | A folder with its own [folder settings](folder-settings.md): auth, headers, variables, scripts and assertions for the requests below it |
| Collection auth, variables and scripts | The settings of the folder named after the collection |
| Environment | An environment with the same name |
| Globals | The **Global** scope in the app. See [Variables](variables.md#scopes-and-precedence) |
| Initial and current values | One value per variable. Mark a variable **Secret** and its value lives in the operating system keychain; only its name is written to files. See [Secret variables](variables.md#secret-variables) |
| Postman Vault | [Secret managers](secrets-and-network.md#secret-managers): a variable reads its value from HashiCorp Vault, AWS, Azure, Google Cloud, KeePassXC, 1Password or Bitwarden when the request is sent |
| Saved examples | Examples on the request, served by the mock server |
| Mock servers | `gostman mock`, or **Mock server** in the desktop app. It runs on your machine. See [Folders, mock server and capture](workspaces-and-mock.md#examples-and-the-mock-server-desktop) |
| Collection Runner and Newman | **Run requests** in the app, and `gostman run` on the command line |
| Monitors | A scheduled CI job that runs `gostman run`, see [Monitors](#monitors) |
| Interceptor and proxy capture | `gostman capture`, which records traffic to one upstream as requests with examples |
| API definitions | OpenAPI import, spec viewer, sync, linter and contract checks. See [Import, export and specs](import-export-and-specs.md) |
| Forks, pull requests and comments | Git branches and pull requests on the YAML files |

## Import a collection

1. In Postman, export the collection as **Collection v2.1** and each environment you need. Export the globals from **Environments**, **Globals**, if you use them. The JSON file of **Settings**, **Data**, **Export data** works too, and so does a `.zip` or folder holding several of these files.
2. In Gostman, choose **Import** in the header and drop the files, or choose **Choose files** or **Choose folder**.
3. Read the summary. It counts the requests, folders, environments, global environments, collection variables and folder settings, says how many `pm.*` uses were rewritten, and lists the script lines that need rewriting by hand and the settings that were left out.
4. Choose **Import**. When the collection carries scripts or OAuth 2.0 settings, Gostman asks before keeping them.

From the command line, `gostman import` writes a folder of YAML files that `gostman run` and the desktop app read:

```bash
gostman import ./postman-export --out shop
gostman run shop --env Staging --var-from-env password
```

Warnings and skipped items are printed after the counts. Secret values are never written to the folder: the import names each secret variable it left empty, and you pass the values to `gostman run` with `--var`, `--var-from-env` (as for `password` above) or `--env-file`. The rules every import follows, such as never turning off TLS verification and never carrying tokens, are in [Import, export and specs](import-export-and-specs.md#what-imports-never-do).

## What comes across

| In Postman | In Gostman |
| --- | --- |
| Requests and folders | The same tree and order, under a folder named after the collection; a request above or between folders stays there and runs there |
| Collection and folder auth, scripts and variables | [Folder settings](folder-settings.md) on that folder. Requests set to inherit auth stay on **Inherit**. A folder set to **No auth** keeps **No auth**, so the requests below it that inherit are sent without credentials, as in Postman |
| Collection variables | Collection variables. With `gostman import` they are written to `gostman.yaml`; in the app they belong to the collection's folder and are listed in its **Collection settings**, **Vars**, and under **Environments**, **Collection variables** under the collection's name while one of its requests is open. Collection variables of type **secret** are marked secret: in the app their values stay on this device (the system keychain in the desktop app) and out of exports, and `gostman import` writes only their names and lists them. Folder variables of type **secret** come across with an empty value and are listed; set them in an environment and mark them secret. Switched-off variables are left out and listed |
| Environments | Environments with the same names, shared by every collection, as in a Postman workspace. Variables of type **secret** are marked secret; in the desktop app their values move to the keychain. `gostman import` writes only their names; pass the values to `gostman run` with `--var`, `--var-from-env` or `--env-file`. Switched-off variables are left out and listed |
| Globals | A global environment in the app, with secret values marked secret. `gostman run` has no global scope, so `gostman import` adds the globals to the collection variables in `gostman.yaml`; a collection variable with the same name keeps its value, as it wins in Postman too. Secret globals come across with an empty value |
| Saved examples | Examples with their name, status, headers and body. The first one is the default the mock server serves; Postman's `x-mock-response-name` and `x-mock-response-code` headers are not read. Up to 20 per request |
| Path variables such as `/users/:id` | `/users/{{id}}` with `id` as a variable of the request, so the value stays editable and the mock server matches any id. A value that is itself a variable, such as `{{userId}}`, is put into the URL |
| Query parameters and headers, including switched-off rows | The same rows |
| Raw, form, multipart, binary and GraphQL bodies | The same body types. Files need to be picked again |
| Basic, Digest, Bearer, API key, NTLM, AWS Signature, OAuth 1.0, OAuth 2.0, JWT, ASAP, Hawk and Akamai EdgeGrid auth | The same auth types. OAuth 2.0 tokens are never imported, so sign in again |
| `followRedirects: false` | The request's **Follow redirects** option switched off |
| `disableCookies: true` | The request's **Send cookies from the cookie jar** and **Store cookies the response sets** options switched off |
| `disableBodyPruning` | Nothing to do: Gostman always sends the body you set |
| Request, folder and collection descriptions | Descriptions, shown in generated documentation |

Listed in the summary and left out:

- `strictSSL: false`. TLS verification stays on; switch it off per request if you trust the host.
- Other request settings with no Gostman equivalent, such as `maxRedirects` and the TLS protocol and cipher settings. The summary names each one.
- A content type on a multipart text field. Gostman sends a content type only for file fields.
- Collections inside an **Export data** file that are still in Postman's v1 format. Export them again as Collection v2.1.

Postman runs test scripts from the collection inwards: collection, folder, then request. Gostman runs post-response scripts from the request outwards: request, folders, then collection. Pre-request scripts run in the same order in both. Check scripts where a collection or folder script sets a variable that a request's test reads.

Postman's newer YAML collection format (v3, a folder of `*.request.yaml` files) is not read. Export the collection as v2.1 JSON.

## Scripts

`test()`, `expect()` (Chai), `req`, `res`, `env`, `sendRequest` and the bundled modules work in Gostman. On import, the `pm.*` calls with a Gostman equivalent are rewritten:

| Postman | Gostman |
| --- | --- |
| `pm.test`, `pm.expect` | `test`, `expect` |
| `pm.environment`, `pm.variables`, `pm.collectionVariables` and `pm.globals` with `.get`, `.set`, `.has`, `.unset` | The same calls on `env` (the active environment), `env.session` (session values), `env.collection` (collection variables) and `env.globals` (the global environment) |
| `.toObject()`, `.clear()`, `.replaceIn(text)` on those scopes | `all()`, `clear()` and `interpolate(text)` on the matching object |
| `pm.iterationData.get`, `.has`, `.toObject()` | `env.get`, `env.has`, `env.all()`: the columns of a data row are variables |
| `pm.info.iteration`, `pm.info.iterationCount` | The `iteration` variable less one, and `iterationCount` |
| `pm.info.requestName`, `pm.environment.name` | `req.name`, `env.name` |
| `pm.request.method`, `pm.request.url`, `pm.request.url.toString()` | `req.method`, `req.url`, `req.getUrl()` |
| `pm.request.url.getHost()`, `getPath()`, `getQueryString()` | `req.getHost()`, `req.getPath()`, `req.getQueryString()` |
| `pm.request.headers.get(name)` | `req.getHeader(name)` |
| `pm.request.headers.add`, `upsert`, `remove`, `has`, `toObject` and the other list methods | The same methods on `req.headerList` |
| `pm.request.body.raw`, `pm.request.body.toString()` | `req.getBody({ raw: true })` |
| `pm.request.body.update(text)` | `req.setBody(text)` |
| `pm.response.json()`, `pm.response.text()` | `res.body`, and the body as text |
| `pm.response.code`, `status`, `responseTime`, `responseSize`, `headers` | `res.status`, `res.statusText`, `res.responseTime`, `res.size`, `res.headers` |
| `pm.response.headers.get(name)`, `has`, `toObject` and the other list methods | `res.getHeader(name)`, and the same methods on `res.headerList` |
| `pm.response.to.have.status(code)` | `expect(res.status).to.equal(code)` |
| `pm.response.to.be.ok`, `accepted`, `withoutContent`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `rateLimited` | `expect(res.status).to.equal(...)` with that status |
| `pm.response.to.be.info`, `success`, `redirection`, `clientError`, `serverError`, `error`, and `to.not.be.` any of these | `expect(res.status).to.be.within(...)` with that range, or `to.not.be.within` |
| `pm.response.to.have.header(name)`, `(name, value)` | `expect(res.getHeader(name)).to.exist`, `.to.equal(value)` |
| `pm.response.to.have.body()`, `(text)`, `(/pattern/)` | An expectation on the body text: not empty, equal, or matching |
| `pm.response.to.have.jsonBody()`, `(path)`, `(path, value)`, `(object)` | `expect(res.body)`: not a string, `.to.have.nested.property(path)`, `.to.have.deep.nested.property(path, value)`, `.to.deep.equal(object)` |
| `pm.response.to.have.jsonSchema(schema)` | `expect(res.body).to.have.jsonSchema(schema)` |
| `pm.response.to.be.json` | An expectation that the `Content-Type` contains `json` |
| `pm.cookies.get`, `has`, `toObject` and the other list methods | The same methods on `bru.cookies` |
| `pm.sendRequest(request, callback)` | `await sendRequest(request)`, with the callback called as before. A URL string, Postman's `header` list and `body.raw` are converted, also when the request is built while the script runs, such as `pm.environment.get("baseUrl") + "/health"` |
| `pm.setNextRequest`, `pm.execution.setNextRequest`, `pm.execution.skipRequest` | `setNextRequest`, `skipRequest` |
| `pm.visualizer.set(template, data)` | `visualize(template, data)`. Templates support `{{name}}`, `{{#each}}` and `{{#if}}` |
| `postman.setEnvironmentVariable`, `getEnvironmentVariable`, `clearEnvironmentVariable` and the `Global` versions | `env.set`, `env.get`, `env.unset`, and the same calls on `env.globals` |
| `postman.setNextRequest`, `postman.getResponseHeader(name)` | `setNextRequest`, `res.getHeader(name)` |
| `tests["name"] = condition` | `test("name", ...)` that expects the condition to be truthy |
| `responseBody`, `responseCode.code`, `responseHeaders`, `responseTime` | The body as text, `res.status`, `res.headers`, `res.responseTime` |
| `responseBody.has(text)` | Whether the body text contains `text` |
| `tv4.validate(data, schema)` | The bundled `ajv` module validating `data` against `schema` |
| `require("lodash")`, `crypto-js`, `moment`, `uuid`, `ajv`, `chai`, and the globals `_`, `CryptoJS`, `moment` | The bundled modules of the same names |

`sendRequest` reaches only localhost and the hosts that requests in the collection already use.

A name your script declares that Gostman scripts already have, such as `const res = pm.response.json()` or a helper `function test(name, fn)`, gets a number added, `res1` or `test1`, everywhere the script uses it, so it no longer hides Gostman's `res` or `test` and the rewritten calls still reach them. This applies to `req`, `res`, `env`, `test`, `expect`, `utils`, `sendRequest`, `setNextRequest`, `skipRequest`, `stopExecution`, `visualize`, `bru` and `insomnia`; the script behaves as it did in Postman.

Kept as written and listed in the summary with their line, so you can rewrite them before running:

- `pm.vault`, `pm.require("@team/package")`, `pm.execution.runRequest`, `pm.execution.location` and `pm.info.eventName`.
- `pm.iterationData.set` and `unset`, `pm.request.url.query.add` and the other URL editing calls, and `pm.request.body.update` with an object.
- `pm.cookies.jar()`. Use `bru.cookies.jar()`, whose methods are `setCookie`, `getCookie`, `getCookies`, `deleteCookie` and `deleteCookies`.
- `pm.test.skip`, `xml2Json`, `cheerio` and `require` of other modules.

`pm.variables.set` writes a session value, which is kept in memory and never saved, like Postman's local variables. Scripts run in an isolated worker with no network access of their own and stop after the time limit set on the Script tab of [Settings for all collections](folder-settings.md) (**Collection settings** in a folder workspace): 10 seconds unless you change it, up to 120. The script API is in [Scripts and checks](scripting-and-settings.md#script-api).

## From newman run to gostman run

`gostman run` takes the folder that `gostman import` wrote, or a Gostman export, not the Postman file. It runs every request, including those in nested folders. It exits 0 when everything passed, 1 when a check failed, 2 when the command or input is wrong and 3 when a request got no response.

| `newman run` | `gostman run` |
| --- | --- |
| `newman run collection.json -e staging.json` | Put both files in a folder and run `gostman import postman-files --out api` once, then `gostman run api --env Staging` |
| `--folder Orders` | `--folder Orders`, with a folder name or a path such as `Shop/Orders`. The import puts every folder under one named after the collection |
| `--env-var key=value`, `--global-var key=value` | `--var key=value`, or `--var-from-env NAME` to read the value from the process environment |
| `-d users.csv`, `--iteration-data users.json` | `--data users.csv` or `--data users.json` |
| `-n 5`, `--iteration-count 5` | `--iterations 5` |
| `--delay-request 200` | `--delay 200` |
| `--timeout-request 5000` | `--timeout 5000` |
| `--bail` | `--bail` |
| `-k`, `--insecure` | `--insecure` |
| `--ssl-client-cert cert.pem --ssl-client-key key.pem` | `--client-cert cert.pem --client-key key.pem` |
| `--ssl-client-cert-list list.json` | `--client-cert api.example.com=cert.pem,key.pem`, repeated for each host |
| `--ssl-extra-ca-certs ca.pem` | `--cacert ca.pem`, added to the system certificates |
| `-r cli,junit --reporter-junit-export report.xml` | `--reporter text --reporter junit:report.xml`, also `json` and `html`, repeatable |
| `--working-dir files` | `--allow-files`, which reads `{{$file(path)}}` relative to the collection folder |
| `--color off` | Set `NO_COLOR` |

`--timeout` (the limit for the whole run), `--suppress-exit-code`, `--ignore-redirects`, `--cookie-jar`, `--export-environment`, `--export-globals` and `--export-collection` have no `gostman run` flag, and reporters cannot be added as plugins. Gostman adds `--parallel`, `--only`, `--tags`, `--redact`, `--contract` and `--secrets`; every flag is in [Command line](cli.md).

The `gostman` binary has nothing else to install, so CI needs no Node.js. The GitHub Action and the `ghcr.io/kunalgoesbyken/gostman` image are described in [Gostman in CI](ci.md).

## Monitors

A monitor is a run on a schedule. In GitHub Actions, add a `schedule` trigger to the workflow from [Gostman in CI](ci.md):

```yaml
on:
  schedule:
    - cron: "*/30 * * * *"
```

The run happens on the CI runner, so it reaches what the runner can reach, and failures arrive the way the CI system reports them.

## Back to Postman

Mixed teams can go back and forth. The **Postman** format in the **Export** tab of the app, and `gostman export <workspace> --format postman --out collection.json`, write Collection v2.1. When everything sits in one top-level folder, as after an import from Postman, the collection takes that folder's name, and when the collection has no auth or scripts of its own, the folder's auth, scripts and variables become the collection's again. `gostman export` replaces credentials with `{{NAME}}` placeholders and lists them as empty collection variables, unless you pass `--include-secrets`. The file has:

- requests, folders, query parameters, headers, bodies and descriptions;
- auth on requests, folders and the collection, including a folder's **No auth**, without OAuth 2.0 tokens;
- pre-request and post-response scripts on requests, folders and the collection, as **prerequest** and **test** events, adapted to run in Postman;
- assertion rows on requests, folders and the collection, as `pm.test` checks in the **test** event that compare as Gostman does, so `eq 200` also passes for `"200"`; rows that are turned off become skipped tests, and importing the file again gives the rows back;
- saved examples, each with the request as its original request;
- folder variables, and as collection variables the variables in use, except secret ones (the app), or the collection variables of `gostman.yaml` (`gostman export`);
- request variables used as a whole path segment, such as `{{id}}`, as Postman path variables (`:id`).

Scripts keep the code you wrote. When one uses Gostman names such as `env`, `res`, `test` or `sendRequest`, a few lines at the top define them with `pm.*`, only for the parts the script uses, so `env.set("token", res.body.token)` runs in Postman and newman as it is. Scripts already written with `pm.*` are exported unchanged. The summary under the format, and the output of `gostman export`, lists what was adapted and every call Postman cannot run, such as `res("..id")` queries or `req.setTimeout`, with its place and line. Importing the file back into Gostman removes those lines again. See [Scripts and checks in Postman, Bruno and Insomnia](import-export-and-specs.md#scripts-and-checks-in-postman-bruno-and-insomnia).

Extract rules become lines at the top of the post-response script, such as `pm.collectionVariables.set("token", pm.response.json().access_token);`, and come back as extract rules when you import the file again. Headers on folders and the collection and binary example bodies have no place in a Postman collection and are left out.

## What Postman has that Gostman does not

- Cloud workspaces with live sync, roles, comments and an activity feed. Gostman shares through Git or encrypted links. See [Sharing and documentation](sharing-and-docs.md).
- Hosted monitors and hosted mock servers. Gostman runs both where you run it.
- Flows, the public API network, and a package library for `pm.require`.
- A larger community and a longer history. Gostman is a smaller project; report problems on [GitHub](https://github.com/kunalgoesbyken/gostman/issues).
