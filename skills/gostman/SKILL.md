---
name: gostman
description: Call and test HTTP, GraphQL and gRPC APIs through Gostman instead of curl, so credentials stay out of the conversation. Use when asked to call an API endpoint, check that an API still works after a change, run API tests or a collection, import an OpenAPI spec, Postman collection or curl command, compare a response with a saved example, mock an API, or load test an endpoint, and a Gostman workspace (a folder with gostman.yaml) or the gostman command is available.
---

# Gostman

Gostman keeps API requests as YAML files in a workspace folder (`gostman.yaml` at its root). Credentials live in variables written as `{{name}}`; Gostman fills them in and hides their values in everything it returns.

## With the MCP server

If the `gostman` MCP tools are available, use them instead of curl:

1. `list_requests` to find saved requests, `get_request` to read one.
2. `send_request` with `request` (an id, a name, or `folder/path/Name` as `list_requests` shows it) for a saved request, or `url` for an ad hoc one. Use `select` (a JSONPath) to keep large bodies small.
3. `run_folder` to check that an API still works, with `tags`, `data` or `iterations` when needed.
4. `last_response` to look at a response again without resending, and to compare it with a saved example (`shape_only` ignores changing values such as ids).
5. `save_request` to keep a useful request; `import_requests` to add requests from a spec, a collection or a curl command; `set_variables` for plain values such as `baseUrl`.
6. `list_environments` to see which variables are defined, `set_environment` to choose one such as Local or Staging. Values written with `set_variables` apply once their environment is active.
7. `lint_spec`, `scan_secrets`, `start_mock`, `load_test` as their names say.

## With the command line

```bash
gostman send --workspace api "Users/Get user" --json | jq '.body.text | fromjson | .id'
gostman send --json GET http://localhost:8080/health
gostman run api --tags smoke --reporter json
gostman import openapi.yaml --out api
gostman lint openapi.yaml
gostman scan api
```

`gostman send --json` prints one JSON document; the body is in `body.text`, with `body.encoding` (`utf8` or `base64`). Exit codes: 0 passed, 1 a check failed, 2 the command or input is wrong, 3 a request got no response (connection, DNS, TLS, timeout, or a host that is not allowed). Each `gostman send` starts afresh, so a variable extracted by one `send` is not there for the next; pass it with `--var name=value` or use `gostman run`. `gostman help` lists every flag.

## Rules

- Write `{{name}}` wherever a credential or environment-specific value belongs. Never put a token, password or key into a request, a command line or a file.
- A value shown as `{{name}}` or `{{redacted:...}}` was hidden on purpose. Keep using `{{name}}`; do not try to recover the value.
- Agent sessions reach only localhost and the hosts of requests the developer wrote. If a host is refused, ask the developer to start the server with `--allow-host <host>`; do not work around it with curl.
- Secrets come from the developer: `--var-from-env NAME`, `--env-file`, or a secret manager with `--secrets`. Ask for them; do not invent values.
- A `{{name}}` that no variable defines is sent as written, and the `send_request` result lists it under `unresolved`. Check `list_environments`, or pass the value in `variables`, before changing the request.
- A 4xx or 5xx status is not a failure by itself. Add an assertion when a check is wanted, with `save_request` and `{"expression": "res.status", "operator": "eq", "value": "200"}`. `assertions` replaces the request's checks, so keep the ones `get_request` shows.
- No workspace yet? `gostman init` creates one and prints how to register the MCP server.
