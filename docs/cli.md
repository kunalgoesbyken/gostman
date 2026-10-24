# Command line

Each release includes `gostman-cli-<os>-<arch>` archives with a single `gostman` binary. It can also be built with `go build ./cmd/gostman`.

```bash
gostman run orders-api --env CI --var-from-env API_TOKEN --reporter junit --output report.xml
gostman send --workspace orders-api "Create user" --select '$.id'
gostman mock orders-api --port 4010
gostman capture --upstream https://api.example.com --workspace orders-api
gostman docs orders-api --output docs.html
gostman import postman_collection.json --out orders-api
gostman export orders-api --format openapi --out openapi.json
```

- `run` takes a workspace folder or a Gostman export and sends every request in order with its scripts, extraction rules, cookies, OAuth 2.0 tokens and checks. It exits 0 when everything passed, 1 when a request or a check failed and 2 when the command or input is wrong. A 4xx or 5xx status alone is not a failure; add a check such as `res.status equals 200`.
- `send` sends one saved request, or an ad hoc one (`gostman send GET https://example.com -H 'Accept: application/json'`), and prints a short JSON summary followed by the body.
- `mock` serves the saved examples of a workspace on `127.0.0.1`; `--openapi spec.yaml|url` serves a spec's operations instead or as well, `--delay`, `--delay-max`, `--error-rate` and `--error-status` add latency and failures, and `--log` prints each request's headers and body with credentials masked.
- `capture` forwards everything sent to `127.0.0.1:4020` on to one API, prints each call, and with `--workspace` saves each new method and path as a request with its response as an example.
- `docs` writes the collection as one self-contained HTML page.
- `import` and `export` convert a workspace from and to other tools' formats; see [Import and export](#import-and-export).
- `--var name=value` sets a variable and `--var-from-env NAME` reads it from the environment, so secrets stay out of the files. `--redact` replaces variable values and credentials in a report with `{{name}}`.
- Secret managers: an environment variable can read its value from HashiCorp Vault (KV 1 and 2), AWS Secrets Manager, Azure Key Vault, Google Cloud Secret Manager, 1Password, Bitwarden or Bitwarden Secrets Manager. The collection stores only a reference (connection name, path, field, version); the connection is yours. Connections named `vault`, `aws`, `azure` or `gcp` read the standard variables: `VAULT_ADDR`, `VAULT_TOKEN` (or `VAULT_ROLE_ID` with `VAULT_SECRET_ID`), `VAULT_NAMESPACE`; `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`; `AZURE_KEYVAULT_URL` with `AZURE_ACCESS_TOKEN` or `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`; `GOOGLE_OAUTH_ACCESS_TOKEN` (for example from `gcloud auth print-access-token`) and `GOOGLE_CLOUD_PROJECT`. Connections named `onepassword`, `bitwarden` or `bitwarden-secrets` run `op`, `bw` or `bws` and read `OP_SERVICE_ACCOUNT_TOKEN` and `OP_ACCOUNT`; `BW_SESSION`; `BWS_ACCESS_TOKEN` and `BWS_SERVER_URL`. `GOSTMAN_SECRETS_<NAME>_COMMAND` says where the tool is when it is not on the `PATH`. A connection named after its kind is used only when at least one of its variables is set; otherwise declare it with `GOSTMAN_SECRETS_<NAME>_KIND`. KeePassXC connections only work in the desktop app. Another name such as `prod-vault` is set up with `GOSTMAN_SECRETS_PROD_VAULT_KIND=vault` plus `GOSTMAN_SECRETS_PROD_VAULT_ADDRESS`, `..._TOKEN` and so on. Secret references are only read when the run opts in with `--secrets` (credentials from the process environment) or `--secrets-env-file secrets.env` (the same variables from a KEY=value file; the process environment wins), so a collection you did not write cannot use the credentials of your shell or CI job. A reference that cannot be read stops the run before anything is sent. Values are replaced in `--redact` reports and in `send` and `mcp` output. Even with the flag, a collection chooses which paths are read, so only pass it for collections you trust. The apps resolve references in the desktop app only, from connections set up under Secret managers; the web version cannot reach them.
- Data-driven runs: `--data users.csv` (header row, UTF-8, quoted fields may hold commas and line breaks) or `--data users.json` (an array of objects) runs the whole collection once per row. A row's columns become variables and override the environment and `--var`; every value from a CSV is text. `iteration` (from 1) and `iterationCount` are set for scripts and `{{iteration}}` in requests. `--iterations n` repeats a run n times, or uses only the first n rows. Each iteration starts from the environment's variables again.
- Parallel runs: `--parallel n` sends up to n at once. With several iterations, whole iterations run side by side and each keeps its own order and extraction chaining. With one iteration, single requests run side by side and do not see each other's extracted variables, so use it for independent requests. Cookies and OAuth 2 tokens are shared between workers, and a token is fetched once.
- Tags: `--tags smoke,api` runs only requests that have at least one of the tags (a request also has the tags of the folders it is in), and `--exclude-tags slow` skips requests that have any of them. Both take a comma list and can be repeated, ignore case, and combine with `--folder` and `--only`: a request runs only when it passes every filter. When nothing is left, the run exits 2.
- `--allow-files` lets `{{$file(path)}}` and `{{$fileBase64(path)}}` read files for `run`, `send` and `load`; paths start at the workspace folder or the folder of the export file, or the current folder for a request given as a method and a URL, and cannot leave it. It is off by default, so a collection you did not write cannot send your files. See [Reading files](variables.md#reading-files).
- Other run flags: `--only "Folder/Name"` (name, id or path, repeatable), `--bail`, `--delay ms`, `--timeout ms`, `--env-file .env` (KEY=value lines, `--var` wins), `--stream-timeout s` (time budget for each streaming (SSE) request, default 10 seconds) and `--insecure`, which is off unless you pass it.
- Proxies and certificates: `run`, `send` and `load` take `--cacert ca.pem` (trusted as well as the system's certificates; repeatable), `--client-cert cert.pem --client-key key.pem` (presented to every host), `--client-cert api.example.com=cert.pem,key.pem` (presented to that host only; `*.example.com` covers subdomains; repeatable), `--proxy http://user:pass@proxy:8080` (`http`, `https` or `socks5`) and `--noproxy localhost,*.internal.example.com` (hosts that skip `--proxy`). Without `--proxy`, the standard `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` variables are used; Go never sends `localhost` or `127.0.0.1` through them. Files are PEM and keys must not be passphrase-protected; PKCS#12 (`.p12`, `.pfx`) is not read, so convert it with `openssl pkcs12 -in client.p12 -nodes -out client.pem`. The same settings apply to OAuth 2 token requests and to `sendRequest` in scripts. A missing file, or one without valid PEM data, exits 2 before anything is sent. gRPC requests do not use them.
- Reports: `--reporter text|json|junit|html`, or `format:file` to write that report to a file. Repeat it to write several reports in one run: `--reporter text --reporter junit:report.xml --reporter html:report.html`. At most one reporter can go without a file, and it prints to stdout; when every report goes to a file, the text summary is printed. `--output file` names the file of the reporter given without one, so `--reporter junit --output report.xml` works as before. `--reporter html:report.html` writes one self-contained page with a summary, every request's timing, checks, request and response, and a filter for failures; response bodies are included, so add `--redact` before sharing it. The desktop and web runner dialogs take a data file and a parallel count the same way and can download the same report; there, iterations run one after another and the parallel count applies inside each. Colour is off when `NO_COLOR` is set or the output is not a terminal.
- On macOS the binary is not notarized: run `xattr -d com.apple.quarantine gostman` once.

`gostman help` lists every flag.

With Go installed: `go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest`.


### Load testing

`gostman load` sends one request many times at once and reports throughput, latency percentiles (p50, p90, p95, p99), status codes and error samples. Only target systems you own or have permission to test.

```bash
gostman load orders-api --request "Orders/List" --concurrency 20 --duration 30s
gostman load --concurrency 50 --requests 5000 GET https://example.com/health
```

- `--concurrency n` (default 10, at most 500), `--duration 30s` (at most 10m) or `--requests n` (at most 1,000,000), `--rps n` to cap the rate and `--ramp 5s` to start workers gradually.
- `--max-p95 500ms` and `--max-error-rate 1%` set pass or fail thresholds: the command exits 1 when one is breached. Exit 1 also follows an interrupt and a run in which no request succeeded; 2 means bad input.
- Dynamic variables such as `{{$guid}}` are generated again for every request. Pre-request scripts and tests are not part of a load test, and cookies are not shared between workers.
- Load testing is not available in the web version, so the hosted proxy cannot be used to generate load.

### Secret scanner

`gostman scan <workspace | export.json>` looks for credentials typed into requests, environments, scripts and saved examples: well-known token formats (AWS, GitHub, Slack, Stripe, Google, private keys, JWTs), random-looking values in fields named like a credential, and literal passwords or tokens in auth settings. Values written as `{{variables}}` and placeholders are ignored.

```bash
gostman scan orders-api --fail-on high
```

- Findings show at most the first four characters of a value, never the value, plus a short fingerprint that stays the same between runs.
- `--reporter text|json`, `--fail-on high|medium|none` (default `medium`; exit 1 when a finding is at or above it) and `--skip-examples`.
- It is a heuristic. It can miss a token glued to other characters, a human-chosen password that does not look random, and files outside the collection such as `.env`. A clean scan is not proof that nothing is exposed.
- The desktop and web apps have a **Scan for secrets** command, and the Share and Export tabs warn before you create a link or file when something is found.

### Linting an OpenAPI spec

`gostman lint <file | address>` checks an OpenAPI 3.x or Swagger 2.0 document (JSON or YAML) against 23 built-in rules: missing operation ids or descriptions, undeclared path parameters, missing error responses, undefined security schemes, broken `$ref`s and similar.

```bash
gostman lint openapi.yaml --reporter junit --fail-on warning
```

- `--reporter text|json|junit`, `--fail-on error|warning|none` (default `error`).
- `--config file` or a `.gostman/lint.yaml` in the current folder turns rules off or changes their severity under `rules:`.
- The spec viewer has a **Lint** tab in the desktop and web apps.

### Generated documentation

`gostman docs` writes one self-contained HTML page. Descriptions on requests, folders and collections are rendered as Markdown (headings, lists, code, tables, links to http, https and mailto; raw HTML is always escaped). `--playground` adds a **Try it** panel to each request that sends it from the reader's own browser; secrets are left empty for the reader, and the API must allow cross-origin calls from the page.

### Import and export

```bash
gostman import postman_collection.json --out orders-api
gostman import insomnia.yaml --format insomnia --out orders-api
gostman import traffic.har --skip-static --out orders-api
gostman export orders-api --format bruno --out orders-bruno
gostman export orders-api --format curl --out requests.sh
```

- `import <file | folder> --out <folder>` creates a workspace from a Postman, Insomnia, Bruno, HAR, WSDL, OpenAPI/Swagger or `.http` file, or a folder such as a Bruno collection. `--format auto|insomnia|har|wsdl|bruno|postman|openapi|http` (default `auto`, detected from the content). `--skip-static` leaves images, fonts, styles and scripts out of a HAR file. It prints what was imported, with warnings and skipped items on stderr.
- Imports add data only. Scripts and OAuth settings are kept and reported; tokens and cookie values are never carried over. `--out` must be a new or empty folder, and the files are created readable by you only.
- `export <workspace> --format <format> --out <path>` writes `bruno` (a folder of `.bru` files), `openapi`, `curl` (a shell script), `har` or `http` (`.http` files for VS Code REST Client and JetBrains HTTP Client). `--out` is a file, or a folder when the export has several files.
- Passwords, tokens and secret-named headers or variables become `{{NAME}}` placeholders, which re-import as empty variables. `--include-secrets` writes the literal values instead and prints a warning.

### Docker and CI

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
