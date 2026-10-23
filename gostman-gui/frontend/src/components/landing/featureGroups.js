import { docPath } from "../../docs/manifest"
import { AI_AVAILABLE, AI_FEATURE } from "./content"

export const FEATURE_INDEX = [
  {
    id: "send",
    title: "Send and inspect",
    rows: [
      { term: "Every protocol", href: docPath("protocols"), text: "REST, GraphQL with a schema browser, gRPC through reflection or .proto files, WebSocket, Socket.IO, MQTT, Server-Sent Events, SOAP and MCP in one window." },
      { term: "Auth for real APIs", href: docPath("requests-and-responses"), text: "Basic, bearer, API key, OAuth 1 and 2 with renewal, Digest, AWS SigV4, NTLM, Akamai EdgeGrid, JWT, ASAP and Hawk." },
      { term: "Bodies and transport", href: docPath("requests-and-responses"), text: "JSON, XML, form, multipart and file bodies, a cookie jar, proxy and client certificates, and curl commands pasted straight into a request." },
      { term: "Responses", href: docPath("requests-and-responses"), text: "JSON tree, HTML, image and PDF previews, headers, cookies, size and timing. Download any body, including binary, or copy it as code in 13 languages, including cURL, Python, Go, Java, C#, Swift and Rust." },
    ],
  },
  {
    id: "variables",
    title: "Variables and secrets",
    rows: [
      { term: "Variables done properly", href: docPath("variables"), text: "Secret variables in your OS keychain, plus global, collection, folder and request scopes, dynamic variables and prompts." },
      { term: "Secret managers", href: docPath("secrets-and-network"), text: "Pull values from Vault, AWS, Azure, Google Cloud, 1Password, Bitwarden or KeePassXC at send time." },
    ],
  },
  {
    id: "automate",
    title: "Test and automate",
    rows: [
      { term: "A runner built for CI", href: docPath("runner-load-and-scan"), text: "CSV and JSON data, parallel runs, HTML and JUnit reports, and a CLI that exits non-zero on failure." },
      { term: "Mock server", href: docPath("workspaces-and-mock"), text: "Serve saved examples or an OpenAPI spec locally, with rules and a live request log." },
    ],
  },
  {
    id: "data",
    title: "Your data and tools",
    rows: [
      { term: "A real Git panel", href: docPath("collections-and-git"), text: "Diff, commit, push, branches, stash and conflict resolution, in the desktop app." },
      { term: "Plain files", href: docPath("collections-and-git"), text: "Nested collections, tabs and history, kept as plain YAML files in a folder or in app storage." },
      { term: "Import and export", href: docPath("import-export-and-specs"), text: "Import Postman, OpenAPI, Insomnia, HAR, WSDL, Bruno collections, .http files and curl commands. Export to Postman, OpenAPI, Markdown, .http files or a backup." },
      { term: "Agent-ready, and in the browser", href: docPath("agents"), text: "An MCP server with secret redaction and a host allowlist, and a web version with nothing to install." },
    ],
  },
]

const AI_ROW = { term: AI_FEATURE.title, href: docPath("ai"), text: AI_FEATURE.description }

export const FEATURE_GROUPS = FEATURE_INDEX.map((group, index) =>
  AI_AVAILABLE && index === FEATURE_INDEX.length - 1 ? { ...group, rows: [...group.rows, AI_ROW] } : group,
)
