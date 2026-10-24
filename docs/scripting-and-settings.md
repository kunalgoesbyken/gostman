# Variables, scripts and settings

This page covers variables, tests and scripts, the desktop network settings and the OAuth 2.0 callback.

## Variables

Define variables in an environment, a folder, the collection or a request, and reference them anywhere with `{{name}}`. [Variables](variables.md) covers scopes, secrets, dynamic values and extraction.

## Tests and scripts

The Tests tab of a request holds assertions (`res.status equals 200`, `res.body.user.id is a number`) and pre-request and post-response scripts. Use assertions for checks that fit in one row and a script for anything else. Results appear in the Tests tab of the response, and the runner and `gostman run` apply the same checks.

![A request with four assertion rows and a passing test list under the response](../gostman-gui/frontend/src/assets/landing/tests.webp)

Scripts are JavaScript. They run in an isolated worker with no network access of their own and are stopped after 10 seconds, or after the **Time limit** set on the Script tab of the collection settings (1 to 120 seconds). Folder and collection scripts run around the request's own, outermost first; see [Folder and collection settings](folder-settings.md).

### Script API

| Name | What it is |
| --- | --- |
| `req` | The request: `name`, `method`, `url`, `headers` (an object), `body` (parsed when it is JSON) and `timeout` in milliseconds (0 uses the default). A pre-request script can change it with `setUrl`, `setMethod`, `setHeader(name, value)`, `setHeaders`, `deleteHeader(name)`, `setBody` and `setTimeout(ms)`; `getHeader(name)` ignores case. `getHost()`, `getPath()` and `getQueryString()` read the URL with variables filled in, and `headerList` offers `get`, `has`, `all`, `toObject`, `add`, `upsert` and `remove`. |
| `res` | The response, in post-response scripts: `status`, `statusText`, `headers` (lower-case names), `body` (parsed when it is JSON, text otherwise), `responseTime` in milliseconds, `size` and `url`. `res(path)` reads a value from the body; see [Response queries](#response-queries). `getSize()` returns `body`, `headers` and `total` bytes, `headerList` reads headers ignoring case, and `setBody(value)` changes the body seen by the rest of the script. |
| `env` | Variables: `get(name)`, `has(name)`, `set(name, value)`, `unset(name)`, `all()` and `clear()`. Values set here are saved into the active environment. Objects are stored as JSON text. `env.name` is the active environment's name and `env.interpolate(text)` replaces `{{name}}` with variable values, including values that refer to other variables; dynamic values such as `{{$guid}}` are left for the send. `env.session`, `env.collection` and `env.globals` have the same calls and write to session values, collection variables and the global environment; see [Values set by scripts](variables.md#values-set-by-scripts-and-extract-rules). Reading from any of them returns the value the request would use. |
| `test(name, fn)` | Records a passing test, or a failing one when `fn` throws. `fn` may be `async`. |
| `expect` | [Chai](https://www.chaijs.com/api/bdd/)'s `expect`, plus `matchSchema(schema)` and its Postman name `jsonSchema(schema)`; see [JSON Schema checks](#json-schema-checks). |
| `console` | `log`, `info`, `warn` and `error`, shown in the console panel and in run output. |
| `sendRequest(request)` | Sends another request and returns its response, up to 50 times per script. Pass the name of a saved request, or `{ method, url, headers, body, timeout }`; `timeout` is in milliseconds and at most 5000. |
| `setNextRequest(name)`, `skipRequest()`, `stopExecution()` | Change the order of a run: jump to a request by name or `Folder/Name` path, skip this one, or stop. `setNextRequest(null)` also stops. Requests that a jump or a stop passed over are reported as skipped, with the request whose script moved the run. |
| `utils` | `uuid()`, `md5`, `sha1`, `sha256`, `sha512` (`hex` or `base64` output), `hmac(algorithm, key, text)`, `base64`, `hex` and `url` with `encode` and `decode`, `date` (`now`, `timestamp`, `unix`, `format`, `add`) and `random` (`int`, `string`, `pick`). |
| `visualize(template, data)`, `visualize.table(rows)` | Renders an HTML view of the response in its **Visualize** tab. Templates use `{{field}}`, `{{#each list}}` and `{{#if value}}`; values are escaped. |
| `require(name)` | The bundled modules `lodash`, `crypto-js`, `uuid`, `moment`, `dayjs`, `ajv` and `chai`. In a trusted folder on the desktop, also `./` and `../` files inside the folder. |
| `pm` | Postman's script API, so scripts pasted from Postman run as they are; see [Postman and Insomnia scripts](#postman-and-insomnia-scripts). |
| `insomnia` | Insomnia's script API, the same as `pm` plus `insomnia.baseEnvironment`. |
| `bru` | Bruno's script API, so scripts pasted from Bruno run as they are; see [Scripts from Postman and Bruno](#scripts-from-postman-and-bruno). `bru.cookies` reads and changes the cookies sent to this request's URL; `bru.cookies.jar()` reaches only the cookies of localhost and of hosts the collection's requests use, the same hosts `sendRequest` may call. |

### Response queries

`res(path)` reads values from the response body, the way Bruno does:

| Query | Result |
| --- | --- |
| `res("customer.address.city")` | One value along a dotted path. |
| `res("customer.orders.items.amount")` | Paths go through arrays, so this returns every amount as one flat array. |
| `res("customer.orders.items.amount[0]")` | `[n]` picks one item. |
| `res("..amount")` | `..` searches at any depth. |
| `res("..items[?].amount", (item) => item.amount > 20)` | `[?]` filters with the next argument: a function, or an object such as `{ id: 2 }` that items must match. |
| `res("..items..amount[?]", (amount) => amount + 10)` | A function that returns a value other than `true` or `false` maps the items instead. |

A query that finds one value returns it, several values come back as an array, and a path that does not exist returns `undefined`.

### JSON Schema checks

A JSON Schema describes the shape of a value: its type, the fields it must have, the values it may take. Checking a response body against one catches changes that a single assertion misses, such as a field that became `null`, a number sent as text or a field that was renamed.

- In the Assertions view, set the Check to **matches schema**, the Expression to the value (usually `res.body`) and the Expected value to the schema or to a `{{variable}}` that holds it.
- In a script, use `expect(res.body).to.matchSchema(schema)` inside `test()`. `schema` is an object or JSON text. `.not.to.matchSchema(schema)` passes when the value does not match.
- **Add checks from this response** in the response toolbar writes a schema from the last response for you; see [Tests](requests-and-responses.md#tests).

A failed check lists each problem with its place in the value, starting from `$`:

```
$.user.email is missing, but the schema requires it.
$.items[2].price should be a number, but it is the text "12.5".
$.status should be one of "active", "closed", but it is the text "deleted".
```

Supported keywords: `type` (one type or a list, including `null`), `enum`, `const`, `properties`, `required`, `additionalProperties`, `patternProperties`, `propertyNames`, `minProperties`, `maxProperties`, `dependentRequired`, `dependentSchemas`, `items`, `prefixItems`, `additionalItems`, `contains`, `minContains`, `maxContains`, `minItems`, `maxItems`, `uniqueItems`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`, `minLength`, `maxLength`, `pattern`, `allOf`, `anyOf`, `oneOf`, `not`, `if`, `then`, `else`, and `$ref` to a place in the same schema such as `#/$defs/user` or `#/definitions/user`. OpenAPI's `nullable: true` and Swagger's `x-nullable: true` allow `null`. `format` is checked for `date-time`, `date`, `time`, `email`, `uuid`, `uri`, `ipv4`, `ipv6` and `hostname`; other formats are accepted as they are. A `$ref` to another file cannot be followed in a schema you paste. The same checker runs in the app, in the runner, in `gostman run` and behind the bundled `ajv` module.

### Examples

Fail the test when a field is missing or has the wrong type:

```js
test("the user has an id and an email", () => {
  expect(res.body).to.have.property("id").that.is.a("number")
  expect(res.body.email).to.match(/@/)
})
```

Validate the whole body against a JSON Schema:

```js
test("matches the schema", () => {
  expect(res.body).to.matchSchema({
    type: "object",
    required: ["id", "title", "completed"],
    properties: { id: { type: "number" }, title: { type: "string" }, completed: { type: "boolean" } },
  })
})
```

Scripts that use Ajv, `const validate = new (require("ajv"))().compile(schema)`, keep working; `validate.errors` has Ajv's fields.

Sign a request in a pre-request script:

```js
const timestamp = String(utils.date.unix())
const signature = utils.hmac("sha256", env.get("API_SECRET"), `${req.method}\n${req.url}\n${timestamp}`)
req.setHeader("X-Timestamp", timestamp)
req.setHeader("X-Signature", signature)
```

Fetch a token once, before the first request that needs it:

```js
if (!env.has("access_token")) {
  const login = await sendRequest("Log in")
  env.set("access_token", login.body.access_token)
}
```

Keep polling until a job finishes, in a run:

```js
if (res.body.state !== "done") setNextRequest("Jobs/Get job status")
```

Show a list as a table:

```js
visualize.table(res.body.map(({ id, title, completed }) => ({ id, title, completed })))
```

### Scripts from Postman and Bruno

Scripts imported from Postman or Bruno keep working for the common `pm.*` and `bru.*` calls, which the importer rewrites to the names above. Every Postman call that is rewritten is listed in [Coming from Postman](coming-from-postman.md#scripts). Postman's `pm.response.to.have.jsonSchema(schema)` becomes `expect(res.body).to.have.jsonSchema(schema)`, and `pm.expect(value).to.have.jsonSchema(schema)` keeps working. Variable calls keep their scope: `pm.variables` and `bru.setVar` become `env.session`, `pm.collectionVariables` and `bru.setCollectionVar` `env.collection`, `pm.globals` and `bru.setGlobalEnvVar` `env.globals`, and `pm.environment` and `bru.setEnvVar` `env`. `bru.getProcessEnv(name)` reads the active environment, `bru.interpolate` becomes `env.interpolate`, `bru.runRequest("Folder/Name")` sends the saved request with that name, and responses from `bru.sendRequest` and `bru.runRequest` keep Bruno's `data` field next to `body`. `res("path")` queries, `bru.cookies` (including `bru.cookies.jar()`) and Bruno's `req` and `res` methods such as `req.setTimeout`, `req.getName` and `res.headerList` work as written. JetBrains HTTP Client handlers in `.http` files are rewritten the same way: `client.test`, `client.assert`, `client.global`, `request.variables` and `response.body` become `test`, `expect`, `env`, `env.session` and `res.body`, see [.http files](import-export-and-specs.md#http-files). Calls with no equivalent are kept as written and listed in the import summary.

Scripts pasted from Bruno without importing run too: `bru` has the same calls, with Bruno's names. Calls that need something Gostman does not have are listed in the import summary and kept as written: `bru.cwd()`, `bru.getCollectionName()`, `bru.getSecretVar`, the OAuth 2 credential calls, `bru.getTestResults()`, `bru.getAssertionResults()`, `bru.runner.iterationIndex`, `bru.runner.totalIterations`, `req.setMaxRedirects`, `req.onFail`, `req.getAuthMode()`, `req.getTags()`, `req.getPathParams()`, `req.getExecutionMode()` and `req.disableParsingResponseJson()`. Bruno's variable calls keep their scope: `bru.setVar` writes a session value, `bru.setEnvVar` the active environment, `bru.setGlobalEnvVar` the global environment.

### Postman and Insomnia scripts

`pm` and `insomnia` exist at run time, so a snippet copied from Postman's or Insomnia's documentation runs without being imported. They are thin layers over the names above and run the same in the app, the runner and `gostman run`.

| Name | What it does |
| --- | --- |
| `pm.environment`, `pm.variables`, `pm.collectionVariables`, `pm.globals` | `get`, `set`, `has`, `unset`, `clear`, `toObject` and `replaceIn`. `pm.environment` writes the active environment, `pm.variables` session values, `pm.collectionVariables` collection variables and `pm.globals` the global environment. `get` returns the value the request would use. `pm.environment.name` is the environment's name. |
| `pm.iterationData` | `get`, `has` and `toObject` for the values of the current data row. |
| `pm.request` | `url` (`toString()`, `getHost()`, `getPath()`, `getQueryString()`, `update(url)` and `query` with `get`, `has`, `all`, `toObject`, `add`, `upsert`, `remove` and `clear`; assigning a string replaces the URL), `method`, `name`, `headers` (`get`, `has`, `all`, `toObject`, `add`, `upsert`, `remove`), `addHeader`, `upsertHeader`, `removeHeader`, and `body` with `mode`, `raw`, `toString()` and `update(text or { raw })`. Changes in a pre-request script are sent. |
| `pm.response` | `code`, `status`, `headers`, `responseTime`, `responseSize`, `json()`, `text()`, `reason()` and `size()`, in post-response scripts. |
| `pm.response.to` | `to.have.status(code or text)`, `to.have.header(name, value)`, `to.have.body(text, RegExp or object)`, `to.have.jsonBody(path, value)`, `to.have.jsonSchema(schema)`, `to.be.json`, `to.be.withBody`, `to.be.ok`, `to.be.success`, `to.be.info`, `to.be.redirection`, `to.be.clientError`, `to.be.serverError`, `to.be.error`, `to.be.accepted`, `to.be.withoutContent`, `to.be.badRequest`, `to.be.unauthorized`, `to.be.forbidden`, `to.be.notFound` and `to.be.rateLimited`, with `.not`. `pm.expect(pm.response).to.have.status(200)` works too. |
| `pm.cookies` | The cookies sent to this request's URL, with `get`, `has` and `toObject`; `pm.cookies.jar()` has `set`, `get`, `getAll`, `unset` and `clear`, which take a callback and also return a promise. |
| `pm.info` | `eventName` (`prerequest` or `test`), `requestName`, `iteration` (from 0) and `iterationCount`. |
| `pm.sendRequest(request, callback)` | A URL or `{ url, method, header, body }` with a `raw`, `urlencoded` or `graphql` body. Pass a callback `(error, response)` or `await` the promise; the script waits for callbacks before it ends. The response has the same fields as `pm.response`. |
| `pm.test(name, fn)`, `pm.test.skip`, `pm.expect` | `test`, a skipped test that is not run, and `expect`. `test.skip` works on `test` too. |
| `pm.visualizer.set(template, data)` | `visualize(template, data)`. |
| `pm.execution.setNextRequest(name)`, `pm.execution.skipRequest()`, `pm.setNextRequest(name)` | Change the order of a run. |

`insomnia` has the same members: `insomnia.environment`, `insomnia.baseEnvironment` and `insomnia.collectionVariables` (both collection variables), `insomnia.variables` (session values), `insomnia.globals`, `insomnia.request`, `insomnia.response`, `insomnia.sendRequest`, `insomnia.test`, `insomnia.expect` and `insomnia.execution`.

Not available: `pm.vault`, `pm.require` and the legacy `postman.*` and `tests[...]` globals. A script that declares its own `pm`, `insomnia`, `req` or `res` with `const` or `let` fails to start; rename the variable.

## Network settings (desktop)

**Network**, at the bottom left of the window, opens the proxy and certificate settings: use the system proxy, none, or a custom HTTP, HTTPS or SOCKS5 proxy with a bypass list; add a CA certificate; and attach client certificates to hosts. Certificates and keys are PEM files, and keys must not be passphrase-protected.

## OAuth 2.0 callback

For the authorization code grant, register the callback URL shown in the Auth tab with your provider. The desktop app listens on `http://localhost:9876/callback` by default and the address can be changed; the web version uses `/oauth-callback` on its own origin.
