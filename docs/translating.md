# Translating Gostman

The Gostman interface can be shown in other languages. English is the source. Every other language is a folder of JSON files in the repository, and a language appears in **Preferences > Language** when at least half of the English messages are translated.

This page is for people who want to translate or review, and for developers who add text to the app.

What is translated: the app, desktop and web. What stays English: the command line, the documentation, the landing page, generated files (exports, run reports, code snippets), AI prompts and the errors that script libraries throw inside your scripts.

## Request a language or report a translation

All translation work is tracked in one issue: [Translations: request a language or help translate (#15)](https://github.com/kunalgoesbyken/gostman/issues/15).

- Ask for a language that is not listed.
- Offer to translate or to review a language.
- Report a wrong, awkward or missing translation. Name the language, quote the text and say where it appears.

The issue stays open. It holds a table with the status of each language.

## Translate

Translate on [Weblate](https://hosted.weblate.org/engage/gostman/). Changes arrive as pull requests, and CI checks them like any other change. You can also send a pull request that edits the files in `locales/<language>/` as described under [How the files work](#how-the-files-work). Both routes end in the same files, and the same checks run on both.

Before you start:

1. Read the [style and glossary](#style-and-glossary) below.
2. Read the notes in `locales/_notes/<namespace>.json` for the file you translate. They explain short or ambiguous messages, such as where a single word like "Raw" appears.
3. Check the glossary for your language in `locales/_glossary/<language>.csv` and keep to its terms.

### Seed translations and review

Some languages are first drafted with an AI model, so that the interface is usable from the start. These drafts are seeds. Native speakers are expected to read and correct them. A language is not final until someone who speaks it has reviewed it, and the status table in [#15](https://github.com/kunalgoesbyken/gostman/issues/15) says which languages are still drafts.

The seed languages are French, German, Spanish, Brazilian Portuguese, Italian, Romanian, Polish, Japanese and Simplified Chinese. Right-to-left languages are supported too: the layout mirrors and code stays left to right. A language counts as available only when it shows up in the Language list of the release you run.

If you review a seed:

- Read the strings in the order you meet them in the app. Preferences, the request editor, the response panel, Run requests and Import cover most of the interface.
- Fix wrong terms first. Then fix wording that no native speaker would write.
- Keep the length close to the English for buttons, tabs and menu items. About 130% is the limit before text starts to wrap or be cut off.

### Style and glossary

Write plain, calm sentences, like the English. No hype, no exclamation marks that the English does not have. Use sentence case. Buttons take the imperative or the shortest natural label. Follow the punctuation and spacing rules of your language, for example non-breaking spaces before `:;?!` in French, full-width punctuation in Japanese and Chinese, and „…“ quotes in German. Address the reader the way common developer tools in your language do.

Do not translate:

- Product, protocol and format names: Gostman, REST, GraphQL, gRPC, WebSocket, Socket.IO, MQTT, MCP, SSE, SOAP, WSDL, HTTP, URL, JSON, JSONPath, JSON Schema, XML, YAML, CSV, HTML, HAR, curl, OpenAPI, Swagger, OAuth 2.0, PKCE, JWT, TLS, PEM, PFX, DNS, CLI, API, UUID, Base64, Git and GitHub.
- Names of other tools and services: Postman, Insomnia, Bruno, KeePassXC, 1Password, Bitwarden, Vault, AWS, Azure, Google Cloud.
- HTTP methods, status codes and reason phrases, header names and MIME types.
- Script object names (`pm`, `bru`, `insomnia`), file names, command lines and anything in code font.
- Placeholders such as `{{name}}`. You may move them inside the sentence, but not rename or remove them.
- Key names as written on a keyboard.

Translate these terms the same way everywhere. Each language has one equivalent per term, kept in `locales/_glossary/<language>.csv` (header `source,target`):

request, response, collection, collection settings, folder, workspace, environment, variable, secret, secret manager, header, body, query parameter, path parameter, cookie, auth, token, pre-request script, post-response script, check, extract rule, runner, iteration, flow, step, mock server, capture, example, history, tab, sidebar, preferences, theme, scan, finding, load test, import, export, share link, trust (a folder), restricted, proxy, certificate, timeout, send.

Keep one message per sentence. If the English cannot be translated well because it was built from pieces, report it in #15 instead of working around it.

## How the files work

```text
locales/
  en/<namespace>.json         English, the source
  <language>/<namespace>.json translations
  _notes/<namespace>.json     notes for translators
  _glossary/<language>.csv    seed glossary
```

A language folder is named with a BCP 47 code: `fr`, `pt-BR`, `zh-Hans`, `es-419`. A file has the same name and the same keys as its English file. A translation may leave keys out. A missing key shows the English text.

Files are i18next JSON v4. Keys are nested, and values are strings:

```json
{
  "runner": {
    "title": "Run requests",
    "rows_one": "{{count}} row",
    "rows_other": "{{count}} rows",
    "includeRequest": "Run {{name}}"
  }
}
```

### Placeholders

- `{{name}}` is replaced by a value. Keep every placeholder the English message has, with the same spelling.
- A message must not contain any other `{{` or `}}`. Where the English shows Gostman's own variable syntax, the text arrives as a placeholder, so you cannot break it.
- `{{count}}` is the number that picks a plural form.

### Plurals

Plural messages have one key per plural category of the language, written as a suffix: `_zero`, `_one`, `_two`, `_few`, `_many` and `_other`. The categories come from the CLDR rules, and the check lists the ones your language uses:

| Language | Categories |
| --- | --- |
| Japanese, Chinese | `other` |
| German | `one`, `other` |
| Romanian | `one`, `few`, `other` |
| French, Spanish, Italian, Portuguese | `one`, `many`, `other` |
| Polish | `one`, `few`, `many`, `other` |
| Arabic | `zero`, `one`, `two`, `few`, `many`, `other` |

`_other` is required. If a category is missing, the app uses `_other`. In French, Spanish, Italian and Portuguese, `many` is used for exact millions such as "1 000 000 de requêtes". The `_one` form may leave out `{{count}}` ("One row").

### Check your files

From `gostman-gui/frontend`:

```bash
npm run i18n:check
```

The command lists errors and the coverage of every language. It exits with 1 on errors, and the same check runs in every build and in CI. These are errors:

- invalid JSON, or a value that is not a string or an object;
- a key that does not exist in English;
- a placeholder the English message does not have, or an English placeholder that is missing;
- a plural form that the language does not use, or a plural group without `_other`;
- a note for a key that does not exist.

Missing translations are not errors. They are counted in one line per language. Add `--verbose` to list them.

`npm run i18n:prune` removes keys that English no longer has. `npm run i18n:prune -- --drop runner.runner.title` removes one key from every translation, which is how a translation is retired after the English meaning changed.

### See your language in the app

The Language list shows a language once at least 50% of the English messages are translated. Run the web app, as described in [CONTRIBUTING.md](https://github.com/kunalgoesbyken/gostman/blob/main/CONTRIBUTING.md), and choose the language in Preferences. Choosing a language reloads the page. Open tabs and drafts are kept, and responses shown in tabs are cleared.

The dev server also lists two test languages that exist only in memory:

- **en-XA** has accented letters, is about 35% longer than English and wraps every message in brackets. A message that shows no accents is text that is still hard-coded.
- **ar-XB** is accented and right to left. It checks the mirrored layout.

Set `GOSTMAN_PSEUDO_LOCALES=1` to get them in a production build too.

## Add text to the app

This part is for developers.

**Where English lives.** Each text module in `gostman-gui/frontend/src/lib/` (`runnerText.js`) has a file `locales/en/<namespace>.json` (`runner.json`). The namespace is the module name without `Text`. The top level of the file has one object for each exported `*_TEXT` constant, named in camelCase: `RUNNER_TEXT` is `runner`.

A module reads its English with `messages(namespace, english, adapt)` from `src/lib/i18n/core.js`:

- A string without placeholders becomes a property that is read when used.
- A string with placeholders or plural forms becomes a function. A plain object argument gives the placeholders. A single value is bound to the only placeholder, or to `count` for plurals.
- `adapt` keeps older call signatures, such as `tests(passed, total)`.

**Rules for messages.**

- Write whole sentences. Never build a sentence from translated pieces. Write two messages instead of `${isRunning ? "Running" : "Ran"} ${done}`.
- Lists go through `formatList(items, "conjunction" | "disjunction")`, and numbers, dates and sizes through `src/lib/i18n/format.js`. Do not call `toLocale*` or `Intl.*` in app code.
- Do not use arrays. Use named keys and rebuild the array in a getter.
- Where the text must show Gostman's own `{{variable}}` syntax, pass it as a parameter.
- Keep brand and protocol names in the English text.
- Add a note to `locales/_notes/<namespace>.json` for a short or ambiguous message. The key is the message id, for example `"runner.rows": "A count of data rows in a run."`.
- Text that code parses, or that goes to another program, stays English: AI prompts, script API errors, exported files, run reports and the CLI. A message that a person reads in the app is translated even if it is also saved, such as the default name "New request".

**Do not read text while a module loads.** Statically imported modules evaluate before the language is loaded. A text property read at the top level of a module would stay English. The build fails with the file, line and column of every such read. Aliasing a group is fine (`const TEXT = RUNNER_TEXT.runner`). Build lists in a function or a getter, not in a top-level constant, and do not create `Intl` objects at the top level.

**Modules that run in the CLI** (`checksText`, `flowsText`, `mcpText`, `oauthText`, `folderSettingsText` and what `src/cli/runtime.js` reaches) must also run without `Intl`, `TextEncoder`, dates or randomness. Run `npm run build:cli` after changing them.

**Changing English.** When you change what an English message means, drop the old translations with `npm run i18n:prune -- --drop namespace.key.path`, so no language keeps a wrong text. When you only fix a typo, leave them.

### Messages from Go

Go builds some texts shown to people: network failures, import remarks, scan findings, OpenAPI lint results and mock reasons. They live in `locales/en/*Messages.json` (`engineMessages`, `importerMessages`, `scanMessages`, `lintMessages`, `mockMessages`), and the Go package `locales` renders the English from the same files. The command line prints that English.

A struct that carries such a text also carries a `localized` field with the message code and its parameters. The interface translates it by code and shows the English text if no translation exists. `src/lib/localized.js` does this.

Codes are Go constants generated from the JSON:

```bash
go generate ./locales
```

CI runs the command and fails when it leaves a difference in `locales/`. Run it and commit the result when you add, rename or remove a Go message.

### How a language appears

Creating `locales/<code>/` with translated files is all it takes. There is no registry and no code change. The app shows a language in the list when at least 50% of the English messages are translated. The native name comes from the browser's `Intl.DisplayNames`. The direction comes from `RTL_LANGUAGES` in `src/lib/i18n/languages.js`, which already has Arabic, Persian, Hebrew, Urdu and other right-to-left languages. Every other language is one lazy file, loaded only when chosen.

## Maintainers: Weblate setup

Translations are meant to be edited on [Weblate](https://weblate.org) (hosted, free for open-source projects). Weblate reads the files in `locales/` and opens pull requests, so CI checks every translation before it merges. A summary of the setup:

1. Create the project `gostman` on hosted.weblate.org and request the Libre plan. Turn on reviews, so strings that come from the repository are "Translated" and wait for approval.
2. Create the first component from the repository: version control GitHub pull request, branch `main`, file format i18next JSON v4, file mask `locales/*/preferences.json`, base file `locales/en/preferences.json`, language code style BCP with hyphens.
3. Add the Component discovery add-on with a regular expression that matches `locales/<language>/<namespace>.json`, so each namespace becomes a component. Add the Cleanup translation files, Add missing languages and Squash Git commits add-ons.
4. Add a GitHub webhook to `https://hosted.weblate.org/hooks/github/` for push events.
5. Upload `locales/_glossary/<language>.csv` to the project glossary. Paste the notes from `locales/_notes/` into the matching strings as explanations.
6. Done: the project is linked from the README, this page and the Language section of Preferences.

Seed translations are never marked "needs editing", because Weblate does not write that state back to the files. Drafts are tracked in [#15](https://github.com/kunalgoesbyken/gostman/issues/15) instead.
