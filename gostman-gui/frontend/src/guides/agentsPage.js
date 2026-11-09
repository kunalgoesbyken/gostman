import { docPath } from "../docs/manifest.js"

const agentsDoc = (anchor) => `${docPath("agents")}#${anchor}`

export const agentsPage = {
  path: "ai-agents",
  title: "Let coding agents call your APIs safely, over MCP | Gostman",
  description: "gostman mcp gives Claude Code, Cursor and Codex your saved requests, with a host allowlist, secrets kept out of the chat and changes you review in Git.",
  heading: "Let your coding agent call your APIs",
  intro: "gostman mcp gives Claude Code, Cursor and Codex the requests, environments and checks you already have. The server decides which hosts the agent reaches and which secrets it gets.",
  brands: ["claude", "openai", "cursor", "vscode"],
  transcript: [
    { kind: "prompt", text: "Check that creating a user still returns 201" },
    { kind: "tool", tool: "send_request", target: "Users/Create user" },
    { kind: "result", text: "201 Created · 142 ms · 1 check passed" },
    { kind: "detail", text: "Authorization: Bearer {{API_TOKEN}}" },
    { kind: "prompt", text: "Add a request that deletes the user" },
    { kind: "tool", tool: "save_request", target: "Users/Delete user" },
    { kind: "result", text: "Saved in Users" },
  ],
  connect: {
    title: "Connect in two commands",
    lead: "Install the gostman command, create a workspace and register it with your agent. Requests you already have are ready to use.",
    steps: [
      { title: "Create a workspace", text: "Writes the workspace folder and the Agent Skill.", code: "gostman init --skill" },
      { title: "Register the server", text: "Cursor, Codex and other MCP clients take the same command.", code: "claude mcp add gostman -- gostman mcp --workspace /path/to/gostman" },
    ],
    link: { label: "Setup guide", href: agentsDoc("set-up-with-your-coding-agent") },
  },
  abilities: {
    title: "What your agent can do",
    lead: "The same collection you use in the app, as tools.",
    items: [
      { icon: "book", title: "Read your collection", text: "Saved requests and environments, with every credential masked.", tools: ["list_requests", "get_request"] },
      { icon: "send", title: "Send and run", text: "One request or a whole folder, with its scripts and checks.", tools: ["send_request", "run_folder"] },
      { icon: "pen", title: "Save requests", text: "New requests and checks land as YAML files you review in git diff.", tools: ["save_request"] },
      { icon: "upload", title: "Import specs", text: "OpenAPI, Postman, Insomnia, Bruno, HAR or a curl command.", tools: ["import_requests"] },
      { icon: "server", title: "Mock and load test", text: "Serve saved examples on localhost, or send one request repeatedly.", tools: ["start_mock", "load_test"] },
      { icon: "tag", title: "Requests as tools", text: "Tag a request and it becomes a tool of its own, its variables as parameters.", tools: ["--expose-tag"] },
    ],
    link: { label: "Every tool", href: agentsDoc("tools") },
  },
  safety: {
    title: "Safe by default",
    lead: "Enforced by the server, not by instructions the agent is asked to follow.",
    items: [
      { icon: "globe", title: "Allowlisted hosts", text: "Only localhost, the hosts of your own requests and the ones you allow." },
      { icon: "key", title: "Secrets stay names", text: "The agent reads {{API_TOKEN}}, never the token, which is sent only where your own requests send it." },
      { icon: "merge", title: "No silent overwrites", text: "A save is refused when the request changed since the agent read it, and a journal shows who saved what." },
      { icon: "lock", title: "No files or commands", text: "Agent sessions never read local files, run commands or open a browser sign-in." },
    ],
    link: { label: "How the safety model works", href: agentsDoc("safety") },
  },
  closing: {
    title: "Try it on a collection you already have",
    code: ["go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest", "gostman init --skill"],
    link: { label: "Use Gostman from a coding agent", href: docPath("agents") },
  },
}
