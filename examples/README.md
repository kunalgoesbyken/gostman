# Example collections

Each folder here is a Gostman workspace: plain YAML files you can open in the desktop app with **Open folder**, or run from the command line. They call public test APIs, so they work without an account or a key of your own.

| Folder | What it shows |
| --- | --- |
| [`todo-api`](todo-api) | Folder headers, two environments, chaining one response into the next request, assertions that compare against variables, a saved example on every request for the mock server, and a data file. Calls [JSONPlaceholder](https://jsonplaceholder.typicode.com), or the mock with the `Mock` environment. |
| [`auth-and-secrets`](auth-and-secrets) | Auth set once on a folder and inherited by its requests, a request with its own auth, a request that expects a 401, secrets passed at run time instead of stored in the files, and a post-response script that fails the run when a secret is missing. Calls [httpbin](https://httpbin.org). |

## Run them

Install the command line first (see [Getting started](../docs/getting-started.md#install-the-command-line)), then from the root of this repository:

```bash
gostman run examples/todo-api --env Public
gostman run examples/todo-api --env Public --data examples/todo-api/todos.csv --only "Todos/Create a todo"
gostman mock examples/todo-api --port 4010
gostman run examples/todo-api --env Mock    # in a second terminal, while the mock runs

API_TOKEN=any-token PASSWORD=any-password \
  gostman run examples/auth-and-secrets --env Public --var-from-env API_TOKEN --var-from-env PASSWORD
```

On Windows PowerShell, set the variables first with `$env:API_TOKEN = "any-token"` and `$env:PASSWORD = "any-password"`.

## Open them in the app

1. In the desktop app, choose the storage button in the header, then **Open folder**, and pick `examples/todo-api`.
2. The folder opens restricted because you did not create it. Open the same menu and choose **Trust this folder** to allow its scripts.
3. Pick **Public** in the environment picker and send **List todos**, then **Get one todo**.

The [tutorial](../docs/tutorial-first-collection.md) builds `todo-api` from scratch and explains each part.

## Layout

```
todo-api/
  gostman.yaml              marks the folder as a workspace
  environments/Public.yaml  variables for the Public environment
  environments/Mock.yaml    the same variables, with base_url on the mock server
  Todos/folder.yaml         folder settings: headers, auth, variables
  Todos/List todos.yaml     one file per request
  todos.csv                 a data file for gostman run --data
```

The folder layout is described in [Folders, mock server and capture](../docs/workspaces-and-mock.md).
