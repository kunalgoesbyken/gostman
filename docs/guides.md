# Guides by task

Short recipes for common jobs. Each one lists the steps and links to the reference page with every option. New to Gostman? Start with the [tutorial](tutorial-first-collection.md).

## Move a collection from Postman, Insomnia or Bruno

In the app, choose **Import** in the sidebar (or on the welcome panel) and drop the export file or folder. From the command line:

```bash
gostman import postman_collection.json --out api
gostman run api
```

- Requests, folders, environments, auth, examples and scripts come across. Common Postman script calls such as `pm.test`, `pm.expect`, `pm.environment.set` and `pm.response.json()` are rewritten to Gostman's script API, and so are Bruno calls such as `bru.setEnvVar`, `bru.getVar`, `bru.runRequest`, `bru.sendRequest` and `bru.sleep`. The import summary lists anything that was left out or needs a look.
- Tokens and cookie values are never imported, and imports never switch off TLS verification. Sign in again where a request needs a token.
- Export back with `gostman export api --format bruno --out bruno-api`, or `openapi`, `curl` and `har`.

Reference: [Import, export and OpenAPI specs](import-export-and-specs.md). Moving from Bruno: [Coming from Bruno](coming-from-bruno.md).

## Work on a frontend before the backend exists

1. Save one response per endpoint as an example: in the response panel, choose **Save as example**. Edit its body to the shape you agreed on.
2. Start the mock server from the header, or run `gostman mock api --port 4010`.
3. Point the frontend at `http://127.0.0.1:4010`.

With only an OpenAPI spec, `gostman mock --openapi openapi.yaml` serves every operation from it. Add delays and error rates with `--delay` and `--error-rate` to see how the interface handles a slow or failing API.

Reference: [Folders, mock server and capture](workspaces-and-mock.md).

## Turn an app's real traffic into a collection

When an app already talks to an API but nobody wrote the requests down:

```bash
gostman capture --upstream https://api.example.com --workspace api
```

Point the app at `http://127.0.0.1:4020`. Each new method and path is saved as a request with its response as an example. `Authorization` and `Cookie` headers are not saved; check bodies for tokens before sharing.

Reference: [Capture](workspaces-and-mock.md#capture-desktop-and-cli).

## Keep a collection in Git with the code

1. On the desktop app, open the storage menu in the header and choose **Save collection to folder**, inside your repository.
2. Commit the folder. Each request is one YAML file, so reviews show which request changed and how.
3. Keep secrets out: mark variables as **Secret**, or pass them at run time with `--var-from-env`. Run `gostman scan api` before committing.
4. Teammates open the same folder with **Open folder** and choose **Reload from disk** after a pull.

Reference: [Collections and Git](collections-and-git.md) and [Secrets and network](secrets-and-network.md).

## Test an API on every pull request

Add checks to each request, then run the folder in CI with `gostman run` or the GitHub Action. The command exits with `1` when a check fails.

Walk-through: [Tutorial: run your API tests in CI](tutorial-ci.md). Reference: [Gostman in CI](ci.md).

## Test with many inputs

Put the inputs in a CSV or JSON file, reference the columns as `{{column}}` and run once per row:

```bash
gostman run api --data users.csv --parallel 4 --reporter html --output report.html
```

Text in any language works in CSV values; save the file as UTF-8.

Reference: [Runner, load tests and secret scanning](runner-load-and-scan.md).

## Check how an endpoint behaves under load

```bash
gostman load api --request "Orders/List" --concurrency 20 --duration 30s --max-p95 500ms
```

The command reports throughput and latency percentiles and exits with `1` when a threshold is breached. Only load test systems you own or have permission to test.

Reference: [Load testing](cli.md#load-testing).

## Publish documentation for an API

Write descriptions on requests, folders and the collection in Markdown, then:

```bash
gostman docs api --output docs.html --playground
```

The result is one HTML file you can host anywhere. `--playground` adds a **Try it** panel to each request.

Reference: [Sharing and generated documentation](sharing-and-docs.md).

## Send requests to a teammate

Choose **Share folder** in a folder's menu, or the **Share** tab of the import dialog for the whole collection. The link carries the requests encrypted in the part of the address after `#`, which browsers do not send to any server, so nothing is uploaded. Variable values and saved responses are left out unless you tick them; add a passphrase for anything sensitive.

Reference: [Sharing and generated documentation](sharing-and-docs.md).

## Let a coding agent call your API

```bash
claude mcp add gostman -- gostman mcp --workspace api --var-from-env API_TOKEN
```

The agent sends requests from the collection without seeing the token, and it can only reach hosts the collection already uses. Requests it saves appear as YAML files you can review.

Reference: [Use from a coding agent](agents.md).

## Call gRPC, GraphQL, WebSocket or an MCP server

Choose the method **GRPC**, **GRAPHQL** or **MCP** in the request bar, or enter a `ws://` or `wss://` address for WebSocket. GraphQL and gRPC load the schema from the server when it allows introspection or reflection; otherwise add the `.proto` files.

Reference: [Protocols](protocols.md).
