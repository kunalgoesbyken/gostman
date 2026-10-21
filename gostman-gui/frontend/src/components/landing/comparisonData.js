export const COMPARISON_DATE = "21 October 2026"

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

export const COMPARISON_SOURCES = [
  { id: "postmanPricing", label: "Postman pricing", url: "https://www.postman.com/pricing/" },
  { id: "postmanClient", label: "Postman docs: lightweight API Client", url: "https://learning.postman.com/docs/getting-started/basics/using-api-client" },
  { id: "postmanData", label: "Postman docs: run collections using imported data", url: "https://learning.postman.com/docs/tests-and-scripts/running-collections/working-with-data-files/" },
  { id: "postmanCli", label: "Postman docs: Postman CLI overview", url: "https://learning.postman.com/docs/postman-cli/postman-cli-overview" },
  { id: "brunoPricing", label: "Bruno pricing", url: "https://www.usebruno.com/pricing" },
  { id: "brunoIntro", label: "Bruno docs: what is Bruno", url: "https://docs.usebruno.com/introduction/what-is-bruno" },
  { id: "brunoData", label: "Bruno docs: data-driven testing", url: "https://docs.usebruno.com/testing/automate-test/data-driven-testing" },
  { id: "brunoSecrets", label: "Bruno docs: secret managers", url: "https://docs.usebruno.com/secrets-management/secret-managers/overview" },
  { id: "brunoGit", label: "Bruno docs: Git integration", url: "https://docs.usebruno.com/git-integration/using-gui/intro" },
  { id: "brunoMock", label: "Bruno docs: mock servers", url: "https://docs.usebruno.com/mock-servers/overview" },
  { id: "brunoCli", label: "Bruno docs: bru run", url: "https://docs.usebruno.com/bru-cli/run/overview" },
]

export const COMPARISON_ROWS = [
  {
    feature: "Use without an account",
    gostman: { state: "included", text: "Desktop and web, no sign-in." },
    postman: { state: "partial", text: "Lightweight API Client when signed out; workspaces need an account.", cite: ["postmanClient"] },
    bruno: { state: "included", text: "Documented as not requiring an account.", cite: ["brunoIntro"] },
  },
  {
    feature: "Data-driven runs",
    gostman: { state: "included", text: "CSV or JSON, one run per row." },
    postman: { state: "partial", text: "Custom data files in the Collection Runner are on paid plans.", cite: ["postmanData"] },
    bruno: { state: "partial", text: "Documented for Pro and Ultimate.", cite: ["brunoData"] },
  },
  {
    feature: "Secret managers",
    gostman: { state: "included", text: "Vault, AWS, Azure and Google Cloud." },
    postman: { state: "partial", text: "Vault integrations listed as an Enterprise add-on.", cite: ["postmanPricing"] },
    bruno: { state: "partial", text: "Documented as an Ultimate feature.", cite: ["brunoSecrets"] },
  },
  {
    feature: "Git in the app",
    gostman: { state: "included", text: "Diff, commit, push, branches, stash and conflicts, in the desktop app." },
    postman: { state: "included", text: "Native Git listed on every plan.", cite: ["postmanPricing"] },
    bruno: { state: "partial", text: "Core Git UI is free; commit, push and branches need Pro or Ultimate.", cite: ["brunoGit"] },
  },
  {
    feature: "Mock server",
    gostman: { state: "included", text: "From saved examples or an OpenAPI spec." },
    postman: { state: "included", text: "Mock servers listed on every plan.", cite: ["postmanPricing"] },
    bruno: { state: "partial", text: "Documented, and marked Beta.", cite: ["brunoMock"] },
  },
  {
    feature: "CLI for CI",
    gostman: { state: "included", text: "gostman run, non-zero exit on failure." },
    postman: { state: "included", text: "Postman CLI listed on every plan.", cite: ["postmanCli", "postmanPricing"] },
    bruno: { state: "included", text: "bru run, documented for local and CI use.", cite: ["brunoCli"] },
  },
  {
    feature: "Every feature free",
    gostman: { state: "included", text: "No paid tier. Open source, MIT license." },
    postman: { state: "partial", text: "Free plan; Solo $9 per month; Team $19 per user per month; both billed annually.", cite: ["postmanPricing"] },
    bruno: { state: "partial", text: "Open Source $0; Pro $6 and Ultimate $11 per user per month, billed annually.", cite: ["brunoPricing"] },
  },
]
