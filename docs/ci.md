# Gostman in CI

`gostman run` sends every request of a workspace folder or export with its scripts, checks, extraction rules, cookies and OAuth 2 tokens. It needs no runtime, only the single binary.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | every request and check passed |
| 1 | a check or a script failed, or the run was interrupted |
| 2 | the command or the input is wrong |
| 3 | a request got no response: it could not be sent, the connection failed or timed out |

A run with both kinds of failure exits 3.

A 4xx or 5xx status alone is not a failure. Add a check such as `res.status equals 200` to the request.

## Secrets

Keep secrets out of the collection. Map them to variables from the job environment:

```bash
gostman run api --env CI --var-from-env API_TOKEN --redact
```

`--redact` replaces variable values and credentials in the report with `{{name}}`. HTML reports include each request and response body, and so does a JSON report written in the same run as an HTML one, so redact before sharing them.

## Reports

| Flag | Result |
| --- | --- |
| `--reporter text` | readable summary on stdout (default) |
| `--reporter junit --output report.xml` | JUnit XML for test dashboards |
| `--reporter json --output report.json` | machine-readable results; each result has the URL as written (`url`) and as sent (`resolvedUrl`, secrets shown as `{{name}}`) |
| `--reporter html --output report.html` | one self-contained page, with a filter for failures |

With `--output`, the report goes to the file and the text summary is still printed.

To write several reports in one run, repeat `--reporter` as `format:file`:

```bash
gostman run api --reporter text --reporter junit:report.xml --reporter html:report.html
```

At most one reporter can go without a file, and it prints to stdout. When every report goes to a file, the text summary is printed.

## Contract checks

`--contract` checks every response against an OpenAPI spec, so a changed status code, a new content type or a field that became `null` fails the job even when no assertion covers it:

```bash
gostman run api --env CI --contract openapi.yaml --reporter junit:report.xml
```

