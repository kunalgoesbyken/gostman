# Tutorial: test an API

This tutorial builds a small tested collection from nothing: three requests against a public API, a variable, one request that reuses a value from another, checks on every response, and a run of the whole collection from the app and from the command line. It takes about fifteen minutes. The finished result is in [`examples/todo-api`](../examples/todo-api) if you want to compare.

You need the [desktop app or the web app](getting-started.md). The API is [JSONPlaceholder](https://jsonplaceholder.typicode.com), a free test API that accepts writes without storing them.

## 1. Send a request

1. Open a new tab with the plus button, keep the method on **GET** and enter `https://jsonplaceholder.typicode.com/todos?userId=1`.
2. Press **Send**. The response panel shows `200 OK` and a JSON list of todos.
3. Name the request **List todos** in the name field above the URL and press **Save**.

The request is now in the sidebar. Everything you save stays on your device.

## 2. Move the address into a variable

Typing the same host into every request makes it hard to point the collection at another server later. Put it in an environment instead.

1. Open **Environments** with the sliders icon next to the environment picker in the header.
2. Create an environment named **Public** and add a row `base_url` with the value `https://jsonplaceholder.typicode.com`.
3. Pick **Public** in the environment picker.
4. Change the URL of **List todos** to `{{base_url}}/todos?userId=1`. The name turns green because the active environment defines it; an orange name means it is not defined.

Send it again to confirm nothing changed. See [Variables](variables.md) for every scope and how they override each other.

## 3. Group requests in a folder

1. Create a folder named **Todos** with the folder button in the sidebar and drag **List todos** into it.
2. Open the folder's **Settings** from its menu, add a header `Accept: application/json` on the **Headers** tab and save.

Every request in the folder now sends that header without repeating it. Auth, variables, scripts and assertions can be set on a folder the same way; see [Folder and collection settings](folder-settings.md).

## 4. Check the response

A request that returns the wrong data with a `200` status still looks like a success. Assertions catch that.

1. On **List todos**, open the **Tests** tab and add three assertion rows:

   | Expression | Check | Expected |
   | --- | --- | --- |
   | `res.status` | equals | `200` |
   | `res.body` | is an array | |
   | `res.body[0].userId` | equals | `1` |

2. Send the request. The response panel's **Tests** tab lists each check as passed or failed.

Change the expected `userId` to `2` and send again to see a failure, then change it back.

## 5. Reuse a value from one response in the next request

Real flows chain requests: log in, then use the token; create a record, then fetch it by its id.

1. On **List todos**, open the **Extract** tab and add a rule: name `todo_id`, source **JSON body**, expression `$[0].id`.
2. Send **List todos**. The rule copies the first todo's id into `todo_id` in the active environment.
3. Create a second request in **Todos** named **Get one todo** with the URL `{{base_url}}/todos/{{todo_id}}` and send it. Hovering `todo_id` shows the value it will use.
4. On its **Tests** tab, add `res.status` equals `200` and `res.body.id` equals `{{todo_id}}`. Expected values can use variables, so the check follows whatever **List todos** returned.

For checks that do not fit in one row, such as validating against a JSON Schema or comparing two fields, write a post-response script. [Variables, scripts and settings](scripting-and-settings.md#examples) has examples.

## 6. Send a body

1. Create **Create a todo** in **Todos** with the method **POST** and the URL `{{base_url}}/todos`.
2. On the **Body** tab choose **JSON** and enter:

   ```json
   {
     "userId": 1,
     "title": "Write the first test",
     "completed": false
   }
   ```

3. Add the assertions `res.status` equals `201` and `res.body.id` is a number, then send it.

## 7. Run the whole collection

Choose **Run requests** at the top of the sidebar. The runner sends every request in order, applies the extraction rules and checks, and shows a summary you can download as an HTML report. Requests run top to bottom, so keep **List todos** above **Get one todo**.

## 8. Keep it as files and run it from the command line

On the desktop app, open the storage menu in the header and choose **Save collection to folder**. Gostman writes one YAML file per request, which you can commit to Git next to your code. Then, with the [command line](cli.md) installed:

```bash
gostman run path/to/folder --env Public
```

```
PASS  GET      Todos/List todos  200 OK  99 ms  3/3 tests
PASS  GET      Todos/Get one todo  200 OK  13 ms  2/2 tests
PASS  POST     Todos/Create a todo  201 Created  286 ms  2/2 tests

Requests  3 passed
Tests     7 passed
```

The command exits with `1` when a request or a check fails, which is what a CI pipeline needs.

## 9. Run it once per row of a data file

In the body, replace the title with `"{{title}}"` and `false` with `{{completed}}`. Add `title` and `completed` to the **Public** environment as defaults, then create `todos.csv`:

```csv
title,completed
Write the first test,false
"Review the pull request, then merge it",true
Écrire la documentation,false
```

```bash
gostman run path/to/folder --env Public --data todos.csv --only "Todos/Create a todo"
```

Each row becomes one iteration, and its columns override the environment's variables. Add the assertion `res.body.title` equals `{{title}}` to check that every row came back as sent. The runner dialog in the app takes the same file.

## Next steps

- [Run these tests in CI](tutorial-ci.md) on every pull request.
- [Guides by task](guides.md): mock a backend, migrate from Postman, load test, let a coding agent use the collection.
- [Troubleshooting](troubleshooting.md) when something does not behave as expected.
