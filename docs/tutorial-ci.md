# Tutorial: run your API tests in CI

This tutorial takes a collection that passes on your machine and runs it on every pull request in GitHub Actions, with the API token kept in the repository's secrets rather than in the files. It uses [`examples/auth-and-secrets`](../examples/auth-and-secrets), which calls [httpbin](https://httpbin.org) and accepts any token. [Gostman in CI](ci.md) has the same steps for GitLab CI, Jenkins and Docker.

## 1. Keep the secret out of the files

Open `Protected/folder.yaml` in the example. The folder sets bearer auth for every request in it, and the token is a variable, not a value:

```yaml
auth:
  type: bearer
  token: "{{API_TOKEN}}"
```

No environment defines `API_TOKEN`. It is supplied when the collection runs, so it never reaches Git. In the app, mark such a variable as **Secret** with its lock instead; its value goes to the operating system keychain and is left out of the files. See [Secret variables](variables.md#secret-variables).

## 2. Run it locally

```bash
export API_TOKEN=any-token PASSWORD=any-password
gostman run examples/auth-and-secrets --env Public --var-from-env API_TOKEN --var-from-env PASSWORD
```

`--var-from-env API_TOKEN` reads the shell variable of that name and makes it available as `{{API_TOKEN}}`. Every request passes.

## 3. Make a missing secret fail the run

Run the same command without the two `--var-from-env` flags. The requests are still sent, with the text `{{API_TOKEN}}` as the token, because a variable that is not defined is left as written. The example catches that with a post-response script:

```js
test("API_TOKEN was supplied at run time", () => {
  expect(env.get("API_TOKEN")).to.be.a("string").and.not.be.empty
})
```

```
FAIL  GET      Protected/Check the token  200 OK  957 ms  2/3 tests
      FAIL  API_TOKEN was supplied at run time
            expected undefined to be a string
```

The command exits with `1`, so a pipeline with a missing secret fails instead of passing against the wrong credentials. Put this check on the collection's settings to cover every request.

## 4. Add the workflow

Add the secret to the repository under **Settings**, **Secrets and variables**, **Actions**, then commit `.github/workflows/api-tests.yml`:

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
          collection: examples/auth-and-secrets
          environment: Public
          reporter: html
          output: report.html
          redact: true
          extra-args: --var-from-env API_TOKEN --var-from-env PASSWORD
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
          PASSWORD: ${{ secrets.PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: api-report
          path: report.html
```

The action installs the command line and runs the collection. `if: always()` uploads the report when the tests fail, which is when you need it.

## 5. Read the report

Open the run in the **Actions** tab and download **api-report**. The HTML page shows every request with its timing, checks, request and response, and a filter for failures. `redact: true` replaced the token and password with `{{API_TOKEN}}` and `{{PASSWORD}}`, so the report can be shared. Response bodies are still included.

For a test dashboard, use `reporter: junit` with `output: report.xml` and a JUnit reporting action instead.

## Next steps

- Check the collection for credentials typed into it before each commit with `gostman scan`. See [Command line](cli.md#secret-scanner).
- Read secrets from HashiCorp Vault, AWS, Azure, Google Cloud, 1Password or Bitwarden instead of CI variables. See [Secret managers](variables.md#secret-managers).
- Run the collection once per row of a data file with `data: users.csv`.
