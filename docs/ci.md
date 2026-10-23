# Gostman in CI

`gostman run` sends every request of a workspace folder or export with its scripts, checks, extraction rules, cookies and OAuth 2 tokens. It needs no runtime, only the single binary.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | every request and check passed |
| 1 | a request or a check failed |
| 2 | the command or the input is wrong |

A 4xx or 5xx status alone is not a failure. Add a check such as `res.status equals 200` to the request.

## Secrets

Keep secrets out of the collection. Map them to variables from the job environment:

```bash
gostman run api --env CI --var-from-env API_TOKEN --redact
```

`--redact` replaces variable values and credentials in the report with `{{name}}`. HTML and JSON reports include response bodies, so redact before sharing them.

## Reports

| Flag | Result |
| --- | --- |
| `--reporter text` | readable summary on stdout (default) |
| `--reporter junit --output report.xml` | JUnit XML for test dashboards |
| `--reporter json --output report.json` | machine-readable results |
| `--reporter html --output report.html` | one self-contained page, with a filter for failures |

With `--output`, the report goes to the file and the text summary is still printed.

To write several reports in one run, repeat `--reporter` as `format:file`:

```bash
gostman run api --reporter text --reporter junit:report.xml --reporter html:report.html
```

At most one reporter can go without a file, and it prints to stdout. When every report goes to a file, the text summary is printed.

## Proxies and certificates

Behind a corporate proxy or in front of an API that needs a client certificate, pass the files to `run`, `send` or `load`:

```bash
gostman run api --cacert corp-ca.pem --client-cert client.pem --client-key client-key.pem \
  --proxy http://proxy.corp.example:3128 --noproxy localhost,*.internal.example.com
```

| Flag | Effect |
| --- | --- |
| `--cacert <file>` | trusts the PEM certificates in the file as well as the system's (repeatable) |
| `--client-cert <file> --client-key <file>` | presents this PEM certificate to every host |
| `--client-cert <host>=<cert>,<key>` | presents it to that host only; `*.example.com` covers subdomains (repeatable) |
| `--proxy <url>` | sends through this `http`, `https` or `socks5` proxy |
| `--noproxy <hosts>` | comma-separated hosts that skip `--proxy` |

Without `--proxy`, the `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` variables of the job are used. OAuth 2 token requests and `sendRequest` in scripts go through the same proxy and certificates. Keys must be unencrypted PEM; convert a `.p12` or `.pfx` file with `openssl pkcs12 -in client.p12 -nodes -out client.pem`. Write certificates from CI secrets to files at the start of the job, not into the repository. A missing file or one without PEM data exits 2 before anything is sent.

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

The container works in `/workspace`. The mounted folder must be readable by the image user (uid 65532), and writable if reports are written there. The image has no shell, so pass the arguments to `gostman` directly.

Use it in a pipeline as the job image:

```yaml
api-tests:
  image:
    name: ghcr.io/kunalgoesbyken/gostman:latest
    entrypoint: [""]
  script:
    - gostman run api --env CI --var-from-env API_TOKEN
```

The distroless image has no shell, so GitLab jobs that need `script:` lines require a shell-based image. Use the download recipe above in that case.
