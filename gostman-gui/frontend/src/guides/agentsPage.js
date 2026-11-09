import { docPath } from "../docs/manifest.js"
import { RELEASES_URL } from "../lib/siteLinks.js"

const agentsDoc = (anchor) => `${docPath("agents")}#${anchor}`

export const agentsPage = {
  path: "ai-agents",
  title: "Let coding agents call your APIs safely, over MCP | Gostman",
  description: "gostman mcp gives Claude Code, Cursor and Codex your collection, with a host allowlist, secrets kept out of the chat and requests stored as YAML in Git.",
  heading: "Let your coding agent call your APIs, safely",
  intro: "gostman mcp serves a Gostman workspace to Claude Code, Cursor, Codex and any other MCP client. The agent works with the same requests, variables and environments you do, and the server decides which hosts it can reach and which secrets it gets.",
  brands: ["claude", "openai", "cursor", "vscode"],
  command: ["gostman init --skill", "claude mcp add gostman -- gostman mcp --workspace /path/to/gostman"],
  connect: {
    eyebrow: "Connect",
    title: "Connect an agent in three steps",
    steps: [
      {
        title: "Create a workspace and the skill",
        code: "gostman init --skill",
        text: "Creates the workspace folder, prints the registration command with its absolute path and writes the Agent Skill to .claude/skills/gostman/SKILL.md.",
      },
      {
        title: "Register the server",
        code: "claude mcp add gostman -- gostman mcp --workspace /path/to/gostman --var-from-env API_TOKEN",
        text: "Other clients register the command gostman with the arguments mcp --workspace and the path. --var-from-env passes a secret from your environment, and the server fills it in only where your own requests send it.",
      },
      {
        title: "Add requests",
        text: "Create requests in the app, import an OpenAPI spec with gostman import, or let the agent save and import them. Each one is a YAML file in the workspace.",
      },
    ],
    http: {
      title: "Prefer a running server?",
      text: "Add --listen to serve the same tools over Streamable HTTP on 127.0.0.1. The server refuses requests whose Host or Origin is not a loopback address and requires the bearer token it prints when it starts, or the one in GOSTMAN_MCP_TOKEN.",
      code: "gostman mcp --workspace api --listen 3401",
    },
    links: [
      { label: "Setup prompt and Agent Skill", href: agentsDoc("set-up-with-your-coding-agent") },
      { label: "Over HTTP", href: agentsDoc("over-http") },
    ],
  },
  tools: {
    eyebrow: "Tools",
    title: "What the agent can do",
    groups: [
      {
        id: "read",
        title: "Read the collection",
        icon: "book",
        tools: [
          { names: ["list_requests"], text: "Saved requests with their ids, folders and tags, and whether they have checks and examples." },
          { names: ["get_request"], text: "One request in full, with credentials masked." },
          { names: ["list_environments"], text: "Environments and the names of their variables, with the secret ones marked." },
        ],
      },
      {
        id: "send",
        title: "Send and run",
        icon: "send",
        tools: [
          { names: ["send_request"], text: "A saved or ad hoc request, with its scripts, checks, cookies and tokens." },
          { names: ["run_folder"], text: "A folder or the whole workspace, filtered by tags, with data rows or repeated up to 100 times." },
          { names: ["last_response"], text: "The last response again, compared with a saved example." },
          { names: ["set_environment"], text: "Switches the active environment for the session." },
        ],
      },
      {
        id: "edit",
        title: "Save and edit",
        icon: "pen",
        tools: [
          { names: ["save_request"], text: "Creates or changes a request: URL, headers, body, tags, checks and extraction rules." },
          { names: ["set_variables"], text: "Saves plain values such as baseUrl in an environment file." },
        ],
      },
      {
        id: "import",
        title: "Import specs",
        icon: "upload",
        tools: [
          { names: ["import_requests"], text: "From OpenAPI or Swagger, Postman, Insomnia, Bruno, HAR, .http files or curl, as text or from an address." },
        ],
      },
      {
        id: "mock",
        title: "Mock servers",
        icon: "server",
        tools: [
          { names: ["start_mock", "stop_mock", "mock_status"], text: "Run a mock server on localhost from the saved examples." },
        ],
      },
      {
        id: "load",
        title: "Load test",
        icon: "gauge",
        tools: [
          { names: ["load_test"], text: "Sends one saved request repeatedly: at most 20 at once, for 30 seconds and 5,000 requests." },
        ],
      },
      {
        id: "check",
        title: "Scan and lint",
        icon: "shield",
        tools: [
          { names: ["scan_secrets"], text: "Looks for credentials typed into the workspace, as gostman scan does." },
          { names: ["lint_spec"], text: "Checks an OpenAPI or Swagger document with the rules of gostman lint." },
        ],
      },
    ],
    exposed: {
      title: "Turn a request into a tool",
      text: "--expose-tag turns every request with that tag into a tool of its own, named after the request. Each {{variable}} in its address, headers and body becomes a parameter. Secret and credential-named variables and credential headers are never parameters.",
      code: "gostman mcp --workspace api --expose-tag agent",
    },
    links: [
      { label: "Every tool", href: agentsDoc("tools") },
      { label: "A collection as tools", href: agentsDoc("a-collection-as-tools") },
    ],
  },
  safety: {
    eyebrow: "Safety",
    title: "The server enforces the limits",
    lead: "These rules are enforced by gostman mcp, not by instructions the agent is asked to follow.",
    rules: [
      {
        title: "Hosts are allowlisted",
        text: "An agent can call localhost, the hosts of requests you wrote and the hosts you add with --allow-host. A refused request tells the agent to ask you. The same list covers spec fetches and load tests.",
      },
      {
        title: "Secrets go only where you send them",
        text: "A secret is filled in only for an address (scheme, host and port) where one of your own requests already sends that same secret. Anywhere else the placeholder goes out as written, and the result lists the name under withheld.",
      },
      {
        title: "Values come back as names",
        text: "Variable values and credentials are replaced with their {{name}} in everything the agent reads, including URL-encoded, base64 and JSON-escaped copies.",
      },
      {
        title: "Agent edits never widen the allowlist",
        text: "Requests an agent creates or imports, or whose host or port it changes, do not count as yours when the allowed hosts and secret addresses are worked out. Their ids are kept in .gostman/agent-requests.json.",
      },
      {
        title: "No literal credentials are written",
        text: "save_request refuses a value that matches a variable or a credential. set_variables refuses secrets, credential-named variables and values that look like tokens, and variables you marked secret cannot be changed.",
      },
      {
        title: "Imports are inert",
        text: "Scripts, OAuth 2.0 settings and secret values are left out of what an agent imports, and imports that read local files or run local commands are refused.",
      },
      {
        title: "No files, commands or sign-in",
        text: "Agent sessions never read files with {{$file(...)}}, never start stdio: MCP commands and cannot start an OAuth 2.0 browser sign-in. Pass a token you already have with --oauth-token-env.",
      },
      {
        title: "Answers stay small",
        text: "Response bodies are capped at 8 KB by default. The agent can narrow one with a JSONPath select or raise the cap to 256 KB.",
      },
    ],
    links: [{ label: "How the safety model works", href: agentsDoc("safety") }],
  },
  workspace: {
    eyebrow: "Shared workspace",
    title: "One collection for you and the agent",
    lead: "The workspace is a folder of plain files, so an agent's work is reviewed the way you review any other change.",
    points: [
      "Every request is one YAML file. What the agent saves shows up in git diff and in a pull request.",
      "The desktop app picks up changes made on disk within a few seconds, for a folder you have open.",
      "Two agents, or an agent and you, do not overwrite each other: a save is refused when the request or environment changed since the agent read it, and the changes tool lists what each session saved.",
      "Saved requests use the variables, environments and checks you already have.",
      "gostman init --skill writes the Agent Skill to .claude/skills/gostman/SKILL.md, a file you can commit with the rest.",
    ],
    links: [{ label: "Collections and Git", href: docPath("collections-and-git") }],
  },
  cli: {
    eyebrow: "Command line",
    title: "The same engine for agents with a shell, scripts and CI",
    lead: "gostman is one binary that works with the same workspace. Each command exits with a code a script can act on.",
    code: [
      "gostman send --workspace api \"Users/Get user\" --select '$.id'",
      "gostman send --json GET http://localhost:8080/health",
      "gostman run api --env CI --reporter junit:report.xml",
      "gostman flow run Checkout --workspace api --env CI",
    ],
    codeTitle: "terminal",
    points: [
      "send prints only the body, or the part chosen with --select. --json prints one JSON document.",
      "run writes text, JSON, JUnit, HTML or Markdown reports, and several at once.",
      "flow run runs a flow with the same flags, reports and exit codes.",
    ],
    exitCodes: [
      { code: "0", text: "Every request and check passed" },
      { code: "1", text: "A check, a script or an MCP tool call failed, or the run was interrupted" },
      { code: "2", text: "The command or the input is wrong" },
      { code: "3", text: "A request got no response" },
    ],
    links: [
      { label: "Command line reference", href: docPath("cli") },
      { label: "Exit codes", href: `${docPath("cli")}#exit-codes` },
      { label: "CI recipes", href: docPath("ci") },
      { label: "Flows", href: docPath("flows") },
    ],
  },
  limits: {
    eyebrow: "Limits",
    title: "What this does not do",
    items: [
      "It guards against accidental exposure. It does not protect against a server that returns a secret in a transformed form.",
      "A variable value shorter than six characters, with fewer than four different characters, or such as true and null is not treated as a secret.",
      "gostman send --reveal prints secrets for people and CI. An agent that can run shell commands could call it, so deny it in the agent's command permissions.",
      "An agent cannot start the OAuth 2.0 authorization code or device code grants, which need you in a browser.",
      "WebSocket requests are not available to agents, and there are no tools for negative tests or fuzzing.",
      "The app and gostman mcp are separate processes. The agent sees the files on disk, not the tabs you have open or edits you have not saved.",
    ],
    links: [{ label: "Safety in the docs", href: agentsDoc("safety") }],
  },
  closing: {
    title: "Try it on a collection you already have",
    text: "Install the gostman command with go install, or download the gostman-cli archive for your platform from the releases page. Then create a workspace and register the server with your agent.",
    code: ["go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest", "gostman init --skill"],
    links: [
      { label: "Use Gostman from a coding agent", href: docPath("agents") },
      { label: "Command line reference", href: docPath("cli") },
      { label: "gostman-cli on the releases page", href: RELEASES_URL },
    ],
  },
}
