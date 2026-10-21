export const FEATURE_INDEX = [
  {
    id: "send",
    title: "Send and inspect",
    rows: [
      { term: "Every protocol", text: "REST, GraphQL with a schema browser, gRPC through reflection or .proto files, WebSocket, Server-Sent Events, SOAP and MCP in one window." },
      { term: "Auth for real APIs", text: "Basic, bearer, API key, OAuth 1 and 2 with renewal, Digest, AWS SigV4, NTLM and Akamai EdgeGrid." },
      { term: "Bodies and transport", text: "JSON, XML, form, multipart and file bodies, a cookie jar, proxy and client certificates, and curl commands pasted straight into a request." },
      { term: "Responses", text: "JSON tree, HTML, image and PDF previews, headers, cookies, size and timing. Download any body, including binary, or copy it as code in cURL, JavaScript, Python, Go, PHP or Java." },
    ],
  },
  {
    id: "variables",
    title: "Variables and secrets",
    rows: [
      { term: "Variables done properly", text: "Secret variables in your OS keychain, plus global, collection, folder and request scopes, dynamic variables and prompts." },
      { term: "Secret managers", text: "Pull values from HashiCorp Vault, AWS, Azure or Google Cloud at send time." },
    ],
  },
  {
    id: "automate",
    title: "Test and automate",
    rows: [
      { term: "A runner built for CI", text: "CSV and JSON data, parallel runs, HTML and JUnit reports, and a CLI that exits non-zero on failure." },
      { term: "Mock server", text: "Serve saved examples or an OpenAPI spec locally, with rules and a live request log." },
    ],
  },
  {
    id: "data",
    title: "Your data and tools",
    rows: [
      { term: "A real Git panel", text: "Diff, commit, push, branches, stash and conflict resolution, in the desktop app." },
      { term: "Plain files", text: "Nested collections, tabs and history, kept as plain YAML files in a folder or in app storage." },
      { term: "Import and export", text: "Import Postman, OpenAPI, Insomnia, HAR, WSDL, Bruno collections and curl commands. Export to Postman, OpenAPI, Markdown or a backup." },
      { term: "Agent-ready, and in the browser", text: "An MCP server with secret redaction and a host allowlist, and a web version with nothing to install." },
    ],
  },
]
