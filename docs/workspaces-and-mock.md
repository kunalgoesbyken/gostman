# Folders, mock server and capture

## Folders and Git (desktop)

The control next to the logo shows where the collection lives. **Open folder** keeps it as files: `gostman.yaml`, one YAML file per request, one directory per folder and `environments/<name>.yaml`. When the folder you pick already holds other files, such as a repository root, the collection goes in a `gostman` folder inside it, the same place `gostman init` uses, and the workspace is listed under the name of the folder you picked.

- A YAML file is read as a request only when it has a `method` or `url` field, so other YAML files in the folder, such as Kubernetes manifests or CI workflows, are left out.
- A directory without a `folder.yaml` that holds no requests, such as `docs/` or `assets/`, is not shown in the sidebar.
- `order` in a request file and in `folder.yaml` places the item among everything in the same directory. With `sharedOrder: true` in `gostman.yaml`, requests and folders share one numbering, so a request with `order: 1` sits above a folder with `order: 2`; new workspaces and `gostman import` write it. Without it, as in folders made by older versions, each directory shows its folders first, until the first move or import, in the app or by an agent, writes the numbers and the marker. A new request or folder goes last.
- Collection variables shared by every request are `variables` in `gostman.yaml`. A top-level folder's `folder.yaml` can hold the collection's own as `collectionVariables`, which win over the shared ones for its requests, as in the app's own storage; their secret and off marks are `collectionVariablesMeta`, and secret values are never written. See [Environments per collection](variables.md#environments-per-collection).
- A request's tags are a list under `tags`, after `description`, for example `tags: [smoke, regression]`. Leading and trailing spaces are dropped, and a tag repeated with different case is kept once, in its first spelling. Files without `tags` load as before.
- OAuth tokens, cookies, history, network settings and open tabs are never written to the folder.
- Values typed into environments and auth fields are written as typed. Keep secrets in an environment file that Git ignores, or pass them at run time.
- Changes made outside the app, by a `git pull`, a branch switch or an editor, are picked up within a few seconds: the open folder's YAML files and its `.env` are checked every two seconds, and once they have stopped changing the collection is reloaded and a short notice says so. Hidden entries such as `.git/` and `.gostman/` are not watched, and the app's own saves do not count as changes.
- A tab with unsaved edits keeps them. When its request changed on disk, the tab shows **This request changed on disk while you were editing it** with **Keep my edits** (saving then overwrites the file) and **Load from disk** (drops the edits). When its file was deleted or can no longer be read, the tab keeps its content as an unsaved request.
- **Reload from disk** reloads at once and lists files that cannot be read; they are left untouched. After an automatic reload the notice only counts them.
- The open folder is not part of the app's [automatic backups](preferences-and-shortcuts.md#backups); its history is whatever you commit to Git.
- A folder you did not create opens with its scripts, OAuth 2.0 settings, local MCP commands and file reads switched off until you choose **Trust this folder**.

## Examples and the mock server (desktop)

Save any response as a named example from the response panel (up to 20 per request, 2 MB each; cookie and authorization headers are not kept). The mock server, opened with **Mock server** at the bottom of the window, serves each request's method and path with one of its examples on `127.0.0.1`.

![The mock server dialog running on port 4010, listing each route with the saved example it serves](../gostman-gui/frontend/src/assets/landing/mock.webp)

- `{{base_url}}/users/42` is served at `/users/42`; a literal base path such as `/v1` is kept. A path segment written `:id` or holding a variable, such as `/users/{{user_id}}`, matches any value, whatever the variable holds, and its value is available as `{{request.params.user_id}}`. A variable that holds several path segments, such as `api/v1`, is treated as one segment, so write those segments out in the URL instead.
- GraphQL, gRPC, MCP and WebSocket requests, and requests without an example, are not served. A call to the route of a request without an example answers 404 with a message that names the request and says to save one of its responses as an example; the log shows the request with **no example**.
- A route answers with the example chosen for it, or the default example. A request can ask for another example of the route with Postman's headers: `x-mock-response-name: Not found` picks the example with that name (case does not matter), `x-mock-response-code: 404` the first example with that status, and both together the example that matches both. When no example matches, the answer is a 404 that says so. Rules go first: a request that a rule matches gets the rule's answer.
- Examples travel with exports and workspace folders, so they can contain whatever the response body held.
- **From OpenAPI spec**: load a spec from an address or a file and every operation becomes a route (base path from `servers`, `{id}` segments typed by the spec, status codes, headers and example bodies from the spec). Operations without an example answer with an empty body.
- **Rules** run before the routes, in the order listed; the first match wins. A rule can match the method, a path template, query parameters, headers and JSON body values (`$.user.name`) and then override the status, headers and body, or only answer its Nth match.
- **Templating**: response bodies and headers can use `{{request.params.id}}`, `{{request.query.x}}`, `{{request.header.x}}`, `{{request.body.json.path}}` and the dynamic variables `{{$guid}}`, `{{$timestamp}}`, `{{$randomInt}}`. Missing values render empty, and values are escaped inside JSON responses.
- **Behavior**, for the whole server or one route or rule: a fixed or ranged delay, a slow body, and failures (an error status, a connection reset or an empty reply) at a chosen rate. CORS is off by default; when on, only localhost origins (any port, `127.0.0.1`, `[::1]`) are answered, and the CLI's repeatable `--cors-origin https://app.example.com` adds exact extra origins. Other origins get no CORS headers.
- **Log**: the last 500 requests with headers and body (up to 4 KB). Credential-like header names and query parameters show as `***`.
- Rules, per-route options and an imported spec are saved in `.gostman/mock.yaml` of a workspace folder, or in the app data folder otherwise. The server binds to `127.0.0.1` only, refuses other `Host` headers, never reads files, and caps request bodies at 10 MB, responses at 10 MB, routes at 10,000 and rules at 200.

## Capture (desktop and CLI)

Open **Capture** at the bottom of the window and start a capture with the address of your API, then point your app at `http://127.0.0.1:4020`. Gostman forwards each call, lists it, and lets you save any of them as a request with its response as an example.

![The capture dialog listing five forwarded calls with the response of one shown below](../gostman-gui/frontend/src/assets/landing/capture.webp)

1. Type the API your app talks to in **API to forward to**, such as `https://api.example.com`.
2. **Port** is the local port to listen on, 4020 unless you change it. Both fields are locked while the capture runs.
3. Press **Start**. The header shows **Running** and the local address; **Stop** ends the capture.

Each call appears as a row with its time, method, path, status, duration and size. Type in the filter to narrow the list by method, path or status. Select a row to see its request and response, body or headers, below the list; **Save as request** opens it in a new tab.

To save several calls at once, tick their rows (the box in the header ticks every row shown), choose a folder in **Folder to save into** and press **Save selected to folder**. The first choice is a top-level folder named after the API's host, created when needed; you can also pick **Top level** or any existing folder. Each call becomes a request with its response as an example, and repeated calls to the same method and path are saved once. **Clear** empties the list.

- It is a forwarding address for one API, not an intercepting proxy: there is no certificate to install, and an app whose base URL cannot be changed is not captured.
- `Authorization`, `Cookie` and `Proxy-Authorization` request headers are never saved. Bodies are saved as captured, so check them for tokens before sharing.
- Only requests from localhost pages are forwarded. On an Android emulator use `adb reverse tcp:4020 tcp:4020`.
