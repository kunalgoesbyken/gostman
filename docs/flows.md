# Flows

A flow chains saved requests into a scenario: send one request after another, try a request again until it passes, go to another step when one fails, branch on a response, repeat steps for every item of a list and pass values from one response to the next. You draw it in the app and run it there, from `gostman flow run` or in CI. The definition is a YAML file in the workspace, so it is reviewed and versioned with the requests it uses.

Use the [runner](runner-load-and-scan.md#run-requests) to check every request of a folder, in order. Use a flow when the order matters and depends on the answers: a login whose token the next calls need, an order you poll until it is ready, a clean-up that only runs when something failed, or a bug that needs five calls in a precise sequence to show up.

![The Checkout flow on the canvas: Reset, Login and Keep the token, then Wait until the order is ready with a retry loop drawn on its left and a red "fails" branch going down to Cancel order, then Order ready? with a green "true" branch to List orders and a "false" branch to Cancel order](../screenshots/flow-canvas.png)

## Draw a flow

1. Open the **Flows** tab of the sidebar and choose **New flow**, or **Start from an example** for a small flow that logs in, waits until an order is ready and cancels it when it never is.
2. Choose **+** between two steps, or at the end of the list, and pick the kind of step. **Send request** opens a search over your saved requests.
3. Select a step to edit it in the panel on the right (below the canvas on a phone). Choose **Save** or press Ctrl+S (⌘S on macOS) to keep the flow; a dot on its tab marks unsaved changes, and **Undo** and **Redo** (Ctrl+Z, Ctrl+Y) step back through your edits.

Steps run from top to bottom. A line between two cards means the first one continues with the next; a dashed line means it never does, for example after an **End** step. Jumps to other steps are drawn on the right with their reason: **fails** in red, **true** in green, **false** and **go to** in grey. A **Send request** that tries again shows a loop on its left with the number of attempts, and the steps a **For each** repeats are framed under it.

On the canvas, the arrow keys move between steps, Enter opens the selected step in the panel, Alt+↑ and Alt+↓ move it, and Delete removes it after asking. Removing a step makes the steps that went to it continue with the next step instead. A step that needs attention, such as a **Send request** without a request, shows a warning sign, and the flow settings (shown when no step is selected) list every problem.

## Kinds of steps

| Step | What it does |
| --- | --- |
| **Send request** | Sends a saved request with its scripts, checks, extraction rules, cookies and OAuth 2.0 token, the same way the Send button does. It passes when a response arrives and its own checks pass. **Variables for this send** set values for this step only, above every other scope. **Attempts** and **Wait between** try it again when it fails, and **Until** adds checks that must also pass, such as `res.body.status equals ready`. **When it fails, go to** takes another path after the last attempt; without it, a failure stops the flow as failed. |
| **Set variables** | Sets session values for the next steps: text with `{{variables}}`, or a value from the response of an earlier **Send request** step (a JSONPath into the body, a header or the status code). A path that finds nothing fails the flow, so a missing token is reported where it went missing. |
| **If** | Checks the latest response, the response of a chosen step, or variables, with the same checks as a request's **Checks** tab. **Match** says whether all or any must pass. **When true** and **When false** choose where to go; empty means the next step. |
| **For each** | Repeats the steps inside it for every item of a list found by a JSONPath in an earlier response. Inside, `{{item}}` is the item as text, `{{item.id}}` one of its fields and `{{index}}` its position from 0; both names can be changed. An empty list skips the steps. |
| **Wait** | Pauses for a number of milliseconds. |
| **End** | Stops the flow as passed or failed, with a message for the summary. |

Every step except **End** has **Then go to**, which can jump to any step, back to an earlier one to make a loop, or to the end of the flow. A step inside a **For each** can only be reached from inside it; go to the **For each** itself to start the loop again.

Conditions use only the declarative checks, never JavaScript, so a flow by itself runs no code. The requests it sends keep their own scripts, and a folder you have not trusted keeps them switched off as usual.

A run stops after 1,000 requests, so a loop with no way out ends with a message instead of running forever. Change the limit in the flow settings, up to 10,000. A loop that sends no request at all stops after 10,000 steps.

![The step panel for Wait until the order is ready: its request Shop/Order status, five attempts 200 ms apart, the Until check res.body.state equals ready, and When it fails, go to Cancel order](../screenshots/flow-step.png)

## Run a flow

Choose **Run** (or press the Send shortcut, Ctrl+Enter) to run the flow with the active environment. The cards light up as the steps run: a spinner on the step being sent, a green tick when it passed, a red cross when it failed, and an orange arrow when it failed but the flow handled it, by trying again or by going to another step. A step that is tried again shows its attempt, such as `3/5`.

The **Run** tab lists every step that ran, in order. Requests use the same rows as the runner: status, time, checks and, when expanded, the URL that was sent and the response body. Failed **Until** checks are listed with the request, so you see why a step was tried again. **Set variables** rows show the values they set; values of variables whose names look secret, such as `token`, are hidden. **Stop** cancels the request in flight and ends the run, and **Report** saves the run as the same HTML report the runner writes, with the outcome of the flow at the top.

Values set by **Set variables** and **For each** stay in the session after the run, like values from Extract rules, so you can send a request by hand with them; they are never saved. The variables of a **Send request** step are removed again after it is sent.

![A finished run of Checkout: every card has a green tick, Wait until the order is ready shows 3/5, and the Run tab lists Reset, Login, Keep the token with its values, two attempts of Order status that failed and were handled, the third that passed, and the branch Order ready? True, going to List orders](../screenshots/flow-run.png)

## Run from the command line

```bash
gostman flow list --workspace orders-api
gostman flow run Checkout --workspace orders-api --env CI
gostman flow run orders-api/flows/checkout.yaml --env CI --reporter junit:flow.xml
gostman run orders-api --flow Checkout --env CI
```

`flow run` takes the flow's name or id, or the path of a flow file, and runs it through the same pipeline as `gostman run`, so `--env`, `--var`, `--var-from-env`, `--env-file`, `--secrets`, `--timeout`, `--insecure`, `--allow-files`, `--redact`, `--contract`, the certificate and proxy flags and every reporter work the same way (see [Command line](cli.md#flows)). The workspace is `--workspace`, or the current folder, or the workspace that holds the flow file. A Gostman export works too: `gostman flow run Checkout --workspace export.json`.

The text report prints each request as `gostman run` does, a `FLOW` line for every other step, and the outcome of the flow at the end. A failure the flow handled is printed in yellow with the reason, and counted apart.

![The output of gostman flow run Checkout: PASS lines for Reset and Login, a FLOW line for Keep the token, two yellow FAIL lines for Order status with "Attempt 1 of 5 failed; trying again", a PASS on attempt 3 of 5, FLOW lines for the If and For each steps, and the summary Flow Checkout passed: Order checked](../screenshots/flow-cli.png)

The exit status follows the flow: 0 when it reaches its end or an **End** step marked passed, 1 when it fails (an unhandled failure, a failed **End** step, the request limit or an interrupt), 2 when the command or the flow is wrong, for example a step that points to a missing request, and 3 when the request that failed it got no response. The JSON report adds a `flow` object with the outcome, the message and every step in the order it ran; JUnit adds one test case for the flow and reports handled failures as skipped.

## The flow file

In a workspace folder each flow is a file in `flows/` at the root, named after the flow, such as `flows/checkout.yaml`. The app writes it when you save and reads changes made by an editor or a `git pull` within a few seconds. Keys the app does not know are kept at the top of the file. In app storage and in the browser, flows are kept with the rest of your data, and a Gostman export carries them; an import adds them as new flows linked to the imported requests, and lists any step whose request was not in the export.

```yaml
name: Checkout
description: Log in, wait until the order is ready, then check every item.
maxSends: 200
steps:
  - id: login
    kind: request
    request: Shop/Login
  - id: keep-token
    kind: set
    label: Keep the token
    values:
      - name: token
        step: login
        source: body
        path: $.token
      - name: orderId
        value: A7
  - id: status
    kind: request
    label: Wait until the order is ready
    request: Shop/Order status
    retry:
      times: 5
      delayMs: 1000
      until:
        - expression: res.body.state
          operator: eq
          value: ready
    onFailure: cancel
  - id: list
    kind: request
    request: Shop/List orders
  - id: has-items
    kind: if
    step: list
    conditions:
      - expression: res.body.items
        operator: isNotEmpty
    else: cancel
  - id: each-item
    kind: forEach
    step: list
    path: $.items
    steps:
      - id: item
        kind: request
        request: Shop/Get order
        variables:
          itemId: "{{item.id}}"
  - id: done
    kind: end
    outcome: passed
    message: Order checked
  - id: cancel
    kind: request
    request: Shop/Cancel order
  - id: cancelled
    kind: end
    outcome: failed
    message: The order never got ready, so it was cancelled
```

| Key | Where | Meaning |
| --- | --- | --- |
| `name`, `description` | flow | Shown in the app and in reports. Without `name`, the file name is used. |
| `maxSends` | flow | Request limit of a run, 1 to 10000 (default 1000). |
| `id` | step | Short name other steps use to point at it, unique in the flow. `end` is reserved. |
| `kind` | step | `request`, `set`, `if`, `forEach`, `delay` or `end`. |
| `label` | step | Title on the canvas and in reports. Without it, the request's name or the kind of step is shown. |
| `next` | step | Step to go to next; empty means the step below it, `end` ends the flow as passed. |
| `request`, `requestId` | request | The saved request, by its `Folder/Name` path and its id. The id is tried first, so renaming a request keeps the flow working; the app fills in both when it saves. |
| `variables` | request | Values for this send only, as `name: template`. |
| `retry.times`, `retry.delayMs`, `retry.until` | request | Attempts (1 to 50), the wait between them in milliseconds, and extra checks. |
| `onFailure` | request | Step to go to when the last attempt fails. |
| `values` | set | A list of `name` with either `value` (text with `{{variables}}`) or `step`, `source` (`body`, `header` or `status`) and `path` (a JSONPath, or the header name). |
| `source`, `step`, `match`, `conditions`, `then`, `else` | if | `response` (the latest one, or the one of `step`) or `variables` (the expression is a variable name); `all` or `any`; checks written as `expression`, `operator`, `value`, as in a request's assertions. |
| `step`, `path`, `as`, `indexAs`, `steps` | forEach | The step whose response holds the list, its JSONPath, the names of the item and index variables (`item` and `index`) and the steps to repeat. |
| `ms` | delay | Milliseconds to wait, up to 600000. |
| `outcome`, `message` | end | `passed` or `failed`, and the message of the summary. |

The decisions of a flow, where to go next, whether a step passed and what a value is, are made by the same code in the app and on the command line, so a flow takes the same path in both. The [todo-api example](../examples/todo-api) has a flow you can run with `gostman flow run "Check todos" --workspace examples/todo-api --env Public`.