Contract checks appear with the other checks in every report format; in JUnit XML each check is a test case. See [Contract checks](import-export-and-specs.md#contract-checks) for what is compared.

## Proxies and certificates

Behind a corporate proxy or in front of an API that needs a client certificate, pass the files to `run`, `send` or `load`:

```bash
gostman run api --cacert corp-ca.pem --client-cert client.pem --client-key client-key.pem \
  --proxy http://proxy.corp.example:3128 --noproxy localhost,*.internal.example.com
```

| Flag | Effect |
| --- | --- |
| `--cacert <file>` | trusts the PEM or DER certificates in the file as well as the system's (repeatable) |
| `--client-cert <file> --client-key <file>` | presents this PEM certificate to every host |
| `--client-cert <file>` | presents a PFX/P12 file, or a PEM file that holds the key, to every host |
| `--client-cert <host>=<cert>,<key>` or `<host>=<file.p12>` | presents it to that host only; `*.example.com` covers subdomains (repeatable) |
| `--client-cert-pass-env <NAME>` | reads the passphrase of encrypted keys and PFX/P12 files from this environment variable |
| `--proxy <url>` | sends through this `http`, `https` or `socks5` proxy |
| `--noproxy <hosts>` | comma-separated hosts that skip `--proxy` |

Without `--proxy`, the `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` variables of the job are used. gRPC, OAuth 2 token requests and `sendRequest` in scripts go through the same proxy and certificates. A workspace's `network` section in `gostman.yaml` applies too, and the flags win over it. Write certificates from CI secrets to files at the start of the job, keep the passphrase in a secret variable, and pass its name: `--client-cert client.p12 --client-cert-pass-env CLIENT_CERT_PASSPHRASE`. A missing file, a file that is not a certificate, or a wrong or missing passphrase exits 2 before anything is sent.

## GitHub Actions

The composite action at the root of this repository installs the CLI and runs a collection.

```yaml
name: API tests
on: [push, pull_request]

jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kunalgoesbyken/gostman@main
        with:
          collection: api
          environment: CI
          reporter: junit
          output: report.xml
          extra-args: --var-from-env API_TOKEN
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: gostman-report
          path: report.xml
```

Pin the action to a release tag or a commit once you depend on it. Inputs: `collection`, `version`, `environment`, `folder`, `data`, `reporter`, `output`, `redact`, `bail`, `extra-args`. Outputs: `exit-code`, `report`. The step fails when the exit code is not 0, so use `if: always()` on steps that publish the report.

Without the action:

```yaml
      - run: |
          curl -fsSL -o gostman.tar.gz https://github.com/kunalgoesbyken/gostman/releases/latest/download/gostman-cli-linux-amd64.tar.gz
          tar -xzf gostman.tar.gz
          ./gostman run api --env CI --var-from-env API_TOKEN --reporter junit --output report.xml
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
```

## Run against the mock server

To run the collection without reaching the real API, serve its saved examples with `gostman mock` and point an environment at it. [`examples/todo-api`](../examples/todo-api) has an example for every request and a `Mock` environment whose `base_url` is `http://127.0.0.1:4010`:

```yaml
      - run: |
          curl -fsSL -o gostman.tar.gz https://github.com/kunalgoesbyken/gostman/releases/latest/download/gostman-cli-linux-amd64.tar.gz
          tar -xzf gostman.tar.gz
          ./gostman mock examples/todo-api --port 4010 > mock.log 2>&1 &
          curl --silent --fail --retry 20 --retry-connrefused --retry-delay 1 -o /dev/null http://127.0.0.1:4010/todos/1
          ./gostman run examples/todo-api --env Mock --reporter junit --output report.xml
```

- `gostman mock` runs until it is stopped, so `&` starts it in the background. The runner stops it when the job ends.
- The `curl` line waits until the mock answers one of its routes. Without it, the first requests can fail while the mock is still starting.
- The action runs the collection as soon as it has installed the CLI, so this recipe downloads the CLI itself.
- The mock listens on `127.0.0.1` only and refuses other `Host` headers. Start it in the same job as `gostman run`, not in a service container.
- `mock.log` lists every request the mock answered. Upload it with the report when a run fails.

An example can echo what the request sent, as `Create a todo` does with `{{request.body.json.title}}`, so checks that compare against variables and runs with `--data` pass against the mock too. A run against the mock tests the collection, its scripts and its checks, not the API. To test your own service without its dependencies, mock the API it calls, start the service pointed at the mock, then run the collection against the service. Templating and the other mock options are in [Folders, mock server and capture](workspaces-and-mock.md#examples-and-the-mock-server-desktop).

## GitLab CI

```yaml
api-tests:
  image: alpine:3.20
  before_script:
    - apk add --no-cache curl
    - curl -fsSL -o gostman.tar.gz https://github.com/kunalgoesbyken/gostman/releases/latest/download/gostman-cli-linux-amd64.tar.gz
    - tar -xzf gostman.tar.gz
  script:
    - ./gostman run api --env CI --var-from-env API_TOKEN --reporter junit --output report.xml
  artifacts:
    when: always
    reports:
      junit: report.xml
```

Set `API_TOKEN` as a masked CI/CD variable.

## Jenkins

```groovy
pipeline {
  agent any
  environment {
    API_TOKEN = credentials('api-token')
  }
  stages {
    stage('API tests') {
      steps {
        sh '''
          curl -fsSL -o gostman.tar.gz https://github.com/kunalgoesbyken/gostman/releases/latest/download/gostman-cli-linux-amd64.tar.gz
          tar -xzf gostman.tar.gz
          ./gostman run api --env CI --var-from-env API_TOKEN --reporter junit --output report.xml
        '''
      }
    }
  }
  post {
    always {
      junit 'report.xml'
    }
  }
}
```

A non-zero exit code fails the stage, and `post { always }` still publishes the results.

## Docker

New releases publish `ghcr.io/kunalgoesbyken/gostman` for `linux/amd64` and `linux/arm64`, tagged with the version and `latest`; pin the version tag in pipelines. It holds a static `gostman` in a distroless image that runs as a non-root user. No secrets are baked in.

```bash
docker run --rm -v "$PWD:/workspace" -e API_TOKEN ghcr.io/kunalgoesbyken/gostman run api --env CI --var-from-env API_TOKEN
```

The `Dockerfile` at the root of the repository builds the same image: `docker build -t gostman --build-arg VERSION=1.7.1 .`

The container works in `/workspace`. The mounted folder must be readable by the image user (uid 65532), and writable if reports are written there. The image has no shell, so pass the arguments to `gostman` directly, as `docker run` does above. It cannot be the job image of a GitLab CI job, because GitLab runs `script:` lines in a shell; use the [GitLab CI](#gitlab-ci) recipe there.
