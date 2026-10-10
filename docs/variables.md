# Variables

Variables let you define a value once and reuse it across requests. Each environment holds its own set, and the environment selected in the header is the one used when a request is sent.

## Defining variables

Open the **Env Vars** tab and enter a JSON object:

```json
{
  "base_url": "https://api.example.com",
  "token": "your-api-token",
  "user_id": 12345
}
```

Values can be strings, numbers or booleans. A value of `null` is treated as undefined. Names may contain letters, digits, underscores and hyphens, and must not start with a digit.

## Using variables

Write `{{name}}` wherever the value should appear:

| Where | Example |
| --- | --- |
| URL | `{{base_url}}/users/{{user_id}}` |
| Query parameter or header, key or value | `Authorization: Bearer {{token}}` |
| Body, including form and multipart text fields | `{"owner": {{user_id}}}` |
| Auth fields | Username `{{user}}`, token `{{token}}` |
| GraphQL query and variables | `{"id": "{{user_id}}"}` |
| WebSocket URL and headers | `wss://{{host}}/socket` |

## Rules

- Names are case-sensitive.
- Whitespace inside the braces is ignored: `{{ name }}` is the same as `{{name}}`.
- A placeholder with no matching variable is left as written, so the mistake is visible in the request that goes out.
- Every occurrence is replaced.
- Values are inserted as they are. A value placed in a URL is not percent-encoded, apart from spaces.
- Placeholders are not expanded recursively: a variable whose value contains `{{other}}` is inserted literally.

## Setting variables from a response

The **Extract** tab stores rules on a request. After each response, every enabled rule copies a value into the active environment:

| Source | Expression | Example |
| --- | --- | --- |
| JSON body | JSONPath | `$.data.token` |
| Header | Header name, case-insensitive | `Location` |
| Cookie | Cookie name | `session` |
| Status code | none | `200` |

A later request can then use the value as `{{name}}`, which is how a login request feeds a token to the requests that follow it.

## Where substitution happens

Substitution is done by the Go engine in [`engine/`](../engine) when the request is prepared, identically for the desktop app and the web version. The generated code in **Code** shows the request after substitution.
