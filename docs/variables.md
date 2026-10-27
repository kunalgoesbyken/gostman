# Variables

Variables let you define a value once and reuse it across requests. Open **Environments** in the header (the sliders icon next to the environment picker) to edit them in a table.

## Scopes and precedence

When a name is defined in more than one place, the most specific scope wins. From lowest to highest:

| Scope | Where it is edited | Notes |
| --- | --- | --- |
| Global | Environments, **Globals** tab | Shared by every collection. One global environment is in use at a time. |
| Collection | Environments, **Collection variables**, or the **Vars** tab of the collection's settings | The shared list applies to every request; a folder workspace keeps it in `gostman.yaml`. Each collection, that is each top-level folder, can also keep its own list on top of the shared one, under **Collection variables** in the **Vars** tab of its top-level folder's settings; a folder workspace keeps it in that folder's `folder.yaml` (see [Environments per collection](#environments-per-collection)). Rows can be marked secret. |
| Environment | Environments, **Environments** tab | The environment selected in the header for the request's collection (see [Environments per collection](#environments-per-collection)). If it inherits from another environment, the parent's variables come first and the child overrides them. |
| Folder | Folder settings, **Vars** tab | Outer folders first, the request's own folder last. See [Folder and collection settings](folder-settings.md). |
| Request | **Vars** tab of a request | Rows can be switched off without deleting them. |
| Session | Environments, **Session values** | Set by scripts and Extract rules for this session only. Never written to disk. |

Values you give when you start a run or a send win over everything saved in the collection: `--var`, `--var-from-env` and `--env-file` in the CLI, each row of a data file (in the CLI and in the runner), and the `variables` of an agent's `send_request`. They are kept as session values, so a script or Extract rule that writes the same name later in the run replaces them, and each new data row replaces what the previous iteration left. In the runner they last for the run only: when it ends, the session values it set go back to what they were.

## Values set by scripts and Extract rules

Scripts choose where a value goes:

| Call | Where the value goes |
| --- | --- |
| `env.set`, `pm.environment.set`, `bru.setEnvVar` with `{ persist: true }`, `insomnia.environment.set` | The active environment. It is saved with the environment, in its YAML file in a folder workspace, unless the variable is marked secret, which keeps the value in the keychain. |
| `env.session.set`, `pm.variables.set`, `bru.setVar`, `bru.setEnvVar` without `persist`, `insomnia.variables.set` | Session values. |
| `env.collection.set`, `pm.collectionVariables.set`, `insomnia.collectionVariables.set`, `insomnia.baseEnvironment.set` | Collection variables: the request's collection when it keeps its own list (its top-level folder's `folder.yaml` in a folder workspace), otherwise the shared list (`gostman.yaml` in a folder workspace). A collection variable marked secret stays secret, so a token written there keeps its value on this device only. |
| `env.globals.set`, `pm.globals.set`, `bru.setGlobalEnvVar`, `insomnia.globals.set` | The global environment in use. When none is in use, a global environment named Globals is created and used. |

In the CLI and in agent sessions nothing is written to disk: a value lasts for the run (for an agent, the session) in the scope the script chose, so a collection variable a script sets still sits below the environment, and `unset` removes it from the request's collection variables only. They start with no global environment, so the first global a script sets creates one for the run.

Session values sit above every other scope, the way Postman's local variables and Bruno's runtime variables do. They are kept in memory: closing the app, opening another collection or **Clear session values** in the Environments dialog removes them. They are treated as secret, so hover previews mask them, and they never go into exports, share links or AI prompts. Setting a name in the environment, the collection or the globals removes the session value with that name, so the newest value wins; unsetting or clearing a scope leaves session values alone.

Use session values for tokens and other values that come from a response, so they are not committed to Git with the environment. Each scope object reads only its own scope: `pm.environment.get("token")` returns the active environment's value, while `pm.variables.get("token")` and `env.get("token")` return the value the request would use. `bru.getEnvVar` reads a session value with that name first, because `bru.setEnvVar` without `persist` keeps its value there. A number or `true`/`false` set by a script reads back as a number or a boolean, in the apps and the CLI alike; it becomes text only where it is filled into a request.

The Go engine, the desktop and web apps and the CLI resolve a name the same way.

## The environment table

Each environment is a table of rows: a checkbox (Use this variable) that turns the row on or off, a name, a value and a lock. Pick an environment in the list on the left, or create one with **New environment**; **Use this environment** makes it the active one.

![The Environments dialog with the Local environment selected: a green colour label, its variables, and the secret ones masked](../screenshots/environments.png)

