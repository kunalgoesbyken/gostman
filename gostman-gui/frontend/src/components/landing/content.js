export const AI_AVAILABLE = true

export const AI_FEATURE = {
  title: "AI features, bring your own key",
  description: "Off by default, and hidden while off. Bring your own key for Anthropic, OpenAI, Gemini, OpenRouter, Ollama, LM Studio or any compatible URL. Keys stay on your device, in the OS keychain on desktop, and each request is previewed with secrets masked unless you turn the preview off.",
  brands: ["anthropic", "openai", "gemini", "openrouter", "ollama"],
}

export const SITE_LANGUAGE = "en"

export const formatList = (items) => new Intl.ListFormat(SITE_LANGUAGE, { type: "conjunction" }).format(items)

export const EDITOR_ENTRIES = [
  {
    key: "vscode",
    title: "VS Code extension",
    text: "Run collections, folders and flows, lint specs and scan for secrets from the editor, through the same CLI as CI.",
    link: "Install extension",
    docs: "vscode",
  },
  {
    key: "mcp",
    title: "MCP server for coding agents",
    text: "gostman mcp lets Claude Code, Codex and Cursor call your APIs through your saved requests, with secrets kept out of reach.",
    link: "MCP docs",
    docs: "agents",
  },
]
