# Secrets and network settings

This page covers how Gostman keeps secret variables, how to read values from a secret manager (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault and Google Cloud Secret Manager) or a password manager (KeePassXC, 1Password, Bitwarden and Bitwarden Secrets Manager), how to see and delete stored cookies, and how to set a proxy and certificates in the Network settings dialog. For how variables are scoped and which one wins, see [Variables](variables.md).

## Secret variables

Each row of an environment has a lock button. Select it to mark the variable as secret (**Mark as secret**); select it again to return to **Stored in plain text**.

- A secret value is masked in the table. The eye button (**Show value** and **Hide value**) reveals it.
- Secret values are kept in the system keychain or an encrypted file on this computer, never in the collection folder or in exports. On the web they stay in the browser and are left out of exports.
- Only the name of a secret variable is written to the environment file, never its value. Copying a workspace folder to another computer leaves the secret values behind.

The Environments dialog states the same at the bottom: the desktop app names the keychain or encrypted file, and the web version says values stay in the browser.

The lock is available on environment variables. It is not offered for collection variables or for rows that read from a secret manager. [Variables](variables.md#secret-variables) lists the keychain used on each system and what to do in the command line.

## Secret managers

A variable can read its value from a secret manager or a password manager instead of holding it. You set this up in two steps: add a connection once, then point variables at it.

![The Secret managers dialog adding a HashiCorp Vault connection named team-vault with its address, mount and KV version](../screenshots/secret-managers.png)

The collection stores only the reference: the connection name, the path, an optional JSON field and an optional version. The connection itself, with its address and sign-in details, is kept on this computer with credentials in the system keychain, and is never part of a collection. A collection you clone cannot point your credentials at its own server.

Secret managers work in the desktop app and in the command line. In the web version the Secret managers dialog shows `Available in the desktop app and the CLI`, because the web version never sends credentials to its relay. Variables that use a reference only resolve in the desktop app and the command line. For the command line, see [Secret managers](cli.md) in the command line page.

### Add a connection

Open **Environments** from the header, then select **Secret managers**. Select **Add connection** and fill in:

| Field | Meaning |
| --- | --- |
| **Name** | The name variables use to refer to the connection, such as `production`. It cannot be changed after the connection is saved. |
| **Colour** | The colour of fields that read from this connection: one of six colours, or any colour from the swatch with a plus. Without a choice, one is picked from the name; the colour it will use has a dashed outline. |
| **Service** | HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, Google Cloud Secret Manager, KeePassXC, 1Password, Bitwarden or Bitwarden Secrets Manager. It cannot be changed after the connection is saved. |

The other fields depend on the service. A star marks a required field. Fields that hold credentials are masked.

| Service | Fields |
| --- | --- |
| HashiCorp Vault | **Address** *, **Namespace**, **Secrets engine mount**, **KV version**, **AppRole role ID**, **Token**, **AppRole secret ID** |
| AWS Secrets Manager | **Region** *, **Access key ID** *, **Secret access key** *, **Session token**, **Address** |
| Azure Key Vault | **Address** *, **Tenant ID**, **Client ID**, **Client secret**, **Token**, **Sign-in address** |
| Google Cloud Secret Manager | **Token** *, **Project**, **Address** |
| KeePassXC | No fields. Select **Connect to KeePassXC**; see [KeePassXC](#keepassxc). |
| 1Password | **Account**, **Service account token**, **Program** |
| Bitwarden | **Master password** with **Unlock**, which fills **Session key** *; **Program**. See [Bitwarden](#bitwarden). |
| Bitwarden Secrets Manager | **Access token** *, **Server address**, **Program** |

For the password managers, **Program** is the location of their command line tool. Leave it empty and Gostman finds it on the `PATH` and in the usual install folders. Under the service, the form explains how to set each one up.

Select **Save**. The list shows each connection with its colour, the service's logo, its service, and buttons to edit (**Edit connection**) or remove (**Delete connection**) it. Deleting a connection asks for confirmation, and variables that use it stop resolving.

When you edit a connection, a credential that is already saved shows `Saved. Leave empty to keep it.`

### Try a secret

While you edit a saved connection, **Try a secret** reads a secret with that connection. Enter the **Secret path**, optionally a **JSON field** and a **Version**, then select **Test**. The result shows only whether it worked and how many characters the value has, for example `Read the secret: 24 characters`.

### Use a secret in a variable

1. Open **Environments** and select an environment.
2. On a variable's row, select the key button **Read from a secret manager**.
3. Choose the connection under **Connection**. If there is none, the dialog says to add a connection first under Secret managers.
4. Fill in **Secret path**. **JSON field** is optional. **Version** is optional.
5. Optionally select **Test**.

The path and version mean different things for each service:

| Service | Path example | Version |
| --- | --- | --- |
| HashiCorp Vault | `app/database` | Version number |
| AWS Secrets Manager | `prod/database` | Version stage |
| Azure Key Vault | `database-password` | Version id |
| Google Cloud Secret Manager | `database-password` | Version number |
| KeePassXC | `Work/API keys/Stripe`, or the entry's UUID | None |
| 1Password | `Private/Stripe` (vault/item) or `Private/Stripe/API` (vault/item/section) | None |
| Bitwarden | The item's exact name, or its ID | None |
| Bitwarden Secrets Manager | The secret's ID | None |

For the password managers the version box is hidden and the field box is called **Field**. Without a field, Gostman reads the password (for Bitwarden Secrets Manager, the value).

Select the key button again (**Type a value**) to go back to a plain value.

If the connection name on a variable does not exist on this computer, the row shows `There is no connection named "..." on this computer`, and you can add it or choose another.

### See where a value comes from

In the address bar, the request tables and the editors, a variable that reads from a secret manager is tinted with its connection's colour and has a dashed underline, so a request shows at a glance which fields come from which connection. Plain variables keep a solid underline.

![The address bar with stripe_key tinted orange for vault-prod and probe_ref tinted blue for team-1password, and the hover card of stripe_key naming vault-prod, HashiCorp Vault, the secret path and the JSON field](../screenshots/secret-origins.png)

Hover over the variable to see where its value comes from: the connection's colour, the service's logo, the connection name and service, the secret path, and the field and version if they are set. The value itself stays masked. A variable that uses a connection that is off has a dotted, muted underline, and one whose connection does not exist on this computer is marked like an undefined variable; the hover card says which.

### Turn a connection off

A send reads only the secrets that the request and its folders use, so a service that is down stops only the requests that need it. A request with a pre-request or post-response script reads every secret of the environment, because a script can read any variable.

If a secret cannot be read, the request is not sent, and the message names the variable, the connection and the cause, for example `variable "stagingKey" could not be read from "staging-vault". While it is unavailable, you can turn the connection off under Secret managers, and variables that use it are then empty.`

Each connection in **Secret managers** has an **On** switch. Switch a connection **Off** while its service is unavailable, or so that its app stops asking you to unlock it. Its settings and saved credentials stay, so switching it **On** again is all it takes to read from it again.

![The Secret managers dialog with the connection staging-vault switched Off and team-vault On](../screenshots/secret-managers-off.png)

While a connection is off:

- Variables that use it are empty, and **Test** says that the connection is off.
- In the environment, the connection list shows it as `staging-vault (off)`, and the variable says that it is empty until you turn the connection on.
- The request's **Timeline** has a **Secret managers** step with how many secrets were read and how long it took, and a line for each variable that was left empty.

![An environment where the variable stagingKey reads from staging-vault (off), with the note that the variable is empty](../screenshots/secret-variable-off.png)

![The Timeline of a request: Secret managers read 1 secret, stagingKey is empty because the connection staging-vault is off, then the POST request](../screenshots/timeline-secret-managers.png)

### Password managers

Gostman reads password managers through the same connection and reference as the secret managers. Each one has its own way of letting Gostman in.

#### KeePassXC

Gostman connects to KeePassXC the way its browser extension does, so KeePassXC does not have to be your system's Secret Service and your master password never reaches Gostman.

1. In KeePassXC, open the settings, go to **Browser Integration** and turn on **Enable browser integration**. The browser checkboxes are not needed.
2. Unlock the database you want to use.
3. In Gostman, add a connection with the service **KeePassXC** and select **Connect to KeePassXC**. KeePassXC asks you to name the connection; choose **Save and allow access**. The form then shows `Connected. KeePassXC knows this connection as "..."`. Select **Save**.

A reference's path is the entry's group path and title below the root group, such as `Work/API keys/Stripe`. It is case-sensitive. You can also use the entry's UUID from its **Advanced** tab in KeePassXC; dashes and braces are ignored. If two entries have the same path, Gostman asks for the UUID.

The **Field** can be:

| Field | Value |
| --- | --- |
| empty or `password` | The password |
| `username`, `title` | The user name, the title |
| `totp` | The current one-time code, read again on every send |
| any other name | The attribute `KPH: <name>` of the entry. KeePassXC shares only attributes whose names start with `KPH: `, so name the attribute `KPH: api_key` and use the field `api_key` (or `KPH: api_key`). |

- The first time Gostman reads an entry, KeePassXC asks whether to allow access. Check **Remember access to checked entries** to stop it asking for that entry.
- If the database is locked, KeePassXC asks you to unlock it and Gostman waits up to two minutes.
- KeePassXC leaves out expired entries and entries you denied access to, and searches only the database the connection was made with. Make one connection per database.
- KeePassXC 2.7.0 to 2.8.0 stops responding when an app reads an entry that has no URL, because of a bug in KeePassXC. Until it is fixed, give each entry Gostman reads a URL; any address works. If it happens, Gostman reports that KeePassXC did not answer in time, and KeePassXC has to be restarted.
- The connection works in the desktop app only, with KeePassXC 2.7.0 or later.

#### 1Password

Gostman runs the 1Password CLI (`op`), which must be installed.

- With the 1Password app: turn on **Settings → Developer → Integrate with 1Password CLI** and leave **Service account token** empty. 1Password asks you to approve access, for example with Windows Hello or Touch ID.
- For CI or without the app: fill in **Service account token**.
- **Account** is only needed when you are signed in to several accounts, for example `my.1password.com`.

The path is `vault/item` or `vault/item/section`, and the field is the field's label, such as `username`, `password` or `credential`. Names are not case-sensitive. A name with characters other than letters, digits, spaces, `-`, `_` and `.` must be given by its ID. The field `totp` reads the current one-time password.

#### Bitwarden

Gostman runs the Bitwarden CLI (`bw`), which must be installed and logged in.

1. In a terminal, run `bw login` once.
2. In the connection form, enter your master password and select **Unlock**. Gostman passes the password to `bw unlock` and keeps only the session key it returns, in the system keychain. Select **Save**.

The session lasts until you run `bw lock` or `bw logout`. The CLI keeps one session at a time, so unlocking in a terminal ends the one Gostman holds, and the other way round. When that happens, edit the connection and select **Unlock** again. To share one session with a terminal, paste the key from `bw unlock --raw` into **Session key** instead.

The path is the item's exact name or its ID. If several items have the name, Gostman lists their IDs. The field can be `password`, `username`, `notes`, `uri`, `totp` (needs Premium) or the name of a custom field. The CLI reads its local copy of the vault; when an item is not found, Gostman runs `bw sync` and looks again. Run `bw sync` yourself after changing a value elsewhere.

#### Bitwarden Secrets Manager

Gostman runs the Secrets Manager CLI (`bws`) with the access token of a machine account. Leave **Server address** empty for bitwarden.com, or set it for the EU cloud (`https://vault.bitwarden.eu`) or a self-hosted server. The path is the secret's ID, and the field is `value` (the default), `key` or `note`.

### What is stored and what is not

- Stored in the collection: the reference only.
- Stored on this computer: the connection, with credentials in the system keychain.
- Not stored: the secret values. They are read when a request is sent and cached in memory for five minutes, except one-time codes, which are read every time. They are never saved, exported or shared. If a reference cannot be read, the request is not sent.
- A folder that you have not trusted yet never resolves references.

## Cookies

Gostman keeps the cookies that responses set and sends them back to the same site on later requests. Open the **Manage cookies** command to see them in the **Cookies** dialog.

![The Cookies dialog listing the session_id and locale cookies for localhost with their path and expiry](../screenshots/cookies.png)

- The table lists **Name**, **Value**, **Domain**, **Path** and **Expires** for each cookie, and the title shows the count.
- **Filter by name or domain** narrows the list.
- The delete button on a row removes one cookie. **Clear all** removes every cookie.

Share links never include cookies.

Two switches in a request's **Settings** tab change this for one request: clear **Send cookies from the cookie jar** to send it without stored cookies, and clear **Store cookies the response sets** to keep the jar unchanged. The response still lists the cookies the server set. Both switches are saved with the request and are honoured by `gostman run`.

## Network settings

Network settings sets the proxy and certificates used when the desktop app sends requests: HTTP, GraphQL, gRPC, WebSocket, server-sent events, MCP over HTTP and OAuth 2 token requests. Open the **Network settings** command from the command palette.

![The Network settings dialog with a custom proxy, hosts that bypass it and a CA certificate picker](../screenshots/network.png)

Network settings are desktop only. In the web version the dialog shows `Available in the desktop app`: requests from the web version go through the hosted relay, which cannot use a proxy or certificates from your machine. To use them from the web version, run [`gostman relay`](cli.md#local-relay-for-the-web-app) with `--cacert`, `--client-cert` or `--proxy` and choose the local relay.

Change the settings, then select **Save**. If something is invalid, the dialog shows the error and stays open; **Cancel** discards your changes.

### Proxy

Under **Proxy**, **Mode** has three options:

| Mode | Effect |
| --- | --- |
| **Use the system proxy** | Uses the system proxy. This is the default. |
| **No proxy** | Sends requests directly. |
| **Custom proxy** | Sends requests through the proxy you enter. |

With **Custom proxy**, **Proxy address** appears, for example `http://user:password@proxy.example.com:8080`. The scheme can be `http`, `https` or `socks5`. An address without a scheme is treated as `http://`.

With the system proxy or a custom one, **Bypass for hosts** takes a comma-separated list such as `localhost, *.internal.example.com`. Requests to these hosts skip the proxy. A leading `*` matches any host that ends with the rest of the pattern. gRPC and WebSocket connections reach the proxy with an HTTP `CONNECT` tunnel, or through SOCKS5.

### Certificates

Under **Certificates**:

- **CA certificate**: choose a PEM or DER file with **Choose**. Its certificates are trusted in addition to the system's. The clear button removes it.
- **Client certificate host**, **Certificate**, **Private key** and **Passphrase**: select **Add client certificate** to add a row. Enter the host, then choose the certificate file and, for a PEM certificate, the private key file.

A certificate can be:

- a PEM certificate with a PEM key file;
- a PEM file that holds both the certificate and the key, with no key file;
- a PFX or P12 file (PKCS#12), with no key file. Files written by current OpenSSL (AES) and older ones (3DES, RC2) are both read.

A key or PFX file protected by a passphrase needs the passphrase in the row. Encrypted PEM keys can be PKCS#8 (`BEGIN ENCRYPTED PRIVATE KEY`, AES or 3DES) or the older OpenSSL format (`Proc-Type: 4,ENCRYPTED`). The passphrase is kept in the system keychain, never in Gostman's data file, an export or a collection; the field then shows `Saved in the keychain`, and the clear button next to it forgets it. **Delete all data** removes it too.

A client certificate is presented only to its host; use `*.example.com` to cover subdomains. A row without a host, a file that cannot be read or a wrong passphrase is rejected when you save, with the reason.

Use **Remove certificate** to delete a row.

### Network settings for a collection

A workspace folder can carry its own proxy and certificates in the `network` section of `gostman.yaml`, so everyone who opens the collection gets them. Paths are relative to the folder and cannot leave it. Write the section by hand:

```yaml
network:
  proxy: http://proxy.corp.example:3128
  noProxy: localhost, *.internal.example.com
  ca: certs/corp-root.pem
  certificates:
    - host: api.example.com
      cert: certs/client.p12
    - host: "*.mtls.example.com"
      cert: certs/client.pem
      key: certs/client-key.pem
```

| Field | Effect |
| --- | --- |
| `proxy` | a proxy address as above, `system` for the system proxy, or `none` to send directly |
| `noProxy` | hosts that skip the proxy, added to the ones in Network settings |
| `ca` | a PEM or DER file trusted in addition to the system's and Network settings' |
| `certificates` | client certificates by host, in the same formats as above; they are tried before the ones in Network settings |

Never put a passphrase in `gostman.yaml`. In the desktop app, **Network settings** lists the collection's section under **This collection (gostman.yaml)**, with a **Passphrase** field for each certificate that keeps the passphrase in the system keychain for this folder. In the command line, pass `--client-cert-pass-env`.

A folder you did not create opens as restricted, and its `network` section is not applied until you trust the folder: before that, the folder cannot make Gostman read files or send traffic through a proxy it names. **This collection (gostman.yaml)** says whether the section is applied, and shows why when a file cannot be read.

### In the command line

The command line does not read the desktop settings. `gostman run`, `send`, `load` and `mcp` take the same proxy and certificates as flags: `--cacert`, `--client-cert` with `--client-key`, as `host=cert,key` or `host=file.p12`, `--client-cert-pass-env NAME` for passphrases, `--proxy` and `--noproxy`. Without `--proxy` they use the `HTTPS_PROXY`, `HTTP_PROXY` and `NO_PROXY` environment variables. A workspace folder's `network` section is applied as well, and the flags win over it. See [Proxies and certificates](ci.md#proxies-and-certificates).
