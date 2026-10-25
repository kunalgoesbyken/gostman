# Import, export and OpenAPI specs

This page covers the Import and Export dialog, what an import does and does not change, the OpenAPI spec viewer, spec sync and linter, and the Open in Gostman link builder. Encrypted share links and generated documentation are described in [Sharing and documentation](sharing-and-docs.md).

## The Import and Export dialog

Open the dialog with the **Import** button in the header or the **Import data**, **Export data** and **Share collection** commands in the command palette. It has three tabs: **Import**, **Export** and **Share**. The Share tab is covered in [Sharing and documentation](sharing-and-docs.md).

![The Import tab with Choose files and Choose folder, the format list, an OpenAPI address field and a box to paste content](../screenshots/import.png)

## Importing

You can bring data in four ways:

- **Choose files** or **Choose folder**.
- Drop files, a folder or a `.zip` on the drop area.
- Paste content into the text box (**Content to import**).
- Enter the address of an OpenAPI spec and choose **Load**, or choose **Open spec file** to pick a spec on disk. **Open spec file** is available in the desktop app only.

Gostman reads the content after a short pause and shows a summary before anything is added. Nothing changes until you choose **Import**.

### Supported formats

| Format | Notes |
| --- | --- |
| Postman | Collections (v2.0 and v2.1), environments, globals and the JSON file of Postman's **Export data**. Collection variables become collection variables; collection and folder auth and scripts become [folder settings](folder-settings.md) and requests inherit them. Globals become a global environment in the app; `gostman import` adds them to the collection variables in `gostman.yaml`. See [Coming from Postman](coming-from-postman.md) |
| OpenAPI | OpenAPI and Swagger specs |
| Insomnia | Insomnia exports |
| HAR | HAR captures |
| WSDL | WSDL services |
| Bruno | Bruno collections in `.bru` or YAML (OpenCollection), as a folder, a `.zip` or one exported file |
| .http files | VS Code REST Client and JetBrains HTTP Client `.http` and `.rest` files, with their environments. See [.http files](#http-files) |
| Gostman | Gostman exports and share links |

Request tags are carried over from Bruno (`tags` in a `.bru` file's `meta` block, or `info.tags` in OpenCollection YAML) and from the `tags` of an OpenAPI operation, which also still pick the folder. Postman, Insomnia, HAR and WSDL files have no request tags.

The **Format** list defaults to **Detect automatically**. Choose a format yourself when detection picks the wrong one. A curl command pasted into the address bar of a request fills that request; when it reads files, the paths are listed and you are asked first, see [Pasting curl commands](requests-and-responses.md#pasting-curl-commands).

When you pick HAR, or the files you read include a HAR capture, a **Leave out images, fonts, styles and scripts** checkbox appears. Chosen entries are listed under **Left out** in the summary.

### Files and folders

- The file picker accepts `.zip`, `.json`, `.yaml`, `.yml`, `.xml`, `.wsdl`, `.xsd`, `.har`, `.bru`, `.http`, `.rest` and Gostman share files.
- A folder or archive is searched for importable files with those extensions. Hidden paths (any segment starting with a dot) and `node_modules` are ignored.
- Up to 5,000 files are read. Each file and the files together are limited to 10 MB, and the dialog reports the limit when you go over it.
- Files must be text. A binary file is refused with a message naming it.
- With several files, the summary lists each file with its detected format and a total line.

### .http files

Files ending in `.http` or `.rest` are always read as request files. Pasted text, or a file with another extension, is read as one only when its first request starts with a method and an address, such as `GET https://api.example.com/users`.

- Each file becomes a folder named after the file. Files in subfolders keep that layout, so `users/admin.http` becomes the folder `admin` inside `users`.
- Requests are separated by `###`. The name is the text after `###` or a `# @name` (or `// @name`) line; a request without one is named after its method and address. Other `#` and `//` lines before the request line become its description.
- A line with only an address is a `GET`. `HTTP/1.1` at the end of the request line is ignored, and the lines after it that start with `?` or `&`, or are indented and start with `/`, continue the address.
- Headers run until the first blank line and the body runs to the next `###`. The body type comes from `Content-Type`: JSON, XML, text, form fields and multipart parts are read into their own body types. A `Content-Type` that matches what Gostman sends for that body type is dropped.
- `Authorization: Basic user password` (or `user:password`), `Digest user password` and `Bearer token` become the request's authentication.
- `X-Request-Type: GraphQL`, or the JetBrains `GRAPHQL` method, makes a GraphQL request: the query, then a blank line and the variables as JSON.
- `# @no-redirect` and `# @timeout` (seconds, or with `ms`, `s` or `m`) set the request options. `# @prompt name` turns `{{name}}` in that request into the prompt `{{?name}}`.
- File variables (`@name = value`) become variables of the file's folder.
- A REST Client request variable such as `{{login.response.body.$.token}}` or `{{login.response.headers.Location}}` adds an extract rule to the `login` request and is replaced with the variable it fills, here `{{login_token}}`. References to `.request.` values or XPath queries are kept as written and listed in the summary.

System variables are rewritten to Gostman's dynamic variables where one exists:

| In the file | In Gostman |
| --- | --- |
| `{{$guid}}`, `{{$uuid}}`, `{{$random.uuid}}` | `{{$guid}}`, `{{$uuid}}` |
| `{{$timestamp}}`, `{{$isoTimestamp}}`, `{{$datetime iso8601}}` | `{{$timestamp}}`, `{{$isoTimestamp}}` |
| `{{$randomInt}}`, `{{$random.integer}}` | `{{$randomInt}}` |
| `{{$randomInt 1 10}}`, `{{$random.integer(1, 10)}}` (upper bound not included) | `{{$randomInt(1,9)}}` |
| `{{$random.email}}` | `{{$randomEmail}}` |
| `{{$processEnv NAME}}`, `{{$dotenv NAME}}`, `{{$env.NAME}}` | `{{process.env.NAME}}`, read from the workspace's `.env` file |

Others, such as `{{$datetime rfc1123}}`, offsets like `{{$timestamp -1 d}}`, `{{$aadToken}}` and the JetBrains `{{$random.*}}` generators, are kept as written and listed in the summary.

Environments come from:

- `http-client.env.json` and `http-client.private.env.json` (JetBrains). Each top-level name becomes an environment, and values from the private file are added to it and marked secret. Values that are objects, such as JetBrains auth settings, are left out with a note.
- A `settings.json` with `rest-client.environmentVariables` (REST Client). Each environment gets the `$shared` values, and `{{$shared name}}` is replaced with the shared value. Comments and trailing commas are allowed. Folders that start with a dot are not searched, so add `.vscode/settings.json` to the import yourself.

JetBrains response handlers (`> {% ... %}`) become post-response scripts and pre-request handlers (`< {% ... %}`) become pre-request scripts. Common calls are rewritten: `client.test` to `test`, `client.assert(value, message)` to `expect(value, message).to.be.ok`, `client.global.set` and `get` to `env.set` and `env.get`, `request.variables.set` and `get` to `env.session.set` and `env.session.get` (session values, never saved), `client.log` to `console.log`, `response.body` and `response.status` to `res.body` and `res.status`, and `response.headers.valueOf(name)` to `res.getHeader(name)`. Anything else is kept as written and listed in the summary.

Not imported, and listed in the summary: bodies read from files with `< path` (the request keeps the file name, attach the file again), response handlers in separate `.js` files, `>>` response redirects and `WEBSOCKET` and `GRPC` requests.

### The import summary

The summary reads, for example, `name: Postman file, 12 requests, 3 folders and 2 environments`. It counts requests and folders, and environments, variables and folder settings when there are any. Below the counts it can show:

- Warnings, in the warning colour.
- A **Left out** list of what was skipped.
- For an OpenAPI spec loaded from pasted text, a note that sync is available only for specs loaded from an address or an opened file.

For an OpenAPI spec the summary also has a **Browse** button that opens the spec viewer before you import.

When you confirm, an **Import complete** message states how many requests, folders and other items were added, with any notes.

### What imports never do

Imports are untrusted input, as described in the project notes:

- They only add data. An imported item never overwrites an existing one by id; items that clash get new ids.
- They never disable TLS verification. If a request in the file turned verification off, it is kept on and a warning names up to five such requests.
- They never carry OAuth tokens.
- They never carry secret manager references, whether from a Gostman export or from the external secrets of a Bruno or OpenCollection environment. A crafted file could otherwise point a variable at a path in your vault and send the value to an address of its choosing, so the reference is removed, the variable is kept and marked secret, and the summary names each one (with the Bruno provider and path); pick the connection and path again with the key icon on its row.
- Folders in a loop or nested deeper than 32 levels are moved to the top level, with a warning.
- The collection variables of a Postman, Bruno, Insomnia, OpenAPI or WSDL import belong to the folder the import creates (**Environments**, **Collection variables** under the collection's name while one of its requests is open), so they never mix with another collection's, in the app's own storage and in a folder workspace alike; a folder workspace and `gostman import` keep them in that folder's `folder.yaml`. A Gostman export brings each collection's own list the same way, and its shared collection variables are added to the shared ones; a variable you already have keeps its value. If those are not valid JSON, the variables are skipped with a note. The base environment of an Insomnia collection is imported as its collection variables. A Postman collection variable of type **secret**, or a private or confidential value of an Insomnia base environment, is marked secret, so its value stays on this device and out of exports; `gostman import` writes only its name.
- Environments that come with a Bruno or Insomnia collection belong to the folder the import creates, so the `Local` of a second collection stays its own; the summary says which collections they belong to. Postman environment files imported together with one Postman collection belong to it too; with no collection or several, they are shared by every collection, as are globals and `.http` environments. See [Environments per collection](variables.md#environments-per-collection). In a folder workspace every environment is shared.
- A shared environment with the name of a shared one you already have is added to it: new variables are added and the ones it already has keep their values, and the summary names the environment. An environment whose variables are not valid JSON is skipped by name. When the shared environment in use has no variables, such as the empty **Default** of a new collection, the first imported shared environment is put in use.
- An import never changes the settings that apply to your other collections. In the app's own storage, the **Settings for all collections** of a Gostman export or share link go to the imported collection's own **Collection settings**: when every top-level folder of the import has empty settings and no request sits outside them, each of those collections gets a copy; otherwise the import is placed in a new collection, **Imported collection**, that carries them. The summary says where they went. In a folder workspace, which is one collection, they become its **Collection settings** in `gostman.yaml` only when those are empty, see [Folder and collection settings](folder-settings.md). `gostman import` of a Gostman export writes them to the new `gostman.yaml`: headers, auth without tokens, scripts and checks.

### Scripts and OAuth 2.0

Scripts, OAuth 2.0 settings, local MCP commands and file reads are kept when you import them, but you decide first. If the import contains any request, folder or collection setting that carries them, Gostman asks before adding anything, says how many items carry what, and lists the files the import would read from this computer (the first ten, then how many more). When there is only one kind, the prompt is named after it, such as **Import the scripts?**, with **Import with scripts** and **Import without scripts**. With several kinds it reads **Review before importing**, with **Import everything** and **Import without them**. Choosing to import without them adds everything else and notes what was left out. The summary then drops the notes about what you left out, such as how imported scripts were translated, and shows its warning sign only when something else needs your attention. **Cancel** imports nothing and returns to the import dialog with your content still in it.

In a folder you have not trusted yet, imported scripts, OAuth 2.0 settings, local MCP commands and file reads stay switched off until you trust it, see [Trust](collections-and-git.md#trust).

### Share links

Pasting a share link, or choosing a share file, shows a preview with the requests, folders and environments. A share protected with a passphrase asks for it, and a file sent without its key asks for the key. Variables you already have keep your values. The preview also lists the files the share would read from this computer. Shared imports go through the same prompt for scripts, OAuth 2.0 settings, local MCP commands and file reads. Creating shares is covered in [Sharing and documentation](sharing-and-docs.md).

## Exporting

The **Export** tab previews the content, shows how many requests, folders and environments the collection has, and offers a copy button and **Save file**. With more than one collection, **Collection** exports one of them, with its own and the shared environments, or all of them; the file is named after the collection. A secret scan runs on the collection and shows a notice when it finds credentials; it does not block the export, see [Notices in Share and Export](runner-load-and-scan.md#notices-in-share-and-export). The preview shows the first 20,000 characters; the saved file is complete.

![The Export tab with All collections and the Gostman format selected, Copy and Save file buttons, a note that secret values are left out, and the export preview](../screenshots/export.png)

| Format | What you get |
| --- | --- |
| Gostman | Full backup: requests, folders and every environment, with the collection each one belongs to, the global environments (the one in use first) and the collection variables: the shared ones as the `variables` object and each collection's own with its folder. Values of variables marked secret and OAuth tokens are left out; the secret marks are kept. The app, `gostman run` and `gostman import` read this file, and also older exports that wrote `variables` as a JSON string |
| Postman | Collection v2.1 with the variables in use, except secret ones, as collection variables, scripts and checks adapted to run in Postman, saved examples, and the auth, scripts and variables of folders and the collection. Insomnia imports this file too |
| OpenAPI JSON | OpenAPI 3.0 description of the HTTP requests |
| OpenAPI YAML | OpenAPI 3.0 description of the HTTP requests |
| Markdown | Readable API documentation |
| HTML docs | One self-contained page to publish or print. Credentials are left out and variables stay as `{{name}}` |
| Bruno | A folder of `.bru` files with environments, saved as a `.zip`. Collection and folder headers, auth, variables, scripts, checks and docs go into `collection.bru` and `folder.bru`; a single top-level folder becomes the collection. Scripts and checks are adapted to run in Bruno |
| curl script | One curl command per request. Credentials become environment variable placeholders, and the variables to set are listed at the top. A command whose address has `[`, `]`, `{` or `}` outside `{{variables}}`, such as `?ids[0]=1`, gets `--globoff` so curl sends it as written |
| HAR | HTTP Archive 1.2 with the requests and no responses |
| .http files | Requests for VS Code REST Client and JetBrains HTTP Client, one file per folder, with environments in `http-client.env.json` |

Gostman, OpenAPI and Bruno exports keep request tags. Bruno only reads tags made of letters, digits, `_` and `-`, so other tags, such as ones with spaces, are left out of a Bruno export.

Postman, curl script and HAR exports keep the order the sidebar shows, with requests above or between folders where you put them, and .http files list each folder's requests in that order. Bruno lists folders before requests, so the Bruno export keeps the order within each kind and the export summary names the requests that will run after a folder there. Imports keep the order of the source; see [Order of requests and folders](collections-and-git.md#order-of-requests-and-folders).

For Bruno, curl script, HAR and .http exports, an **Include credentials** checkbox is off by default. Off, passwords, tokens and secret-named headers or variables are replaced with `{{NAME}}` placeholders. On, credentials are written into the file in plain text.

### Scripts and checks in Postman, Bruno and Insomnia

Postman and Bruno exports turn scripts and checks into something the other tool runs, so a team where some people use Gostman and others use Postman, Bruno or Insomnia keeps one set of tests.

- **Scripts stay as you wrote them.** When a script uses a Gostman name the other tool does not have, such as `env`, `utils`, `sendRequest` or, for Postman, `req`, `res`, `test` and `expect`, a few lines at the top define that name with the tool's own API, holding only the parts the script uses:

  ```js
  const env = {
    set: (name, value) => pm.environment.set(name, value),
  };
  const res = {
    status: pm.response.code,
  };

  env.set("lastStatus", res.status)
  ```

  Bruno already has Gostman's `req`, `res`, `test` and `expect`, so a Bruno script usually needs only `env` defined. A script written in the tool's own API, such as `pm.*` for Postman, is exported unchanged. A script that calls another tool's API is first translated as an import from that tool would translate it, then exported like any Gostman script: in a Bruno export, `pm.*` and `insomnia.*` calls become Gostman's API and then Bruno's, so `pm.test`, `pm.expect` and `pm.response.json()` become Bruno's `test`, `expect` and `res.body`, and `pm.environment.set` becomes `env.set` with `env` defined by `bru.setEnvVar`. A Postman export does the same for `insomnia.*`. Calls with no translation, such as `pm.cookies.jar()`, stay as written and are listed in the summary. In a Postman export, a script that uses `await` outside a function is wrapped in an `async` function, because newman does not allow `await` there; the lines at the top then define every helper they use, such as `cryptoJs` for `utils.md5`, even when your script declares one of the same name inside the wrapper.
- **Checks become the tool's own checks, and keep Gostman's meaning.** In Postman each assertion row becomes a `pm.test` named like the row, for example `res.status equals 200`; a row that is turned off becomes a skipped test. **equals**, **does not equal** and **is one of** compare as Gostman does: plain values as text, so `eq 200` passes when the API returns `200` or `"200"`, and objects and lists as JSON; **is empty** also passes for a missing or null value; **contains** looks for the value in a list, or in the text of anything else; **has length** counts the keys of an object; **is not empty** passes for a number. In Bruno, a row stays a row in the `assert` block only when Bruno is known to judge it the same way for any response. That covers `res.status`, `res.responseTime`, `res.headers` and `res.body` paths with: **equals** and **is one of** with plain text, or with numbers on `res.status` and `res.responseTime`; **does not equal** with plain text on `res.status`, `res.responseTime` or a header; `gt`, `gte`, `lt` and `lte` with a number on `res.status` and `res.responseTime`; **contains** with plain text that is not part of `true`, `false`, `null`, `undefined` or a number; **matches** with a pattern that has no slashes around it and does not match `undefined`; **is defined** and **is undefined** on `res.status`, `res.responseTime` or a header; and **is null**, **is a number**, **is a string**, **is a boolean** and **is an array**. Everything else becomes a test in the `tests` block that compares as Gostman does, because Bruno compares the type (`eq 200` on a body field that holds `"200"`), checks **has length** on lists and text only, fails **is empty** on a missing value and **is not empty** on a number, and fails **starts with**, **ends with** and **does not contain** on values that are not text. **is true**, **is an object**, **matches schema** and every folder and collection row are tests too. Rows that are turned off stay, turned off, in Bruno's `assert` block. `{{variables}}` in an expected value, including values from a data file, are filled in when the check runs.
- **Extract rules keep filling variables.** Postman has no extract rules, so each rule becomes one line at the top of the post-response script, where it runs before your script as it does in Gostman. A rule without a scope sets a collection variable, which Postman keeps between sends; a **session** rule sets a run variable and an **environment** rule sets the active environment:

  ```js
  pm.collectionVariables.set("token", pm.response.json().access_token);
  pm.variables.set("trace", pm.response.headers.get("X-Trace"));
  pm.environment.set("sid", pm.cookies.get("sid"));
  ```

  In Bruno, rules become post-response vars, such as `token: res.body.access_token`, `trace: res.headers["x-trace"]`, `code: res.status` and `sid: bru.cookies.get("sid")`; turned-off rules stay turned off. Bruno's vars last for the run, so a rule that writes to the environment becomes a `bru.setEnvVar(..., { persist: true })` line at the top of the post-response script instead. A JSON body path must be a plain path such as `$.data.items[0].id`; a rule that searches or filters, such as `$..id`, cannot be written as code and is listed in the summary.
- **Saved requests are found by their path in Bruno.** Bruno's `bru.runRequest` needs the request's path from the collection's root, such as `auth/Log in`, where Gostman's `sendRequest("Log in")` uses the name. The definition of `sendRequest` in a Bruno export holds the paths of the requests the script sends, so requests in folders and requests whose names are not valid file names are found. A name that matches no request in the collection is listed in the summary. Values from a data file are filled into the address and body of a request a script builds, as Gostman does.
- **The summary under the format says what to check.** Its heading counts the things that will not work in the other tool, such as `res("..id")` queries in Postman, `req.setTimeout` in Postman, `visualize` in Bruno and `pm.*` calls a Bruno export could not translate, each with its place, line and reason. Below it, **What changed** counts the scripts that needed no change, the scripts rewritten from another tool's API, the names that were defined, the rows that became tests and the extract rules that became script lines or vars. `gostman export` prints the same lines, prefixed with `note:` and `warning:`.
- **Importing the file again gives your scripts back.** The lines that define the Gostman names are recognised and removed, as long as nobody edited them, and the scripts read as they did in Gostman. The extract lines an export wrote come back as extract rules, with their scope; Bruno vars come back as session rules. Checks come back as assertion rows, whether they were exported as Bruno assertions or as tests, including turned-off rows exported as skipped Postman tests. Checks of folders and the collection come back as test code in the post-response script, which runs the same.

Insomnia has no export format of its own here: it imports the Postman file and runs its `pm.*` scripts. The file carries no globals: the global values in use become collection variables, and `env.globals.get` reads them from there when no global has that name.

### .http export

Each folder with requests becomes a `.http` file named after it, inside a folder for each parent folder; requests outside any folder go to `requests.http`. One file is saved as it is, several as a `.zip`.

- Each file starts with `@name = value` lines for the collection and folder variables that apply to it. Variables with secret-looking names or several lines are left out.
- Each request has a `###` line with its name, its description as `#` lines, `# @name` when the name has no spaces, and `# @no-redirect`, `# @timeout` and `# @prompt` when they apply.
- Basic, Digest and Bearer authentication and API keys are written as headers or query parameters. Other authentication types are noted in a comment.
- Bodies are written with a matching `Content-Type`. Form fields are URL-encoded and multipart file fields read their file with `< ./name`. GraphQL requests are `POST` requests with `X-Request-Type: GraphQL`.
- Dynamic variables are written in REST Client form, for example `{{$randomInt 1 10}}` and `{{$dotenv NAME}}`. A variable filled by an extract rule of a named request in the same file is written as a request variable such as `{{login.response.body.$.token}}`.
- Environments are written to `http-client.env.json`, and secret or secret-named values to `http-client.private.env.json`, empty unless you include credentials. A secret variable whose value is not stored with the collection, as in a folder workspace, is still listed there by name, so importing the files marks it secret again.
- Scripts, assertions, the Vars tab of a request, examples, folder settings, gRPC, MCP and WebSocket requests are not written.
- A request whose body has a line that .http files read as an instruction, such as `< ./file`, `>> output.txt`, `> {% ... %}` or `###`, is left out with a note, so opening the file in an editor never reads, writes or runs anything the request did not. Attached file names keep only their last part.

Importing the export again gives the same requests, folders, variables and environments, apart from what is listed above. Requests outside any folder come back in a `requests` folder.

### HTML docs options

Choosing **HTML docs** shows three options:

- **Documentation title**, which defaults to `API documentation`.
- **Include example responses**, on by default.
- **Include a Try it panel**, off by default.

What the page contains and how it redacts values is described in [Sharing and documentation](sharing-and-docs.md). From the command line, use `gostman docs`, see [Command line](cli.md).

![A generated documentation page with a sidebar listing requests grouped by folder, a variables section and a sign-in request with its body](../gostman-gui/frontend/src/assets/landing/docs.webp)

## OpenAPI specs

### Importing a spec

Load a spec from an address, a file or pasted text, then choose **Import**. Each operation becomes a request. A spec loaded from an address or an opened file is linked to the folder that the import creates, so you can sync it later. Variables that the spec defines, such as `baseUrl`, become the collection variables of that folder (**Environments**, **Collection variables** under its name), kept in its `folder.yaml` in a folder workspace. A path parameter becomes a `{{name}}` placeholder in the URL with a request variable that holds the example value, so `/users/{id}` is imported as `/users/{{id}}`.

### Spec viewer

Choose **Browse** in the import summary, or **Browse API spec** in the context menu of a linked folder, to open the **API spec** viewer. It has three tabs:

- **Operations** groups operations by tag, or **No tag** when they have none. **Search operations** matches the method and path, summary, operation id and tags. Selecting an operation shows its summary, description, **Authentication**, **Parameters**, **Request body** and **Responses**, with schemas and examples. Deprecated operations are struck through and badged. **Send to request tab** opens the operation as a new request.
- **Models** lists schemas, with **Search models**. Selecting one shows its fields.
- **Lint** shows linter findings.

### Spec sync

For a folder linked to a spec, the folder menu has **Check for spec updates**. It fetches the spec again and opens **Spec updates**, which shows when the folder was last synced and groups the differences as:

- **New operations**
- **Changed operations**
- **Removed operations**

Each item has a checkbox. Operations you edited in Gostman are marked **edited here** and start unchecked, because checking one replaces your edits to its URL, parameters, path variables, body and authentication. Choose **Apply selected** to add, update and remove the checked requests. When nothing differs, the dialog says **The collection already matches the spec.** A folder without a saved address shows **This collection has no saved spec address.**

### Contract checks

Every HTTP response to a request in a linked folder, or in one of its subfolders, is checked against the spec. The checks appear under **Contract** in the Checks tab of the response, count in its total, and fail a request in the runner like any other check:

- **Status 200 is documented for GET /pets/{id}**: the spec lists this status for the operation, as the exact code, a range such as `2XX`, or `default`. When it does not, the message lists the documented statuses and the other checks are skipped.
- **Content type application/json is documented**: the response's content type is one the spec lists for that status. `application/*` and `*/*` in the spec match too. This is checked only when the spec documents a body for the status.
- **Body matches the documented schema**: the JSON body matches the response schema, with each problem listed by its place in the body; see [JSON Schema checks](scripting-and-settings.md#json-schema-checks). This is checked only for JSON content types with a schema. As OpenAPI defines for responses, a required property marked `writeOnly` may be missing, and a `oneOf` or `anyOf` with a `discriminator` is checked only against the shape that the discriminator property names.

A request created from the spec is checked against its own operation. Other requests are matched by method and path: the path's last segments must fit the operation's template, such as `/pets/{id}`, and a path that starts with the base path of one of the spec's servers is preferred. When no operation matches, a note in the Checks tab says so and nothing is checked. Schemas may use `$ref` to the spec's components and to other files the spec refers to.

A folder that did not come from a spec, such as a collection imported from Postman, Bruno or Insomnia, can be checked too: choose **Check responses against a spec…** in its menu and enter the address of the spec, or a file path in the desktop app. Its requests are matched by method and path, and the folder menu then has **Browse API spec** and the switch below, but no **Check for spec updates**.

The spec is read again after each sync and once per app session. When it cannot be read, a note in the Checks tab says why. To switch the checks off for a folder, choose **Stop checking responses against the spec** in its menu; **Check responses against the spec** switches them back on.

`gostman run --contract spec.yaml` runs the same checks on the command line; see [Command line](cli.md).

### Linter

The **Lint** tab checks the spec and lists findings in three severities: errors, warnings and info. The buttons at the top show the count for each severity and toggle whether it is listed. A finding shows its message, the rule and the operation or path. Selecting a finding that belongs to an operation opens that operation in the **Operations** tab. A clean spec shows **No problems found.**

The **Lint API spec** command in the command palette opens the viewer on the Lint tab for the most recently synced linked spec. If no spec was imported from an address or a file, it tells you to import one first.

On the command line, `gostman lint` runs the same kind of check with report formats, a failure threshold and a rules file. See [Linting an OpenAPI spec](cli.md#linting-an-openapi-spec).

## Open in Gostman links

A link can ask Gostman to download a published collection or spec and import it. The link builder is in the Share tab, in a section titled **Open in Gostman link**.

1. Paste the public address of the file into **Public address of the collection**. It can be a Postman collection, OpenAPI file, Insomnia, HAR or Gostman export.
2. Copy one of the three results: **Web app link**, **README badge (Markdown)** or **Desktop app link**.

The builder refuses addresses that are not valid web addresses, are longer than 2,048 characters, contain a user name or password, or do not use `https`.

When someone opens the link, the **Open from a link** dialog shows the source host and address and a warning to continue only if they trust the sender. Nothing is downloaded until they choose **Download**, and nothing is imported until they choose **Import**. After the download, the dialog shows the detected format, the counts, how many items carry scripts, OAuth 2.0 settings, local MCP commands or file reads, and the files it would read. Those items are asked about before import, and imported folders stay restricted until you trust them. The link formats, size limits and restrictions are in [Sharing and documentation](sharing-and-docs.md).
