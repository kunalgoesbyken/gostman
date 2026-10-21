export const AI_AVAILABLE = false

export const COMPARISON_DATE = "21 October 2026"

export const BRUNO_PRICING_URL = "https://www.usebruno.com/pricing"

export const BRUNO_PLANS = [
  { name: "Open Source", price: "$0" },
  { name: "Pro", price: "$6 per user per month, billed annually" },
  { name: "Ultimate", price: "$11 per user per month, billed annually" },
]

export const COMPARISON_SOURCES = [
  { id: "pricing", label: "Bruno pricing", url: BRUNO_PRICING_URL },
  { id: "data", label: "Bruno docs: data-driven testing", url: "https://docs.usebruno.com/testing/automate-test/data-driven-testing.md" },
  { id: "runner", label: "Bruno docs: run a collection", url: "https://docs.usebruno.com/get-started/bruno-basics/run-a-collection.md" },
  { id: "secrets", label: "Bruno docs: secret managers", url: "https://docs.usebruno.com/secrets-management/secret-managers/overview.md" },
  { id: "git", label: "Bruno docs: Git integration", url: "https://docs.usebruno.com/git-integration/using-gui/intro.md" },
]

export const COMPARISON_ROWS = [
  {
    feature: "Data-driven runs",
    gostman: "Run a folder once per row of a CSV or JSON file.",
    bruno: "Documented for Pro and Ultimate.",
    source: "data",
  },
  {
    feature: "Parallel execution",
    gostman: "Run requests in parallel from the runner.",
    bruno: "Documented for Pro and Ultimate.",
    source: "runner",
  },
  {
    feature: "HTML test report",
    gostman: "From the runner and from gostman run, next to JSON and JUnit.",
    bruno: "Documented as an Ultimate feature.",
    source: "runner",
  },
  {
    feature: "Secret managers",
    gostman: "HashiCorp Vault, AWS, Azure and Google Cloud.",
    bruno: "Documented as an Ultimate feature.",
    source: "secrets",
  },
  {
    feature: "Git commit, push, branches and conflicts",
    gostman: "A Git panel with diff, commit, push, branches, stash, conflict resolution and per-request history, using your own git credentials.",
    bruno: "Documented under paid plans.",
    source: "git",
  },
]

export const PREMIUM_FEATURES = [
  {
    icon: "Network",
    title: "Every protocol",
    description: "REST, GraphQL, gRPC, WebSocket, Server-Sent Events, SOAP and MCP in one window.",
  },
  {
    icon: "GitBranch",
    title: "A real Git panel",
    description: "Diff, commit, push, branches, stash and conflict resolution, in the desktop app.",
  },
  {
    icon: "Variable",
    title: "Variables done properly",
    description: "Secret variables in your OS keychain, plus global, collection, folder and request scopes, dynamic variables and prompts.",
  },
  {
    icon: "Play",
    title: "A runner built for CI",
    description: "CSV and JSON data, parallel runs, HTML and JUnit reports, and a CLI that exits non-zero on failure.",
  },
  {
    icon: "KeyRound",
    title: "Auth for real APIs",
    description: "Basic, bearer, API key, OAuth 1 and 2, Digest, AWS SigV4, NTLM and Akamai EdgeGrid.",
  },
  {
    icon: "Lock",
    title: "Secret managers",
    description: "Pull values from HashiCorp Vault, AWS, Azure or Google Cloud at send time.",
  },
  {
    icon: "Server",
    title: "Mock server",
    description: "Serve saved examples or an OpenAPI spec locally, with rules and a live request log.",
  },
  {
    icon: "Import",
    title: "Import almost anything",
    description: "Postman, OpenAPI, Insomnia, HAR, WSDL, Bruno collections and curl commands.",
  },
  {
    icon: "Bot",
    title: "Agent-ready, and in the browser",
    description: "An MCP server with secret redaction and a host allowlist, and a web version with nothing to install.",
  },
]

export const AI_FEATURE = {
  icon: "Sparkles",
  title: "AI features, bring your own key",
  description: "Off by default. Your key stays in your OS keychain and secrets are redacted before anything is sent.",
}
