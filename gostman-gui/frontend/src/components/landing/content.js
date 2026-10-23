export const AI_AVAILABLE = true

export const AI_FEATURE = {
  title: "AI features, bring your own key",
  description: "Off by default. Bring your own key for Anthropic, OpenAI, Gemini, OpenRouter, Ollama or any compatible URL. Keys stay on your device, in the OS keychain on desktop, and each request is previewed with secrets masked.",
}

export const SITE_LANGUAGE = "en"

export const formatList = (items) => new Intl.ListFormat(SITE_LANGUAGE, { type: "conjunction" }).format(items)
