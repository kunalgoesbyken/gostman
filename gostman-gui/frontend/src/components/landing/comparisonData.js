export const PRODUCTS = [
  { id: "gostman", name: "Gostman" },
  { id: "postman", name: "Postman" },
  { id: "bruno", name: "Bruno" },
  { id: "insomnia", name: "Insomnia" },
]

export const STATES = {
  included: "Included",
  partial: "Partial",
  excluded: "Not included",
}

export const COMPARISON_ROWS = [
  {
    feature: "Price",
    gostman: { state: "included", text: "Free. MIT licence." },
    postman: { state: "partial", text: "Free plan; paid from $9 a month." },
    bruno: { state: "partial", text: "Free plan; Pro $6, Ultimate $11 a month." },
    insomnia: { state: "partial", text: "Free plan; Pro $12, Enterprise $45 a month." },
  },
  {
    feature: "Git push, data files, vaults",
    gostman: { state: "included", text: "All free." },
    postman: { state: "partial", text: "Shared Vault from Solo; vault integrations on Enterprise." },
    bruno: { state: "partial", text: "Git push and data files on Pro; secret managers on Ultimate." },
    insomnia: { state: "partial", text: "Git Sync free for up to 3 users; vaults on Enterprise." },
  },
  {
    feature: "Share without Git",
    gostman: { state: "included", text: "Encrypted link or file." },
    postman: { state: "partial", text: "On the Team plan." },
    bruno: { state: "partial", text: "Export a file." },
    insomnia: { state: "partial", text: "Cloud sync with an account, or export a file." },
  },
  {
    feature: "Load testing",
    gostman: { state: "included", text: "Built in." },
    postman: { state: "included", text: "Local runs free." },
    bruno: { state: "excluded", text: "Not documented." },
    insomnia: { state: "excluded", text: "Not documented." },
  },
  {
    feature: "Socket.IO, MQTT, MCP",
    gostman: { state: "included", text: "All three." },
    postman: { state: "included", text: "All three." },
    bruno: { state: "excluded", text: "Not documented." },
    insomnia: { state: "partial", text: "Socket.IO and MCP." },
  },
  {
    feature: "Web version",
    gostman: { state: "included", text: "No account needed." },
    postman: { state: "partial", text: "Needs an account." },
    bruno: { state: "excluded", text: "None." },
    insomnia: { state: "excluded", text: "None." },
  },
  {
    feature: "CLI for CI",
    gostman: { state: "included", text: "One binary." },
    postman: { state: "included", text: "Postman CLI." },
    bruno: { state: "included", text: "Node.js package or Docker image." },
    insomnia: { state: "included", text: "Inso CLI." },
  },
  {
    feature: "VS Code extension",
    gostman: { state: "excluded", text: "No." },
    postman: { state: "included", text: "Yes." },
    bruno: { state: "included", text: "Yes." },
    insomnia: { state: "excluded", text: "Not documented." },
  },
]