- **Secret** (lock): the value is masked in the table (the eye reveals it) and in hover previews and suggestions. It is never written to the workspace YAML, to exports or to share links. See [Secret variables](#secret-variables).
- **Colour**: a label shown next to the environment picker, so production is hard to mistake for staging. Choose one of six colours, or the swatch with a plus for any colour from your system's colour picker.
- **Inherits from**: the environment whose variables are used first. Cycles are not offered.
- **Duplicate**, **Delete** and **Filter variables** (matches names and the values of non-secret rows).

Names may contain letters of any script, digits, underscores, dots and hyphens. Values can be strings, numbers or booleans; a value of `null` is treated as undefined.

## Environments per collection

In the app's own storage (the desktop app without a folder open, and the web app), every top-level folder is a collection, and an environment either belongs to one collection or is shared by all of them. Environments you create yourself are shared, so with one collection, or when you never move an environment, there is a single list and a single choice, as in Postman.

- **Imports**: environments that come with a Bruno or Insomnia collection belong to the folder the import creates, as they do in those tools, so two collections can each have their own `Local`. Postman environment files imported together with one Postman collection belong to it; otherwise they are shared, as are Postman data dumps, globals and `.http` environment files.
- **The picker** lists the environments of the active request's collection under its name, then the shared ones. Each collection remembers its own choice, so switching to a tab from another collection switches the environment with it; the picker's border flashes when that happens. A collection without environments of its own uses the shared choice.
- **Available in**: in the Environments dialog, set an environment to **Every collection** to share it, or to one collection to keep it there. The control appears when there is more than one collection. **New environment** creates one in the active request's collection when that collection has environments of its own, and a shared one otherwise.
- **Everywhere else** the request decides: a send, a run (each request uses its own collection's environment), values that scripts and Extract rules write, and OAuth 2.0 tokens. Sharing a folder includes the shared environments and the ones of its collection; a Gostman export keeps which folder each environment belongs to.
- **Collection variables** follow the same idea. A collection imported from Postman, Bruno, Insomnia, an OpenAPI spec or a WSDL file keeps its own collection variables, so two collections can each have their own `baseUrl` or `apiVersion`; they apply to its requests, on top of the shared collection variables, and an environment still wins over both. Scripts (`pm.collectionVariables.set` and the like) write to the request's own collection variables when it has them, and to the shared ones otherwise. In the Environments dialog, **Collection variables** under the collection's name edits the list of the active request's collection, and the one under **Shared** edits the shared list, which is listed for a collection with its own list only when it has values. The same lists are in the **Vars** tab of the top-level folder's **Collection settings** (the collection's own) and of **Settings for all collections** (the shared one). Collections you create yourself and data saved before this change use the shared list until you add a variable to their own. Folder workspaces keep these lists too (see below). Exports and shares carry each collection's list and, in a full export or a share of everything, the shared list; a folder share carries the shared variables its requests use onto the shared folder, and a share without values carries only the names. Collection variables have the same secret lock as environment variables; the secret check of **Export** and **Share**, and `gostman scan`, look at collection variables too, and never see the values of secret ones.
- **The CLI** does the same for an export from the app. Without `--folder`, `gostman run` and `send` give each request its collection's environment: without `--env`, the collection's first own environment, or the first shared one for a collection without its own (and for requests outside any collection). `--env Name` picks the collection's own environment named Name, or the shared one with that name, so `--env Local` runs every collection against its own `Local`. When a collection with environments of its own has neither, nothing is sent and the error names the collection; run it on its own with `--folder`. With `--folder`, one environment is used for the whole run.
- A folder workspace keeps one list of environments, so its environments are always shared and environment files carry no folder. Its top-level folders still count as collections for collection variables, so precedence is the same as in the app's own storage: the shared list is in `gostman.yaml`, and a top-level folder keeps its own as `collectionVariables` in its `folder.yaml`, with secret and off marks in `collectionVariablesMeta` and never a secret value. Edit it under **Collection variables** in the **Vars** tab of the folder's settings, or under its name in the Environments dialog. **Save collection to folder** and `gostman import` write each collection's list into its own folder, so no value changes. They keep every environment too: when two collections each have a `Dev`, the collections' ones are saved as `Dev (Ledger)` and `Dev (Orders)`, and a notice lists the new names. Workspaces saved by earlier versions, which put every collection's variables into `gostman.yaml`, keep working as they are. Older versions of Gostman ignore a folder's own list, so there its requests see only the shared list, and they keep the list in the file when they save the folder.

## Using variables

Write `{{name}}` wherever the value should appear: URL, query parameters and headers (keys and values), body (including form and multipart text fields), auth fields, GraphQL query and variables, and WebSocket URL and headers.

- Names are case-sensitive and whitespace inside the braces is ignored: `{{ name }}` is `{{name}}`.
- A placeholder with no matching variable is left as written, so the mistake is visible in the request that goes out. The response view names such placeholders in a notice with a link to the Environments dialog, and `gostman run` and `send` print a warning for them. Dynamic values (`{{$...}}`) and prompts (`{{?...}}`) are not listed.
- Every occurrence is replaced. Values are inserted as they are; a value placed in a URL is not percent-encoded apart from spaces.
- A value can refer to other variables: with `host` set to `https://api.example.com` and `api` to `{{host}}/v1`, `{{api}}/users` becomes `https://api.example.com/v1/users`. Values are filled in up to 8 levels deep; a placeholder deeper than that, or one that refers back to a variable being filled in, is left as written, the same way in the apps' previews, in scripts and in what is sent. One field fills in at most 10,000 values that themselves hold placeholders and leaves the rest as written, and a request that needs more than 100,000 in all is not sent. A dynamic value inside a variable, such as `{{$guid}}`, is generated once per request, so every use of that variable gets the same value. `{{$file(...)}}` inside a variable's value is never read; write it in the request itself.
- In fields with variable support, defined names are underlined, hovering shows the value (masked for secrets) and the scope it came from, and typing `{{` or pressing Ctrl+Space offers completions. For a value that refers to other variables, the hover also shows what it resolves to and through which variables, with secret parts masked.

## Secret variables

Mark a row as secret with its lock. Environment variables, global variables and collection variables (shared and per collection) all have it.

- **Desktop**: values live in the operating system keychain (Windows Credential Manager, macOS Keychain, the Secret Service on Linux). If no keychain is available they are kept in `secrets.enc` in the app data folder, encrypted with AES-256-GCM using a key file next to it. That fallback protects against casual reading and accidental sharing, not against someone who can read both files.
- Only the name of a secret variable is written to the environment file (as `meta`), or for collection variables to `gostman.yaml` (as `variablesMeta`) or to the top-level folder's `folder.yaml` (as `collectionVariablesMeta`), never its value. Copying a workspace folder to another computer therefore leaves the secret values behind.
- **Web**: there is no keychain in a browser, so values stay in the browser's storage (IndexedDB) and are still left out of exports and share links.
- **CLI**: provide the value yourself, for example `gostman run <collection> --var-from-env API_TOKEN` (the environment variable name becomes the variable name) or `--var token=value`.
- **A variable you do not mark is saved as plain text.** When the value of an unmarked variable looks like a credential (a known token format such as a GitHub or AWS key, a JSON Web Token, a private key, or a random-looking value under a name such as `token` or `api_key`), the row shows a warning with a **Mark as secret** button. The check runs in your window and never sends the value anywhere. Short passwords are not recognised, so mark those yourself.
- **`.gitignore`**: a new workspace folder gets a `.gitignore` that keeps `.env`, `.env.*` (except `.env.example`) and the `.gostman-*.tmp` leftovers of an interrupted save out of Git. An existing `.gitignore` is never changed, and workspaces created by earlier versions get the file when you run `gostman init` on them.

## Secret managers

A variable can read its value from HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, Google Cloud Secret Manager, KeePassXC, 1Password, Bitwarden or Bitwarden Secrets Manager. In the environment table choose the key icon on a row, pick a connection and give the secret path, an optional field and, for the secret managers, an optional version. [Password managers](secrets-and-network.md#password-managers) describes each password manager. **Test** reads the secret and shows only that it worked and how many characters it has.

- The collection stores only the reference. Connections (address, namespace, sign-in) are settings of this computer under **Secret managers**, with credentials in the keychain, so a cloned collection cannot point your credentials at its own server. An unknown connection name fails with a message.
- References are resolved when a request is sent and cached in memory for five minutes. Values are never saved, exported or shared. If a reference cannot be read the request is not sent.
- Folders that are not trusted yet never resolve references.
- Desktop app and CLI only; KeePassXC works in the desktop app only. See the [command line](cli.md) page for the CLI variables, `--secrets` and `--secrets-env-file`.

## Dynamic variables

Dynamic variables are generated by the engine every time a request is sent, so each occurrence gets its own value. They are the same in the apps and the CLI. Type `{{$` in any field or editor to pick one; every suggestion says what it produces.

| Variable | Value |
| --- | --- |
| `{{$guid}}`, `{{$uuid}}`, `{{$randomUUID}}` | Random UUID v4 |
| `{{$timestamp}}`, `{{$timestampMs}}` | Unix time in seconds, in milliseconds |
| `{{$isoTimestamp}}` | UTC time such as `2026-10-21T15:18:24.870Z` |
| `{{$randomInt}}`, `{{$randomInt(min,max)}}` | Integer from 0 to 1000, or from `min` to `max` |
| `{{$randomBoolean}}`, `{{$randomHex}}`, `{{$randomAlphaNumeric}}` | Random boolean, 16 hex characters, 12 letters and digits |
| `{{$randomColor}}`, `{{$randomHexColor}}`, `{{$randomColorName}}` | A `#rrggbb` colour, or a colour name |

The `$random*` names follow Postman's, so collections imported from Postman keep working. Groups:

| Group | Variables |
| --- | --- |
| Names and jobs | `$randomFirstName`, `$randomLastName`, `$randomFullName`, `$randomNamePrefix`, `$randomNameSuffix`, `$randomJobTitle`, `$randomJobArea`, `$randomJobDescriptor`, `$randomJobType` |
| Contact and location | `$randomEmail`, `$randomExampleEmail`, `$randomUserName`, `$randomPhoneNumber`, `$randomPhoneNumberExt`, `$randomCity`, `$randomStreetName`, `$randomStreetAddress`, `$randomZipCode`, `$randomState`, `$randomCountry`, `$randomCountryCode`, `$randomLatitude`, `$randomLongitude`, `$randomTimeZone`, `$randomLocale` |
| Dates | `$randomDatePast`, `$randomDateFuture`, `$randomDateRecent`, `$randomDateSoon`, `$randomBirthdate`, `$randomWeekday`, `$randomMonth` |
| Internet | `$randomIP`, `$randomIPV6`, `$randomMACAddress`, `$randomPassword`, `$randomUserAgent`, `$randomProtocol`, `$randomSemver`, `$randomUrl`, `$randomDomainName`, `$randomDomainSuffix`, `$randomDomainWord` |
| Finance and shop | `$randomPrice`, `$randomBankAccount`, `$randomBankAccountName`, `$randomBankAccountBic`, `$randomBankAccountIban`, `$randomCreditCardNumber`, `$randomCreditCardMask`, `$randomTransactionType`, `$randomCurrencyCode`, `$randomCurrencyName`, `$randomCurrencySymbol`, `$randomBitcoin`, `$randomProduct`, `$randomProductName`, `$randomProductAdjective`, `$randomProductMaterial`, `$randomDepartment` |
| Business | `$randomCompanyName`, `$randomCompanySuffix`, `$randomCatchPhrase`, `$randomCatchPhraseAdjective`, `$randomCatchPhraseDescriptor`, `$randomCatchPhraseNoun`, `$randomBs`, `$randomBsAdjective`, `$randomBsBuzz`, `$randomBsNoun` |
| Files and data | `$randomFileName`, `$randomFileType`, `$randomFileExt`, `$randomCommonFileName`, `$randomCommonFileType`, `$randomCommonFileExt`, `$randomFilePath`, `$randomDirectoryPath`, `$randomMimeType`, `$randomDatabaseColumn`, `$randomDatabaseType`, `$randomDatabaseCollation`, `$randomDatabaseEngine` |
| Images | `$randomAvatarImage`, `$randomImageUrl`, `$randomImageDataUri`, and one per category such as `$randomCatsImage` or `$randomFoodImage` |
| Words | `$randomWord`, `$randomWords`, `$randomNoun`, `$randomVerb`, `$randomIngverb`, `$randomAdjective`, `$randomAbbreviation`, `$randomPhrase` |
| Lorem ipsum | `$randomLoremWord`, `$randomLoremWords`, `$randomLoremSentence`, `$randomLoremSentences`, `$randomLoremParagraph`, `$randomLoremParagraphs`, `$randomLoremText`, `$randomLoremSlug`, `$randomLoremLines` |

- Dates are UTC in ISO 8601, such as `2027-03-17T13:11:50.000Z`. `$randomBirthdate` is a date such as `1990-04-12` for someone aged 18 to 80.
- `$randomBankAccountIban` has valid check digits and `$randomCreditCardNumber` passes the Luhn check, so validators accept them. Neither belongs to a real account.
- Every value is a single line, so it is safe inside a JSON string. Emails use `example.*` domains.
- The sample data is in English.

A variable you define with the same name takes precedence. The code snippet view and the request that is actually sent each generate their own values.

### Faker names

Every generator also has a name in the style of the faker library, such as `{{$faker.date.future}}`, `{{$faker.person.fullName}}`, `{{$faker.location.city}}` or `{{$faker.finance.iban}}`. Typing `faker.` in a body or field lists them, and the one you pick is inserted as `{{$faker...}}`. The groups are `string`, `number`, `datatype`, `color`, `person`, `phone`, `location`, `internet`, `system`, `image`, `finance`, `company`, `database`, `date`, `commerce`, `hacker`, `word` and `lorem`.

### Reading files

`{{$file(path)}}` is replaced by the contents of a file as text, and `{{$fileBase64(path)}}` by its contents encoded as base64, for example to send a PDF inside a JSON body:

```json
{ "type": "application/pdf", "base64content": "{{$fileBase64(fixtures/invoice.pdf)}}" }
```

- Files are read when the request is sent: by the desktop app, and by `gostman run`, `send` and `load` when you pass `--allow-files`, so a collection you did not write cannot send your files. The web app and agent sessions (`gostman mcp`) do not read files, a request that uses them there is not sent, and an agent cannot save a request that reads a file.
- A path starts at the workspace folder in the desktop app, and at the workspace folder or export file given to the CLI (the current folder for a request given as a method and a URL), and must stay inside that folder: `..`, absolute paths, `~/` and links that lead outside it are refused, so a collection cannot read other files on your computer. Without a workspace folder, the desktop app reads absolute paths, and `~/` is your home folder.
- Network paths such as `\\server\share\file.txt` or `//server/share/file.txt`, and device paths such as `\\.\pipe\name`, `\\?\C:\...` or `COM1`, are refused with a message, so reading a file never makes Windows send your sign-in to another computer. Copy the file to this computer, or map the share to a drive letter.
- A file can be up to 10 MB, all the files a request reads at most 10 MB together, and the whole request at most 10 MB once filled in. A file that cannot be read stops the send with a message.
- File placeholders count as active content, like scripts: a folder that is not trusted does not read files, imports, share links and pasted curl commands list the paths they read and ask before keeping them, and importing without active content removes them.
- The code snippet view shows the placeholder, not the file.
- Files are read in HTTP and GraphQL requests. A gRPC or MCP request or a WebSocket message that uses `{{$file(...)}}` is not sent.

## Prompt variables

`{{?name}}` asks for a value when the request is sent. A dialog lists every prompted name found in the request, pre-filled with a variable of the same name if one exists. Cancelling the dialog stops the send. The values are not saved.

In the CLI, `--var name=value` (or `--var-from-env`) supplies the value; without one the placeholder is left as written. The runner asks once per run: each name is asked the first time a request uses it, and later requests and iterations reuse the answer. The dialog says so, and its button reads **Continue run**. Cancelling marks that request as failed, and every later request that needs a prompted value fails without asking again; the run goes on unless **Stop on failure** is checked.

## .env files

In a folder workspace, a `.env` file next to `gostman.yaml` is read as process environment variables and exposed as `{{process.env.NAME}}`. Lines look like `NAME=value`, `export NAME=value` or `NAME="quoted value"`; `#` starts a comment. The file is listed read-only in the Environments dialog (values masked), is never written back and never exported. `gostman run` on a workspace folder reads it too. Other operating system variables are not exposed; pass them with `--var-from-env`.

## Setting variables from a response

The **Extract** tab stores rules on a request. After each response, every enabled rule copies a value into a variable. **Keep in** chooses where:

- **Session**: a session value, never written to disk. This is the default in a folder workspace, where environment files are usually shared through Git and a token written there would be committed with them.
- **Environment**: the active environment, saved with it. This is the default when the collection is kept in the app's own storage, which is never shared, so existing rules keep working as before.

A rule saved with an explicit choice keeps it wherever the collection is opened. In the CLI a rule without a choice keeps its value as a session value; nothing is written to disk either way.

| Source | Expression | Example |
| --- | --- | --- |
| JSON body | JSONPath | `$.data.token` |
| Header | Header name, case-insensitive | `Location` |
| Cookie | Cookie name | `session` |
| Status code | none | `200` |

Rules run in the background with the collection's script time limit (10 seconds unless you change it). Rules that run past it, usually because of a slow regular expression in a JSONPath filter, keep no values: the Extract tab and the Checks tab of the response say so, the runner and `gostman run` count the request as failed, and its checks and post-response script still run. The value column of the Extract tab is worked out the same way, so a slow rule shows that it was stopped instead of holding up the app.

## Where substitution happens

Substitution is done by the Go engine in [`engine/`](../engine) when the request is prepared, identically for the desktop app, the web version and the CLI. Scope resolution runs in the frontend for the apps and in [`runner/variables.go`](../runner/variables.go) for the CLI.
