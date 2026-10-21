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

The repository has a `Dockerfile` that builds a static `gostman` into a distroless image that runs as a non-root user. No secrets are baked in.

```bash
docker build -t gostman --build-arg VERSION=1.4.0 .
docker run --rm -v "$PWD:/workspace" -e API_TOKEN gostman run api --env CI --var-from-env API_TOKEN
```

The container works in `/workspace`. The mounted folder must be readable by the image user (uid 65532), and writable if you use `--output` there. The image has no shell, so pass the arguments to `gostman` directly.

Use it in a pipeline as the job image:

```yaml
api-tests:
  image:
    name: registry.example.com/tools/gostman:1.4.0
    entrypoint: [""]
  script:
    - gostman run api --env CI --var-from-env API_TOKEN
```

The distroless image has no shell, so GitLab jobs that need `script:` lines require a shell-based image. Use the download recipe above in that case.
