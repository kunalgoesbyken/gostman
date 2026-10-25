# Command line

Each release includes `gostman-cli-<os>-<arch>` archives with a single `gostman` binary. With Go installed, `go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest` installs it, and `go build ./cmd/gostman` builds it from a checkout.

On macOS the binary is not notarized: run `xattr -d com.apple.quarantine gostman` once.

## Commands

```bash
gostman run orders-api --env CI --var-from-env API_TOKEN --reporter junit --output report.xml
gostman send --workspace orders-api "Create user" --select '$.id'
gostman mock orders-api --port 4010
gostman capture --upstream https://api.example.com --workspace orders-api
gostman docs orders-api --output docs.html
gostman import postman_collection.json --out orders-api
gostman export orders-api --format openapi --out openapi.json
```

- `run` takes a workspace folder, a Gostman export or a Bruno collection folder (converted in memory, see [Coming from Bruno](coming-from-bruno.md#try-it-on-the-bruno-folder-first)) and sends every request in order with its scripts, extraction rules, cookies, OAuth 2.0 tokens and checks. It exits 0 when everything passed, 1 when a check failed, 2 when the command or input is wrong and 3 when a request got no response; see [Exit codes](#exit-codes). A 4xx or 5xx status alone is not a failure; add a check such as `res.status equals 200`. Under each request the text report prints the URL that was sent, with variables filled in and secrets shown as `{{name}}`: values of variables whose names look secret (such as `apiKey` or `password`), values read from secret managers, OAuth 2.0 tokens and query parameters with such names. The JSON report keeps the URL as written in `url` and adds the sent one as `resolvedUrl`; the HTML report shows both. Requests run in the order the sidebar shows, where requests and subfolders share one order in each folder, and a `setNextRequest` loop stops after a pass has sent 1000 requests more than it holds; see [Run requests](runner-load-and-scan.md#run-requests).
- `send` sends one saved request, named by its id, its name or its full `Folder/Name` path, or an ad hoc one (`gostman send GET https://example.com -H 'Accept: application/json'`), and prints only the response body on standard output, or only the selected value with `--select`, so `gostman send "Users/Get user" --select '$.id' | xargs ...` works; the short JSON summary and any warnings go to standard error. With `--json` standard output gets a single JSON document instead, with the body in `body.text` and its encoding (`utf8`, or `base64` for binary bodies) in `body.encoding`, so the output can go straight into `jq`: `gostman send --json GET https://example.com | jq -r .body.text`. `-d` or `--data` gives an unsaved request a body, `--select '$.path'` prints only that part of a JSON body, `--max-body n` prints at most n bytes of the body (default 8192), and `--include-headers` adds the response headers to the summary.
- `mock` serves the saved examples of a workspace on `127.0.0.1` (a request picks another example of its route with the `x-mock-response-name` or `x-mock-response-code` header, see [Examples and the mock server](workspaces-and-mock.md#examples-and-the-mock-server-desktop)); `--openapi spec.yaml|url` serves a spec's operations instead or as well, `--delay`, `--delay-max`, `--error-rate` and `--error-status` add latency and failures, and `--log` prints each request's headers and body with credentials masked. `--port` sets the port (default 4010) and `--env name` picks the environment for `{{variables}}` in URLs; a variable in the path matches any value. `--cors` answers browser pages served from `localhost`, and `--cors-origin https://app.example.com` (repeatable) allows another exact origin.
- `capture` forwards everything sent to `127.0.0.1:4020` on to one API, prints each call, and with `--workspace` saves each new method and path as a request with its response as an example. `--port` changes the port and `--folder name` saves into that top-level folder of the workspace.
- `docs` writes the collection as one self-contained HTML page, to stdout or to `--output file`. `--title` sets the page title (default `API documentation`), `--no-examples` leaves out saved example responses and `--playground` adds a **Try it** panel; see [Generated documentation](#generated-documentation).
- `relay` lets the web app send its requests from your computer; see [Local relay for the web app](#local-relay-for-the-web-app).
- `import` and `export` convert a workspace from and to other tools' formats; see [Import and export](#import-and-export).
- `init [folder]` creates an empty workspace and prints how to register `gostman mcp` with a coding agent, using the workspace's absolute path. When the folder already holds other files, such as a repository root, the workspace goes in a `gostman` folder inside it; nothing is overwritten. `--skill` also writes the Gostman [Agent Skill](agents.md#agent-skill) to `.claude/skills/gostman/SKILL.md`.
- `mcp` serves a workspace to a coding agent; see [Use from a coding agent](agents.md).

## Flags for run and send

`gostman help` lists every flag.

### Variables

`--var name=value` sets a variable and `--var-from-env NAME` reads it from the environment, so secrets stay out of the files. A `{{name}}` that nothing defines is sent as written; `run` and `send` print a `warning:` line on standard error that names it, and the output of `send` lists it under `unresolved`. Values given on the command line win over every variable saved in the collection, a request's own Vars included, such as the path parameters an OpenAPI import fills in: `--var id=7` sends `/pets/7` even though the request saves `id: 0`. Each `send` starts afresh: variables extracted by an earlier `send` are not kept, so pass them with `--var` or use `run`. `--redact` replaces variable values and credentials in a report with `{{name}}`.

### Environments

`--env name` picks the environment; without it, `run`, `send`, `load` and `mcp` use the first environment of the collection. In an export from the app, an environment can belong to one collection (a top-level folder, see [Environments per collection](variables.md#environments-per-collection)): with `--folder`, `run` offers the shared environments and those of that folder's collection, and without `--env` uses the collection's first. When several collections have an environment with the name you give, `--env` names one as `Collection/Name`, for example `--env "Orders API/Local"`, or `--folder` picks the collection.

### Secret managers

An environment variable can read its value from HashiCorp Vault (KV 1 and 2), AWS Secrets Manager, Azure Key Vault, Google Cloud Secret Manager, 1Password, Bitwarden or Bitwarden Secrets Manager. The collection stores only a reference (connection name, path, field, version); the connection is yours. Connections named `vault`, `aws`, `azure` or `gcp` read the standard variables: `VAULT_ADDR`, `VAULT_TOKEN` (or `VAULT_ROLE_ID` with `VAULT_SECRET_ID`), `VAULT_NAMESPACE`; `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`; `AZURE_KEYVAULT_URL` with `AZURE_ACCESS_TOKEN` or `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`; `GOOGLE_OAUTH_ACCESS_TOKEN` (for example from `gcloud auth print-access-token`) and `GOOGLE_CLOUD_PROJECT`. Connections named `onepassword`, `bitwarden` or `bitwarden-secrets` run `op`, `bw` or `bws` and read `OP_SERVICE_ACCOUNT_TOKEN` and `OP_ACCOUNT`; `BW_SESSION`; `BWS_ACCESS_TOKEN` and `BWS_SERVER_URL`. `GOSTMAN_SECRETS_<NAME>_COMMAND` says where the tool is when it is not on the `PATH`. A connection named after its kind is used only when at least one of its variables is set; otherwise declare it with `GOSTMAN_SECRETS_<NAME>_KIND`. KeePassXC connections only work in the desktop app. Another name such as `prod-vault` is set up with `GOSTMAN_SECRETS_PROD_VAULT_KIND=vault` plus `GOSTMAN_SECRETS_PROD_VAULT_ADDRESS`, `..._TOKEN` and so on. Secret references are only read when the run opts in with `--secrets` (credentials from the process environment) or `--secrets-env-file secrets.env` (the same variables from a KEY=value file; the process environment wins), so a collection you did not write cannot use the credentials of your shell or CI job. A reference that cannot be read stops the run before anything is sent. Values are replaced in `--redact` reports and in `send` and `mcp` output. Even with the flag, a collection chooses which paths are read, so only pass it for collections you trust. The apps resolve references in the desktop app only, from connections set up under Secret managers; the web version cannot reach them.

### Reading files

`--allow-files` lets `{{$file(path)}}` and `{{$fileBase64(path)}}` read files for `run`, `send` and `load`; paths start at the workspace folder or the folder of the export file, or the current folder for a request given as a method and a URL, and cannot leave it. It is off by default, so a collection you did not write cannot send your files. See [Reading files](variables.md#reading-files).

### Data-driven runs

`--data users.csv` (header row, UTF-8, quoted fields may hold commas and line breaks) or `--data users.json` (an array of objects) runs the whole collection once per row. A row's columns become variables that win over request, folder and environment variables and over `--var`; every value from a CSV is text. `iteration` (from 1) and `iterationCount` are set for scripts and `{{iteration}}` in requests. `--iterations n` repeats a run n times, or uses only the first n rows. Each iteration starts from the environment's variables again.

### Parallel runs

`--parallel n` sends up to n at once. With several iterations, whole iterations run side by side and each keeps its own order and extraction chaining. With one iteration, single requests run side by side and do not see each other's extracted variables, so use it for independent requests. Cookies and OAuth 2 tokens are shared between workers, and a token is fetched once.

### Tags

`--tags smoke,api` runs only requests that have at least one of the tags (a request also has the tags of the folders it is in), and `--exclude-tags slow` skips requests that have any of them. Both take a comma list and can be repeated, ignore case, and combine with `--folder` and `--only`: a request runs only when it passes every filter. When nothing is left, the run exits 2.

### Reports

`--reporter text|json|junit|html`, or `format:file` to write that report to a file. Repeat it to write several reports in one run: `--reporter text --reporter junit:report.xml --reporter html:report.html`. At most one reporter can go without a file, and it prints to stdout; when every report goes to a file, the text summary is printed. `--output file` names the file of the reporter given without one, so `--reporter junit --output report.xml` works as before. `--reporter html:report.html` writes one self-contained page with a summary, every request's timing, checks, request and response, and a filter for failures; response bodies are included, so add `--redact` before sharing it. The desktop and web runner dialogs take a data file and a parallel count the same way and can download the same report; there, iterations run one after another and the parallel count applies inside each. Colour is off when `NO_COLOR` is set or the output is not a terminal.

### Contract checks

`--contract openapi.yaml` (a file or an `http(s)` address) checks every HTTP response of the run against the spec: the status is documented for the operation with the same method and path, the content type is documented for that status, and a JSON body matches the response schema. Each check is reported like any other check, named like `Status 200 is documented for GET /pets/{id}`, with `"kind": "contract"` in the JSON report, so a mismatch fails the run; the text summary adds a Contract line. A response whose path matches no operation gets a warning line instead of checks. Without the flag, runs are unchanged. The app runs the same checks for folders linked to a spec; see [Contract checks](import-export-and-specs.md#contract-checks).

### Proxies and certificates

`run`, `send`, `load` and `mcp` take `--cacert ca.pem` (PEM or DER, trusted as well as the system's certificates; repeatable), `--client-cert cert.pem --client-key key.pem` (presented to every host), `--client-cert client.p12` or a PEM file that holds the key (no `--client-key`), `--client-cert api.example.com=cert.pem,key.pem` or `api.example.com=client.p12` (presented to that host only; `*.example.com` covers subdomains; repeatable), `--client-cert-pass-env NAME` (the passphrase of encrypted keys and PFX/P12 files, read from that environment variable), `--proxy http://user:pass@proxy:8080` (`http`, `https` or `socks5`) and `--noproxy localhost,*.internal.example.com` (hosts that skip `--proxy`). Without `--proxy`, the standard `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` variables are used; Go never sends `localhost` or `127.0.0.1` through them. A workspace folder's `network` section in `gostman.yaml` is applied first and the flags win over it; see [Network settings for a collection](secrets-and-network.md#network-settings-for-a-collection). The same settings apply to gRPC, OAuth 2 token requests and `sendRequest` in scripts. A missing file, a file that is not a certificate, or a wrong or missing passphrase exits 2 before anything is sent.

### OAuth 2 sign-ins

The authorization code and device code grants need a person in a browser, so `run`, `send` and `mcp` cannot get their first token. Pass one with `--oauth-token-env NAME` (an access token) or `--oauth-refresh-token-env NAME` (a refresh token that the run exchanges at the request's token URL, with its client ID and secret). They are used for every request with those grants that has no token yet (for `mcp`, also by the agent's requests, with the tokens hidden from it like any credential), are kept in memory only and are never written to a workspace file. Client credentials and password grants fetch their own tokens as before.

### Other run flags

`--only "Folder/Name"` (name, id or path, repeatable), `--bail`, `--delay ms`, `--timeout ms`, `--env-file .env` (KEY=value lines, `--var` wins; also for `send`, `load` and `mcp`), `--stream-timeout s` (time budget for each streaming (SSE) request, default 10 seconds) and `--insecure`, which is off unless you pass it.

## Exit codes

`run` and `send` exit with:

| Code | Meaning |
| --- | --- |
| 0 | every request and check passed |
| 1 | a check or a script failed, or the run was interrupted |
| 2 | the command or the input is wrong |
| 3 | a request got no response: it could not be sent, the connection failed or timed out, or the host is not allowed |

A run with both kinds of failure exits 3. Scripts that only test for a non-zero code keep working. `load`, `scan` and `lint` exit 1 when their threshold is reached and 2 on wrong input.



## Load testing

`gostman load` sends one request many times at once and reports throughput, latency percentiles (p50, p90, p95, p99), status codes and error samples. Only target systems you own or have permission to test.

```bash
gostman load orders-api --request "Orders/List" --concurrency 20 --duration 30s
gostman load --concurrency 50 --requests 5000 GET https://example.com/health
```

- `--concurrency n` (default 10, at most 500), `--duration 30s` (default 10s unless `--requests` is set; at most 10m) or `--requests n` (at most 1,000,000), `--rps n` to cap the rate and `--ramp 5s` to start workers gradually.
- `--fail-status 400` counts that status and above as failed (default 500), and `--reporter json` prints the result as JSON instead of text.
- `--max-p95 500ms` and `--max-error-rate 1%` set pass or fail thresholds: the command exits 1 when one is breached. Exit 1 also follows an interrupt and a run in which no request succeeded; 2 means bad input.
- Dynamic variables such as `{{$guid}}` are generated again for every request. Pre-request scripts and checks are not part of a load test, and cookies are not shared between workers.
- Load testing is not available in the web version, so the hosted proxy cannot be used to generate load.

## Secret scanner

`gostman scan <workspace | export.json>` looks for credentials typed into requests, environments, scripts and saved examples: well-known token formats (AWS, GitHub, Slack, Stripe, Google, private keys, JWTs), random-looking values in fields named like a credential, and literal passwords or tokens in auth settings. Values written as `{{variables}}` and placeholders are ignored.

```bash
gostman scan orders-api --fail-on high
```

- Findings are listed high before medium, then by location. Each shows at most the first four characters of a value, never the value, plus a short fingerprint that stays the same between runs.
- `--reporter text|json`, `--fail-on high|medium|none` (default `medium`; exit 1 when a finding is at or above it) and `--skip-examples`.
- It is a heuristic. It can miss a token glued to other characters, a human-chosen password that does not look random, and files outside the collection such as `.env`. A clean scan is not proof that nothing is exposed.
- The desktop and web apps have a **Scan for secrets** command, the Share tab warns before you create a link or file when something is found, and the Export tab shows a notice.

## Linting an OpenAPI spec

`gostman lint <file | address>` checks an OpenAPI 3.x or Swagger 2.0 document (JSON or YAML) against 23 built-in rules: missing operation ids or descriptions, undeclared path parameters, missing error responses, undefined security schemes, broken `$ref`s and similar.

```bash
gostman lint openapi.yaml --reporter junit --fail-on warning
```

- `--reporter text|json|junit`, `--fail-on error|warning|none` (default `error`).
- `--config file` or a `.gostman/lint.yaml` in the current folder turns rules off or changes their severity under `rules:`.
- The spec viewer has a **Lint** tab in the desktop and web apps.

## Generated documentation

`gostman docs` writes one self-contained HTML page. Descriptions on requests, folders and collections are rendered as Markdown (headings, lists, code, tables, links to http, https and mailto; raw HTML is always escaped). `--playground` adds a **Try it** panel to each request that sends it from the reader's own browser; secrets are left empty for the reader, and the API must allow cross-origin calls from the page.

## Local relay for the web app

`gostman relay` runs the web app's relay on your computer, so the web app reaches `localhost` and private addresses and its requests go nowhere but to the hosts you call.

```bash
gostman relay --port 4030
```

It prints its address, such as `http://127.0.0.1:4030`. In the web app, open **Preferences**, **Privacy**, choose **Local relay on this computer**, enter that address and press **Test**. Every request, OpenAPI or import fetch and OAuth 2.0 token request then goes through it; WebSocket connections and AI providers are still called straight from the browser. The browser may ask whether the page may reach apps on this device; allow it. Press Ctrl+C to stop the relay.

- `--port n` picks the port. Without it a free port is chosen each time, so pass `--port` to keep the same address in the web app.
- It listens on `127.0.0.1` only and refuses requests addressed to any other host name, so other machines and DNS rebinding cannot reach it.
- Only the Gostman web app (`https://gostman.com`), pages served from `localhost` or `127.0.0.1`, and programs on your computer that send no `Origin` header may use it. A browser page from any other site gets no CORS permission and a 403, so it is not an open proxy for websites you visit. `--origin https://gostman.example.com` (repeatable) allows a copy of the web app served from another address.
- Requests get the desktop app's limits rather than the hosted relay's: private and loopback addresses are allowed and responses are read up to 50 MB. It never reads files and never starts local MCP commands.
- Behind a corporate proxy, a private certificate authority or a server that asks for a client certificate, start it with the same network flags as `run`: `--cacert`, `--client-cert` with `--client-key`, `--client-cert-pass-env`, `--proxy` and `--noproxy`. They apply to every request, gRPC call and OAuth 2.0 token request the web app sends through the relay. Without `--proxy`, `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` are used.
- Anything allowed to use it can send requests from your computer, so stop it when you are done, and do not add origins you do not control.

## Import and export

```bash
gostman import postman_collection.json --out orders-api
gostman import insomnia.yaml --format insomnia --out orders-api
gostman import traffic.har --skip-static --out orders-api
gostman export orders-api --format postman --out orders.postman_collection.json
gostman export orders-api --format bruno --out orders-bruno
gostman export orders-api --format curl --out requests.sh
```

- `import <file | folder> --out <folder>` creates a workspace from a Postman, Insomnia, Bruno, HAR, WSDL, OpenAPI/Swagger, Gostman export or `.http` file, or a folder such as a Bruno collection. `--format auto|insomnia|har|wsdl|bruno|postman|openapi|gostman|http` (default `auto`, detected from the content; `gostman` is an export file from the desktop or web app). `--skip-static` leaves images, fonts, styles and scripts out of a HAR file; `export` does not take it. It prints what was imported, with warnings and skipped items on stderr.
- Imports add data only. Scripts and OAuth settings are kept and reported; tokens and cookie values are never carried over. The values of variables marked secret, such as Postman `secret` variables, are not written to the workspace; they stay marked secret, and `import` lists the ones that had a value so you can set them in the desktop app (kept in the system keychain) or pass them with `--var`, `--var-from-env` or `--env-file`. Secret globals become empty collection variables in `gostman.yaml`, which has no keychain, so pass those with the same flags, or move them to an environment in the desktop app and mark them secret there. `--out` must be a new or empty folder, so `import` cannot add to a workspace that `init` created; import into a new folder, or add requests from a coding agent with the `import_requests` tool. The files are created readable by you only.
- `export <workspace> --format <format> --out <path>` writes `postman` (Collection v2.1 with the collection variables, see [Back to Postman](coming-from-postman.md#back-to-postman)), `bruno` (a folder of `.bru` files), `openapi`, `curl` (a shell script that lists the environment variables to set at the top), `har` or `http` (`.http` files for VS Code REST Client and JetBrains HTTP Client). `--out` is a file, or a folder when the export has several files.
- Passwords, tokens and secret-named headers or variables become `{{NAME}}` placeholders named after the field, such as `{{TOKEN}}` or `{{X_API_KEY}}`; the same value used by several requests gets one placeholder, and they re-import as empty variables. A value that already uses a variable, such as `Bearer {{API_TOKEN}}`, is kept as written. `--include-secrets` writes the literal values instead and prints a warning; `import` does not take it.

## Docker and CI

```bash
docker run --rm -v "$PWD:/workspace" -e API_TOKEN ghcr.io/kunalgoesbyken/gostman run api --var-from-env API_TOKEN
```

New releases publish `ghcr.io/kunalgoesbyken/gostman` for `linux/amd64` and `linux/arm64`, tagged with the version and `latest`. The image is distroless, static and runs as a non-root user. `docker build -t gostman .` builds the same image from the repository. In GitHub Actions:

```yaml
- uses: kunalgoesbyken/gostman@main
  with:
    collection: api
    reporter: junit
    output: report.xml
```

[CI recipes](ci.md) has exit codes, reports, secrets, and GitLab CI, Jenkins and plain GitHub Actions recipes.
