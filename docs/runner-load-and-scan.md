# Running, load testing and scanning

This page covers the Run requests dialog (the collection runner), the Load test dialog and the Scan for secrets dialog, including the notices the scanner shows in the Share and Export tabs. Each one is opened from the command palette; see [Preferences and shortcuts](preferences-and-shortcuts.md) for the palette. The command line equivalents are described in [Command line](cli.md) and [Gostman in CI](ci.md), so this page does not repeat their flags.

## Run requests

The Run requests dialog sends the requests of your collection one after another and shows the outcome of each. Open it with the **Run requests** command or the **Run requests** button at the top of the sidebar, or with **Run folder** in a folder's menu in the sidebar, which preselects that folder.

Requests run in sidebar order, with their scripts, extraction rules and checks, each using the environment chosen for its collection (see [Environments per collection](variables.md#environments-per-collection)), from top to bottom: a folder's requests run where the folder sits, so a Login request above a Users folder runs before every request in it. `gostman run` and an agent's `run_folder` use the same order, and so do exports and imports where the other tool allows it; see [Order of requests and folders](collections-and-git.md#order-of-requests-and-folders). WebSocket requests are skipped.

To chain requests whose order depends on the answers, such as polling until an order is ready or a clean-up that runs only after a failure, draw a [flow](flows.md) instead: it adds retries, other paths on failure, conditions and loops without scripts, and runs the same way from `gostman flow run`.

Scripts can change the order with `setNextRequest`; see [Scripting](scripting-and-settings.md). A pass through the run may send at most 1000 more requests than it holds, so a loop that never ends, such as a retry on a 401 that always comes back, stops the run with a message that names the request that kept jumping, and that request counts as failed.

![The Run requests dialog after running the Orders folder: List orders, Create order, Upload receipt and Monthly report passed, and Export orders failed with a 500 status because the check res.status equals 200 did not hold. The footer reads Ran 5 of 5, 4 passed, 1 failed.](../gostman-gui/frontend/src/assets/landing/runner.webp)

### Options

| Control | What it does |
| --- | --- |
| **Requests to run** | Chooses **All requests** or one folder. Folders are listed by their full path, separated by ` / `. |
| **Delay (ms)** | Waits this many milliseconds after each request before the next one. Empty means no delay. |
| **Stop on failure** | Stops the run after the first request that fails. |
| **Data file (CSV, JSON or XLSX)** | Loads a file with one row per iteration. See [Data files](#data-files). |
| **Iterations** | Limits the number of iterations. Empty shows the number that will run: the row count of the data file, or 1. The highest value is 10000. |
| **Parallel** | Sends up to this many requests at once. Empty means 1. |
| **Only tags** and **Skip tags** | Shown when a request or folder in the collection has tags. **Only tags** keeps the requests that have at least one of the tags you add; empty keeps every request. **Skip tags** leaves out requests that have any of them. A folder's tags count for every request inside it. Case is ignored. Both apply inside the chosen folder, and the footer counts what is left. Set a request's tags in its [Settings](requests-and-responses.md#settings) tab or with **Tags…** in its menu in the sidebar, and a folder's with **Colour and tags…**. |
| **Requests list** | Before a run, a list shows every request that is in scope with a checkbox. Clear a checkbox to leave that request out of this run; **Select all** and **Select none** change them together, and the count (`10 of 12 requests`) updates. The choice is remembered for that scope while the app stays open, and is never written to a request or a file, so `gostman run` is not affected. After a run, **Choose requests** brings the list back and **Show results** returns to the outcome. |
| **Run** and **Stop** | Starts the run. While a run is going, **Stop** cancels the requests in flight and ends it. |

All controls except **Stop** are disabled while a run is going. **Run** is disabled when no request is in scope or every request is cleared. The run, its totals, the planned count in the footer and the HTML report use only the requests left checked.

![The Run requests list with two requests cleared: the count reads 10 of 12 requests and Select all and Select none sit beside it](../screenshots/runner-select.png)

### Data files

A data file runs the whole selection once per row.

- A CSV file needs a header row. Quoted fields may contain commas and line breaks, and every value is text.
- A JSON file must be an array of objects, one object per iteration.
- An XLSX workbook uses its first sheet. The first row holds the column names, blank rows are skipped, and every value is read as the text stored in the cell, so a date shows as its serial number and a formula as its last saved result.
- A data file can have at most 10000 rows, and it must have at least one.
- A row's columns become variables for that iteration and win over request, folder and environment variables with the same name, so a column `id` fills `{{id}}` even in a request whose **Vars** tab sets `id`. The dialog lists the columns a file sets. The values are kept as session values for the run and put back when it ends. `iteration` (starting at 1) and `iterationCount` are set as well, so you can write `{{iteration}}` in a request.
- With a data file loaded, the dialog shows its name and row count. Select that button to remove the file.
- If **Iterations** is set, only that many rows are used, up to the number of rows in the file. Without a data file, **Iterations** repeats the run that many times.

Values that scripts and Extract rules write during the run are kept after it, as when you send a request on its own; only the data file's values are put back.

### Parallel runs

With **Parallel** above 1, requests are sent together and see another one's extracted variables only if it finished first, so use it for requests that do not depend on each other. A script can still send its own request again with `setNextRequest`, as a retry does; continuing with another request stops the run, because the order cannot change. With several iterations, the parallel count applies inside each iteration, and iterations run one after another, in the runner and in `gostman run` alike. Values written in one iteration carry over to the next.

### Results

Each row of the results list shows:

- an icon for the outcome: passed, failed or skipped;
- the method and the request name, with `#` and the iteration number when the run has iterations;
- the number of passed assertions out of the total, such as `3/4 checks`, the duration in milliseconds and the status;
- the message of any error, any `{{variables}}` that no variable defined, and each failed assertion with its detail. Select an undefined name to open Environments with a new row for it in the active environment.

A skipped row shows **Skipped** and the reason, for example that a script stopped the run or continued it with another request.

Select a row to expand it. It then shows the address that was called, the assertions that passed and the response body, with JSON formatted. A run keeps the first 64 KB of each body; send the request on its own to see a longer one.

The footer reads, for example, `Ran 5 of 5 · 4 passed · 1 failed`. Before a run it shows how many requests are in scope, and how many iterations when there is more than one.

A 4xx or 5xx status does not fail a request by itself. Add an assertion such as `res.status equals 200`, as in the screenshot above. A request also counts as failed when it gets no response, when its script raises an error, or when an MCP tool reports an error.

Requests in a folder linked to an OpenAPI spec also get the spec's contract checks, which count like assertions; see [Contract checks](import-export-and-specs.md#contract-checks).

### OpenAPI coverage

When requests of a folder linked to an OpenAPI spec took part in the run, the results start with an **OpenAPI coverage** section. Its summary gives the operations that were called, such as `7 of 12 operations (58.3%)`, and the documented responses that came back. Expand it to see each operation with a mark, and which documented statuses never came back. See [Coverage of the spec](import-export-and-specs.md#coverage-of-the-spec).

### Download HTML report

**Download HTML report**, at the bottom of the dialog, saves the results of the last run as `gostman-report.html`. It is disabled while a run is going and when there are no results. The command line produces the same report with `--reporter html`; see [Command line](cli.md) and [Gostman in CI](ci.md).

Each request shows its folder path and the URL it was sent to, with secret values in the URL replaced by `{{name}}`: variables marked secret or with a sensitive name such as `token` or `api_key`, values from a secret manager or a `.env` file, and OAuth 2 tokens. The rest of the report, such as request and response bodies, is not redacted for you. Review it before you share it.

### Monitors

The **Monitors** dialog (the status bar, the command palette, **Monitor this folder** in a folder's menu and **Monitor this flow** in a flow's menu) runs a folder or a flow on a timer and keeps the results. A monitor has a name, what to run (all requests, a folder or a flow), an environment (the one in use, or a named one that is switched on only for the run), an interval from 1 minute to 24 hours, an optional data file for a folder, and notification settings.

- **While it runs.** Monitors run only while the app is open. In the web app they run only while the browser tab is open, and the dialog says so. Nothing runs when the app is closed, so use `gostman run --every` or a CI schedule for that; see [Scheduled runs](cli.md#scheduled-runs).
- **Runs.** The run uses the same pipeline as **Run requests**: scripts, extract rules, cookies, tokens and checks. Pressing **Run now** starts one at once, and **Pause** stops the timer. Runs go one at a time, and a data file is kept in memory only, so choose it again after restarting.
- **History.** Each monitor shows its pass rate, the last result, the p95 request duration, a chart of the rolling pass rate and the p95 duration over time, and a list of runs where a failed run opens to its failed checks. A run keeps its time, counts, each request's status and duration, and the messages of failed checks, never a response body. Values of variables, data rows and tokens are replaced with `{{name}}` before anything is saved or sent, and if that cannot be done the run is shown as withheld and nothing is saved. The desktop app saves history in the workspace's `.gostman/runs/` folder (kept out of Git) or, without a folder, in the user data directory, so `gostman history` reads the same runs of a folder workspace; the web app keeps up to 200 runs in the browser's IndexedDB. Retention is 200 runs per workspace.
- **Notifications.** A monitor can show a browser or system notification when a run starts failing and when it passes again. The desktop app can also post to a webhook address (Slack, Microsoft Teams, Discord or any URL). The address is kept in the system keychain, is never shown again after saving, and is sent through the network settings of the app. The web app has no webhook option, because the browser cannot post to those services.

### Repeat a run on a schedule

`gostman run --every 5m` and `gostman flow run --every 5m` repeat a run until it is stopped, save each run to a local history, and post to a Slack, Teams, Discord or plain webhook when it fails. `gostman history` shows the pass rate and the p50 and p95 duration of each request. See [Scheduled runs](cli.md#scheduled-runs).

## Load test

The Load test dialog sends the current request many times at once and measures how the server responds. Open it with the **Load test** button next to **Code** in the request bar, or with the **Load test this request** command while the request you want to test is the active tab.

![A finished load test with 20 workers for 5 seconds: every request succeeded, with a latency table from min to max](../screenshots/load-test.png)

The button and the command appear only in the desktop app. In the web version neither the request bar nor the palette offers them. The button is also hidden for gRPC and MCP requests.

Only test systems you own or have permission to test.

### Before you start

The dialog shows the request's method and URL, and a notice: each worker sends the request as it is shown there, without scripts or shared cookies.

The dialog refuses a request in these cases and shows the reason:

- The request has no URL: `Give the request a URL first.`
- The request is gRPC, MCP, WebSocket or streaming: `Only HTTP requests can be load tested. gRPC, MCP, WebSocket and streaming requests are not supported.`

### Settings

| Field | Meaning |
| --- | --- |
| **Concurrent workers** | Number of workers sending at the same time. Starts at 10, at most 500. |
| **Duration (seconds)** | How long the test runs. Starts at 10, at most 600. |
| **Requests per second cap** | Limits the overall rate. Leave it empty for no cap. |

**Start** is disabled until workers and duration are at least 1 (not needed when stages are set). While the test runs, the badge **Running** is shown and **Stop** ends it early; the result is then labelled **Stopped early**. Closing the dialog also stops a running test.

### Results

While the test runs, the dialog shows **Elapsed**, **Requests**, **Requests/s**, **p95** and **Failed**. With stages it also shows **Workers**, the current number of active workers.

When it ends, it shows:

- **Requests**, **Succeeded**, **Failed**, **Requests/s** and **Received** (bytes). Hover over **Failed** to see how many were network errors and how many came back with an error status.
- **Latency** in milliseconds: min, mean, p50, p90, p95, p99 and max. Percentiles are accurate to within 1%.
- **Latency distribution**, a histogram of response times.
- **Status codes**, with a count per code.
- **Error samples**, when some requests failed.

### Threshold expressions

A threshold is a metric, a comparison and a limit: `p95<300`, `avg<=120ms`, `errors<1%`, `rps>200`. The metrics are `min`, `avg`, `med`, `p50`, `p90`, `p95`, `p99` and `max` (milliseconds; `300`, `300ms` and `1.5s` are accepted), `errors` (the percentage of requests that failed), `failed` (a count) and `rps` (requests per second). The comparisons are `<`, `<=`, `>` and `>=`. A threshold with no completed request fails.

For thresholds that fail a pipeline, a fixed request count or a ramp-up, use `gostman load`; see [Load testing](cli.md#load-testing) in the command line page.

## Scan for secrets

The Scan for secrets dialog looks through your collection for credentials that were typed into it, before you share or commit it. Open it with the **Scan for secrets** command.

![The Scan for secrets dialog with one medium finding: a JSON Web Token in the token variable of the Local environment, shown only as eyJh****](../screenshots/scan.png)

It looks for well-known token formats, random-looking values in credential fields and passwords typed into auth settings. Values written as `{{variables}}` are not reported. Nothing leaves the window except the check itself, and only a few characters of a value are ever shown.

The scanner is a heuristic. A clean result is not proof that nothing is exposed; see [Secret scanner](cli.md#secret-scanner) for what it can miss.

### Reading the findings

The dialog title shows the number of findings. When the list is empty it shows **No secrets found**.

Each finding shows:

- a severity, **High** or **Medium**;
- where it was found: **Request**, **Folder**, **Environment** or **Collection**, with the path and the field;
- a short preview of the value, the reason and the name of the rule that matched.

For a finding in a request, **Go to request** opens that request.

By default the scan includes saved example responses. Clear **Include saved example responses** to leave them out.

To fix a finding, move the value into a variable and refer to it as `{{name}}`. Mark the variable as secret so it stays out of the collection files; see [Variables](variables.md#secret-variables).

## Negative tests

**Negative tests** (search for it in the command palette, or choose **Run negative tests** in a folder's menu) is a basic checker that sends altered copies of your saved HTTP requests: no or invalid credentials, bad bodies, boundary values and injection strings. It flags answers such as a 2xx where a 4xx was expected, a 5xx, a stack trace, a database error or a reflected payload. It is not a penetration testing tool.

1. Choose **All requests** or a folder.
2. The dialog lists the hosts that will receive requests and the altered copies, each with a severity. Tick **I may send altered requests to these hosts**; **Start** stays disabled until you do.
3. Set **Requests per second** (default 5) and **Stop after (requests)** (default 300), then select **Start**. **Stop** ends the run.

Findings are grouped by request, with the severity of each. The requests are sent like any other request, so the web app can only reach the hosts its proxy permits. The same checks run on the command line as `gostman negative`; see [Negative tests](cli.md#negative-tests). Agent sessions have no tool for it.

## Notices in Share and Export

The Share and Export tabs run the same scan on what you are about to hand over. When something is found, a notice reads `N possible secrets found` with advice and a **Show findings** button, which lists them the same way as the dialog.

- In **Share**, the notice says the values stay in the link or file you create. Creating the link or file is held back until the scan has finished. If there are findings, it stays held until you replace the values or select **Share anyway**.
- In **Export**, the notice says the values are written into the export. It does not block the export.

If the scan itself fails, the tab shows `The check could not run` with the reason.

For the Share tab, a separate message counts requests that hold a password, token or key typed directly into the Auth tab. Those are part of the request and are shared with it.
