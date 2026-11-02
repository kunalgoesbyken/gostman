export const AI_AVAILABLE = true

export const AI_FEATURE = {
  title: "AI features, bring your own key",
  description: "Off by default, and hidden while off. Bring your own key for Anthropic, OpenAI, Gemini, OpenRouter, Ollama, LM Studio or any compatible URL. Keys stay on your device, in the OS keychain on desktop, and each request is previewed with secrets masked unless you turn the preview off.",
  brands: ["anthropic", "openai", "gemini", "openrouter", "ollama"],
}

export const SITE_LANGUAGE = "en"

export const formatList = (items) => new Intl.ListFormat(SITE_LANGUAGE, { type: "conjunction" }).format(items)

const WORKSPACE_PATH = "/path/to/project/gostman"
const SERVER_ARGS = ["mcp", "--workspace", WORKSPACE_PATH]
const json = (value) => JSON.stringify(value, null, 2)

export const VSCODE_BUTTON = "Install in VS Code"

export const MCP_CLIENTS = [
  { id: "claude", label: "Claude Code", file: null, snippet: `claude mcp add gostman -- gostman ${SERVER_ARGS.join(" ")}` },
  { id: "codex", label: "Codex", file: null, snippet: `codex mcp add gostman -- gostman ${SERVER_ARGS.join(" ")}` },
  { id: "cursor", label: "Cursor", file: ".cursor/mcp.json", snippet: json({ mcpServers: { gostman: { command: "gostman", args: SERVER_ARGS } } }) },
  { id: "vscode", label: "VS Code", file: ".vscode/mcp.json", snippet: json({ servers: { gostman: { type: "stdio", command: "gostman", args: SERVER_ARGS } } }) },
]

export const MCP_NEEDS_CLI = "Needs the gostman CLI installed."
export const MCP_TITLE = "MCP server for coding agents"

export const AGENT_SETUP_TITLE = "Set up with your coding agent"
export const AGENT_SKILL_COMMAND = "npx skills add kunalgoesbyken/gostman --skill gostman"
export const AGENT_PROMPT_NOTE = "Paste it into your coding agent to install, register and try Gostman."
export const AGENT_PROMPT_BUTTON = "Copy setup prompt"
export const AGENT_PROMPT = [
  "Set up Gostman in this project so you can call and test its APIs without curl.",
  "",
  "1. If `gostman version` fails, install the gostman command with `go install github.com/kunalgoesbyken/gostman/cmd/gostman@latest`, or download the gostman-cli archive for this platform from https://github.com/kunalgoesbyken/gostman/releases/latest.",
  "2. Run `gostman init --skill` in the project root. Note the workspace folder and the `mcp` registration command it prints.",
  "3. Register that command with your MCP client, using the absolute workspace path.",
  "4. If the project has an OpenAPI spec, run `gostman import <spec> --out <workspace>`. Otherwise ask me which API to call.",
  "5. Send one request with the gostman tools, run the workspace with `gostman run <workspace>`, and tell me what passed.",
  "",
  "Never pass --reveal. Keep credentials in {{variables}}, and ask me before calling a host that my saved requests do not already use.",
].join("\n")
