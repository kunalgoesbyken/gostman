export const PRODUCTS = [
  { id: "gostman", name: "Gostman" },
  { id: "postman", name: "Postman" },
  { id: "bruno", name: "Bruno" },
]

export const STATES = {
  included: "Included",
  partial: "Partial",
  excluded: "Not included",
}

export const COMPARISON_ROWS = [
  {
    feature: "Every feature free",
    gostman: { state: "included", text: "No paid tier. MIT licence." },
    postman: { state: "partial", text: "Free plan; Solo $9 per month; Team $19 per user per month; both billed annually." },
    bruno: { state: "partial", text: "Open Source $0; Pro $6 and Ultimate $11 per user per month, billed annually." },
  },
  {
    feature: "Use without an account",
    gostman: { state: "included", text: "Desktop and web, no sign-in." },
    postman: { state: "partial", text: "Lightweight API Client when signed out; workspaces need an account." },
    bruno: { state: "included", text: "Documented as not requiring an account." },
  },
  {
    feature: "Workspaces",
    gostman: { state: "included", text: "No limit on collections or folders." },
    postman: { state: "partial", text: "Private workspaces are on paid plans." },
    bruno: { state: "partial", text: "Two on Open Source; unlimited on Pro and Ultimate." },
  },
  {
    feature: "Share without Git",
    gostman: { state: "included", text: "An encrypted link or file, built on your machine and never uploaded." },
    postman: { state: "partial", text: "Shared workspaces; team collaboration is on the Team plan." },
    bruno: { state: "partial", text: "Export a collection file; no share links in its documentation." },
  },
  {
    feature: "Git in the app",
    gostman: { state: "included", text: "Diff, commit, push, branches, stash and conflicts, in the desktop app." },
    postman: { state: "included", text: "Native Git listed on every plan." },
    bruno: { state: "partial", text: "Core Git UI is free; commit, push and branches need Pro or Ultimate." },
  },
  {
    feature: "Data-driven runs",
    gostman: { state: "included", text: "CSV or JSON, one run per row." },
    postman: { state: "partial", text: "Custom data files in the Collection Runner are on paid plans." },
    bruno: { state: "partial", text: "Documented for Pro and Ultimate." },
  },
  {
    feature: "Secret managers",
    gostman: { state: "included", text: "Vault, AWS, Azure and Google Cloud." },
    postman: { state: "partial", text: "Vault integrations listed as an Enterprise add-on." },
    bruno: { state: "partial", text: "Documented as an Ultimate feature." },
  },
  {
    feature: "Load testing",
    gostman: { state: "included", text: "In the desktop app and as gostman load, with latency percentiles and pass or fail thresholds." },
    postman: { state: "included", text: "Local performance tests on every plan; cloud runs are billed by use." },
    bruno: { state: "excluded", text: "Not in its documentation." },
  },
  {
    feature: "Socket.IO, MQTT and GraphQL subscriptions",
    gostman: { state: "included", text: "All three; MQTT runs over WebSocket." },
    postman: { state: "included", text: "Socket.IO and MQTT request types, and GraphQL subscriptions." },
    bruno: { state: "excluded", text: "WebSocket is documented; these three are not." },
  },
  {
    feature: "Test MCP servers",
    gostman: { state: "included", text: "Remote servers, and local ones in the desktop app." },
    postman: { state: "included", text: "MCP client listed on every plan." },
    bruno: { state: "excluded", text: "Not in its documentation." },
  },
  {
    feature: "Import HAR captures",
    gostman: { state: "included", text: "With an option to leave out images, fonts, styles and scripts." },
    postman: { state: "excluded", text: "Not in its list of import formats." },
    bruno: { state: "excluded", text: "Not in its list of import formats." },
  },
  {
    feature: "Web version",
    gostman: { state: "included", text: "The same app in the browser, with no account." },
    postman: { state: "partial", text: "Web app with an account." },
    bruno: { state: "excluded", text: "No browser version in its documentation." },
  },
  {
    feature: "Mock server",
    gostman: { state: "included", text: "From saved examples or an OpenAPI spec." },
    postman: { state: "included", text: "Mock servers listed on every plan." },
    bruno: { state: "partial", text: "Documented, and marked Beta." },
  },
  {
    feature: "CLI for CI",
    gostman: { state: "included", text: "gostman run, one binary with nothing else to install." },
    postman: { state: "included", text: "Postman CLI listed on every plan." },
    bruno: { state: "included", text: "bru run, installed from npm; needs Node.js." },
  },
  {
    feature: "VS Code extension",
    gostman: { state: "excluded", text: "Not available." },
    postman: { state: "included", text: "IDE extension listed on every plan." },
    bruno: { state: "included", text: "Documented." },
  },
]
