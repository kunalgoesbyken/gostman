# Variables

Variables let you define a value once and reuse it across requests. Open **Environments** in the header (the sliders icon next to the environment picker) to edit them in a table.

## Scopes and precedence

When a name is defined in more than one place, the most specific scope wins. From lowest to highest:

| Scope | Where it is edited | Notes |
| --- | --- | --- |
| Global | Environments, **Global** tab | Shared by every collection. One global environment is in use at a time. |
| Collection | Environments, **Collection variables** | Applies to every request in the collection. Stored in `gostman.yaml` for folder workspaces. |
| Environment | Environments, **Collection** tab | The environment selected in the header. If it inherits from another environment, the parent's variables come first and the child overrides them. |
| Folder | Folder settings, **Vars** tab | Outer folders first, the request's own folder last. See [Folder and collection settings](folder-settings.md). |
| Request | **Vars** tab of a request | Rows can be switched off without deleting them. |

Values written by Extract rules and scripts (`env.set`) are saved into the active environment, so they take part as environment variables.

The Go engine, the desktop and web apps and the CLI resolve a name the same way, apart from global environments, which exist in the apps only.

## The environment table

Each environment is a table of rows: a name, a value, an on/off switch and a lock.

![The Environments dialog with the Local environment selected: a green colour label, its variables, and the secret ones masked](../screenshots/environments.png)

- **Secret** (lock): the value is masked in the table (the eye reveals it) and in hover previews and suggestions. It is never written to the workspace YAML, to exports or to share links. See [Secret variables](#secret-variables).
- **Colour**: a label shown next to the environment picker, so production is hard to mistake for staging. Choose one of six colours, or the swatch with a plus for any colour from your system's colour picker.
- **Inherits from**: the environment whose variables are used first. Cycles are not offered.
- **Duplicate**, **Delete** and **Filter variables** (matches names and the values of non-secret rows).

Names may contain letters of any script, digits, underscores, dots and hyphens. Values can be strings, numbers or booleans; a value of `null` is treated as undefined.

## Using variables

Write `{{name}}` wherever the value should appear: URL, query parameters and headers (keys and values), body (including form and multipart text fields), auth fields, GraphQL query and variables, and WebSocket URL and headers.

- Names are case-sensitive and whitespace inside the braces is ignored: `{{ name }}` is `{{name}}`.
- A placeholder with no matching variable is left as written, so the mistake is visible in the request that goes out.
- Every occurrence is replaced. Values are inserted as they are; a value placed in a URL is not percent-encoded apart from spaces.
- Placeholders are not expanded recursively.
- In fields with variable support, defined names are underlined, hovering shows the value (masked for secrets) and the scope it came from, and typing `{{` or pressing Ctrl+Space offers completions.

## Secret variables

Mark a row as secret with its lock.

- **Desktop**: values live in the operating system keychain (Windows Credential Manager, macOS Keychain, the Secret Service on Linux). If no keychain is available they are kept in `secrets.enc` in the app data folder, encrypted with AES-256-GCM using a key file next to it. That fallback protects against casual reading and accidental sharing, not against someone who can read both files.
- Only the name of a secret variable is written to the environment file (as `meta`), never its value. Copying a workspace folder to another computer therefore leaves the secret values behind.
- **Web**: there is no keychain in a browser, so values stay in the browser's local storage and are still left out of exports and share links.
- **CLI**: provide the value yourself, for example `gostman run <collection> --var-from-env API_TOKEN` (the environment variable name becomes the variable name) or `--var token=value`.

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
- A file can be up to 10 MB, all the files a request reads at most 10 MB together, and the whole request at most 10 MB once filled in. A file that cannot be read stops the send with a message.
- File placeholders count as active content, like scripts: a folder that is not trusted does not read files, imports ask before keeping them, and importing without active content removes them.
- The code snippet view shows the placeholder, not the file.
- Files are read in HTTP and GraphQL requests. A gRPC or MCP request or a WebSocket message that uses `{{$file(...)}}` is not sent.

## Prompt variables

`{{?name}}` asks for a value when the request is sent. A dialog lists every prompted name found in the request, pre-filled with a variable of the same name if one exists. Cancelling the dialog stops the send. The values are not saved.

In the CLI, `--var name=value` (or `--var-from-env`) supplies the value; without one the placeholder is left as written. Runs from the runner dialog do not prompt.

## .env files

In a folder workspace, a `.env` file next to `gostman.yaml` is read as process environment variables and exposed as `{{process.env.NAME}}`. Lines look like `NAME=value`, `export NAME=value` or `NAME="quoted value"`; `#` starts a comment. The file is listed read-only in the Environments dialog (values masked), is never written back and never exported. `gostman run` on a workspace folder reads it too. Other operating system variables are not exposed; pass them with `--var-from-env`.

## Setting variables from a response

The **Extract** tab stores rules on a request. After each response, every enabled rule copies a value into the active environment:

| Source | Expression | Example |
| --- | --- | --- |
| JSON body | JSONPath | `$.data.token` |
| Header | Header name, case-insensitive | `Location` |
| Cookie | Cookie name | `session` |
| Status code | none | `200` |

## Where substitution happens

Substitution is done by the Go engine in [`engine/`](../engine) when the request is prepared, identically for the desktop app, the web version and the CLI. Scope resolution runs in the frontend for the apps and in [`runner/variables.go`](../runner/variables.go) for the CLI.
