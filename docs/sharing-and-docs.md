# Sharing and documentation

The **Share** tab of the import dialog encrypts a request, a folder or the whole collection in your window (AES-256-GCM) and gives you a link, or an encrypted file plus a key. Nothing is uploaded: the key sits after the `#` in the link, which browsers do not send to servers.

- Anyone holding the whole link can open it. Use a passphrase, or the file with the key sent separately, for anything sensitive.
- Variable values and saved responses are left out unless you tick them. OAuth tokens, cookies, history and network settings are never included.
- The recipient sees what is inside before importing, and their own variable values are kept.
- A link carries up to 32 KB; larger selections go as a file.
- A secret scan runs on the selection. When it finds credentials, no link or file is made until you choose **Share anyway**.

Open it with the **Import** button in the header and the **Share** tab, with the **Share collection** command in the command palette, or by right-clicking a folder or a request and choosing **Share folder** or **Share request**, which selects it for you. The tab has these settings:

| Setting | What it does |
| --- | --- |
| **Share** | **Everything**, one folder with the folders and requests inside it, or the request you chose **Share request** on. A shared request comes with the folders above it, without their other requests, so the auth, headers and scripts it inherits come along |
| **Share variable values** | Off: the recipient gets the variable names only. On: the values too, except secret ones. A folder or a single request carries only the environment variables it uses, in placeholders such as `{{baseUrl}}`, in the variables those refer to, and in quoted names in its scripts; the tab lists them |
| **Include saved example responses** | Adds the examples saved with each request |
| **Protection** | **Random key** puts the key in the link. **Passphrase** asks for one of at least 8 characters, which is not in the link; tell the recipient through another channel |
| **Send as** | **Link** gives a link to copy. **Encrypted file** gives **Save file** and, with a random key, the key to send separately |

A request whose Auth tab holds a typed-in password, token or key is flagged under the settings: that value belongs to the request and is shared with it. Use a `{{variable}}` instead to keep it out.

### Opening a share

Opening a link shows **Shared with you**. Nothing is added until you choose **Import**:

1. If the share has a passphrase, or is a file sent without its key, enter it and choose **Open**. A wrong passphrase or a changed share says so and imports nothing.
2. The dialog lists the folders, requests and environments inside, and which variables come with values.
3. **Import** adds them next to what you have. A folder with the same name as one of yours is added as a second folder, and variables you already have keep your values.
4. If an item carries scripts, OAuth 2.0 settings, local MCP commands or file reads, the dialog says how many, and you are asked about those separately, as with any import. **Cancel** there returns to the share, so you can still import it.

An encrypted file is opened like any other import: drop it on the **Import** tab or choose it with **Choose files**.

**Export → HTML docs** (or `gostman docs`) writes one self-contained documentation page: every request with its description, parameters, headers, body, a curl example and saved examples. Values in auth settings, `Authorization` and `Cookie` headers, user names and passwords in addresses, and headers, parameters, form fields and JSON body fields with names such as `token` or `key` are shown as `<redacted>`. Other literal secrets, such as a token in a text body or under an ordinary name, are not detected, so review the page before publishing.

![A generated documentation page with a sidebar of requests and the details of one](../gostman-gui/frontend/src/assets/landing/docs.webp)

## Open in Gostman links

A link can ask Gostman to download a Postman, OpenAPI, Insomnia, HAR, Bruno or Gostman file and import it, for example from a README button:

- Web: `https://gostman.com/web#open=<percent-encoded https address>`
- Desktop: `gostman://open?url=<percent-encoded https address>` (new, and not yet verified on every operating system; prefer the web link when you publish one)

A link never imports anything by itself. Gostman shows the source host and address, downloads only after you choose **Download**, shows the detected format, and imports only after you choose **Import**. Only `https` addresses work, private and internal addresses are refused (including after redirects), and the file goes through the same import path as every import: it only adds data, and scripts are kept but reported. Files are limited to 4 MB in the web version and 10 MB on the desktop. The Share tab can copy the link and a Markdown badge for a collection you host.
