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
