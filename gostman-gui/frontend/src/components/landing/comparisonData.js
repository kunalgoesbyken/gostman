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
    feature: "Use without an account",
    gostman: { state: "included", text: "Desktop and web, no sign-in." },
    postman: { state: "partial", text: "Lightweight API Client when signed out; workspaces need an account." },
    bruno: { state: "included", text: "Documented as not requiring an account." },
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
    feature: "Git in the app",
    gostman: { state: "included", text: "Diff, commit, push, branches, stash and conflicts, in the desktop app." },
    postman: { state: "included", text: "Native Git listed on every plan." },
    bruno: { state: "partial", text: "Core Git UI is free; commit, push and branches need Pro or Ultimate." },
  },
  {
    feature: "Mock server",
    gostman: { state: "included", text: "From saved examples or an OpenAPI spec." },
    postman: { state: "included", text: "Mock servers listed on every plan." },
    bruno: { state: "partial", text: "Documented, and marked Beta." },
  },
  {
    feature: "CLI for CI",
    gostman: { state: "included", text: "gostman run, non-zero exit on failure." },
    postman: { state: "included", text: "Postman CLI listed on every plan." },
    bruno: { state: "included", text: "bru run, documented for local and CI use." },
  },
  {
    feature: "Every feature free",
    gostman: { state: "included", text: "No paid tier. Open source, MIT license." },
    postman: { state: "partial", text: "Free plan; Solo $9 per month; Team $19 per user per month; both billed annually." },
    bruno: { state: "partial", text: "Open Source $0; Pro $6 and Ultimate $11 per user per month, billed annually." },
  },
]
