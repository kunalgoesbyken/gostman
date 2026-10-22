# Secrets and network settings

This page covers how Gostman keeps secret variables, how to read values from a secret manager (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault and Google Cloud Secret Manager), how to see and delete stored cookies, and how to set a proxy and certificates in the Network settings dialog. For how variables are scoped and which one wins, see [Variables](variables.md).

## Secret variables

Each row of an environment has a lock button. Select it to mark the variable as secret (**Mark as secret**); select it again to return to **Stored in plain text**.

- A secret value is masked in the table. The eye button (**Show value** and **Hide value**) reveals it.
- Secret values are kept in the system keychain or an encrypted file on this computer, never in the collection folder or in exports. On the web they stay in the browser and are left out of exports.
- Only the name of a secret variable is written to the environment file, never its value. Copying a workspace folder to another computer leaves the secret values behind.

The Environments dialog states the same at the bottom: the desktop app names the keychain or encrypted file, and the web version says values stay in the browser.

The lock is available on environment variables. It is not offered for collection variables or for rows that read from a secret manager. [Variables](variables.md#secret-variables) lists the keychain used on each system and what to do in the command line.

## Secret managers

A variable can read its value from a secret manager instead of holding it. You set this up in two steps: add a connection once, then point variables at it.

![The Secret managers dialog adding a HashiCorp Vault connection named team-vault with its address, mount and KV version](../screenshots/secret-managers.png)

The collection stores only the reference: the connection name, the path, an optional JSON field and an optional version. The connection itself, with its address and sign-in details, is kept on this computer with credentials in the system keychain, and is never part of a collection. A collection you clone cannot point your credentials at its own server.

Secret managers work in the desktop app and in the command line. In the web version the Secret managers dialog shows `Available in the desktop app and the CLI`, because the web version never sends credentials to its relay. Variables that use a reference only resolve in the desktop app and the command line. For the command line, see [Secret managers](cli.md) in the command line page.

### Add a connection

Open **Environments** from the header, then select **Secret managers**. Select **Add connection** and fill in:

| Field | Meaning |
| --- | --- |
| **Name** | The name variables use to refer to the connection, such as `production`. It cannot be changed after the connection is saved. |
| **Service** | HashiCorp Vault, AWS Secrets Manager, Azure Key Vault or Google Cloud Secret Manager. It cannot be changed after the connection is saved. |

The other fields depend on the service. A star marks a required field. Fields that hold credentials are masked.

| Service | Fields |
| --- | --- |
| HashiCorp Vault | **Address** *, **Namespace**, **Secrets engine mount**, **KV version**, **AppRole role ID**, **Token**, **AppRole secret ID** |
| AWS Secrets Manager | **Region** *, **Access key ID** *, **Secret access key** *, **Session token**, **Address** |
| Azure Key Vault | **Address** *, **Tenant ID**, **Client ID**, **Client secret**, **Token**, **Sign-in address** |
| Google Cloud Secret Manager | **Token** *, **Project**, **Address** |

Select **Save**. The list shows each connection with its service, and buttons to edit (**Edit connection**) or remove (**Delete connection**) it. Deleting a connection asks for confirmation, and variables that use it stop resolving.

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

Select the key button again (**Type a value**) to go back to a plain value.

If the connection name on a variable does not exist on this computer, the row shows `There is no connection named "..." on this computer`, and you can add it or choose another.

### What is stored and what is not

- Stored in the collection: the reference only.
- Stored on this computer: the connection, with credentials in the system keychain.
- Not stored: the secret values. They are read when a request is sent and cached in memory for five minutes. They are never saved, exported or shared. If a reference cannot be read, the request is not sent.
- A folder that you have not trusted yet never resolves references.

## Cookies

Gostman keeps the cookies that responses set and sends them back to the same site on later requests. Open the **Manage cookies** command to see them in the **Cookies** dialog.

![The Cookies dialog listing session_id, theme and locale cookies for httpbin.org with their path and expiry](../screenshots/cookies.png)

- The table lists **Name**, **Value**, **Domain**, **Path** and **Expires** for each cookie, and the title shows the count.
- **Filter by name or domain** narrows the list.
- The delete button on a row removes one cookie. **Clear all** removes every cookie.

Share links never include cookies.

## Network settings

Network settings sets the proxy and certificates used when the desktop app sends requests. Open the **Network settings** command from the command palette.

![The Network settings dialog with a custom proxy, hosts that bypass it, a CA certificate picker and a client certificate row for api.example.com](../screenshots/network.png)

Network settings are desktop only. In the web version the dialog shows `Available in the desktop app`: requests from the web version go through the hosted relay, which cannot use a proxy or certificates from your machine.

Change the settings, then select **Save**. If something is invalid, the dialog shows the error and stays open; **Cancel** discards your changes.

### Proxy

Under **Proxy**, **Mode** has three options:

| Mode | Effect |
| --- | --- |
| **Use the system proxy** | Uses the system proxy. This is the default. |
| **No proxy** | Sends requests directly. |
| **Custom proxy** | Sends requests through the proxy you enter. |

With **Custom proxy**, two more fields appear:

- **Proxy address**, for example `http://user:password@proxy.example.com:8080`. The scheme can be `http`, `https` or `socks5`. An address without a scheme is treated as `http://`.
- **Bypass for hosts**, a comma-separated list such as `localhost, *.internal.example.com`. Requests to these hosts skip the proxy. A leading `*` matches any host that ends with the rest of the pattern.

### Certificates

Under **Certificates**:

- **CA certificate**: choose a PEM file with **Choose**. Its certificates are trusted in addition to the system's. The clear button removes it.
- **Client certificate host**, **Certificate** and **Private key**: select **Add client certificate** to add a row. Enter the host, then choose the certificate file and the private key file.

Certificates and keys are PEM files. A client certificate is presented only to its host; use `*.example.com` to cover subdomains. Keys must not be passphrase-protected. A row without a host is rejected when you save.

Use **Remove certificate** to delete a row.
