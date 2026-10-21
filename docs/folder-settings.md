# Folder and collection settings

Every folder and the collection itself can carry settings that the requests below it share. Open them from a folder's menu (**Settings**) or with the settings button above the collection tree (**Collection settings**).

| Tab | What it holds |
| --- | --- |
| Headers | Rows sent with every request below |
| Auth | An auth scheme used by requests set to **Inherit** |
| Vars | Variables for the requests below (the collection's own variables are the ones in Environments) |
| Script | A pre-request and a post-response script |
| Tests | Assertions checked after every response |
| Docs | A description shown in generated documentation |

The collection is the outermost level. A request belongs to its folder, which may sit inside other folders.

## How levels combine

**Headers** merge from the outside in: collection, then each folder down to the request's own folder, then the request. A header with the same name (case-insensitive) replaces the outer one. A row that is switched off removes the outer header of that name instead of sending anything, so a request can drop a header a folder adds.

**Auth** is chosen by the nearest level that sets one. A request whose Auth type is **Inherit** uses the auth of its folder, else its parent folder, and so on up to the collection. A folder or the collection whose type is left on **Inherit** passes the question outward. **No auth** on a folder stops the search: requests that inherit from it are sent without authentication. A request that sets its own type, including **No auth**, never inherits. New requests keep **No auth** until you choose Inherit.

**Variables** follow [Variables](variables.md): environment, then each folder from the outermost to the request's folder, then the request's own Vars. A folder variable overrides an environment variable of the same name.

**Scripts** run outside in before the request is sent: the collection's, each folder's, then the request's. After the response they run inside out: the request's, each folder's from the innermost, then the collection's. Each one sees the variables as they stand when it starts. A script that fails stops the request.

**Tests** accumulate: the request's assertions and every folder's and the collection's are all checked.

**Docs** are shown above the requests of that folder in the generated HTML page; the collection's description appears at the top. The text is shown as written (Markdown is not rendered) and is escaped.

## What is sent

The Go engine merges headers and resolves auth when it prepares a request, so what is sent, the code snippets, the CLI and the agent tools all agree. Inherited headers and auth appear in generated code. gRPC metadata, MCP requests and WebSocket connections use the same merged headers and auth.

OAuth 2.0 set on a folder or the collection works like OAuth 2.0 on a request: **Get token** in the settings dialog stores the token there, and it is renewed when it expires. In a folder workspace the token is not written to the YAML files.

## Files

In a folder workspace a folder's settings live in its `folder.yaml` and the collection's in `gostman.yaml`, next to `variables`:

```yaml
name: Payments
variables:
  region: eu
headers:
  - key: X-Team
    value: payments
auth:
  type: bearer
  token: "{{token}}"
preScript: console.log("entering payments")
assertions:
  - expression: res.status
    operator: lt
    value: "500"
description: Endpoints owned by the payments team.
```

Keys Gostman does not know are kept when it rewrites the file. Gostman exports and share links carry folder settings with each folder and the collection settings with a full export. Importing never overwrites existing settings: collection settings are adopted only when the open collection has none.

## Trust

Imports are untrusted. Scripts and OAuth 2.0 settings on folders and on the collection are counted in the import prompt and dropped if you decline them. In a folder you have not trusted, a request is not sent when its folder or the collection carries a script or OAuth 2.0 settings, exactly as for a request that carries them.

## The CLI

`gostman run` and `gostman send` read the same files and exports and apply the same rules. Nesting deeper than 64 folders is cut at the 64 nearest folders. A folder whose parent is missing or that sits in a cycle is treated as having no parent.
