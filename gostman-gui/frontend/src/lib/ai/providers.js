export const PROVIDER_ANTHROPIC = 'anthropic'
export const PROVIDER_OPENAI = 'openai'
export const PROVIDER_GEMINI = 'gemini'
export const PROVIDER_OPENROUTER = 'openrouter'
export const PROVIDER_OLLAMA = 'ollama'
export const PROVIDER_CUSTOM = 'custom'

export const PROVIDERS = [
  { id: PROVIDER_ANTHROPIC, label: 'Anthropic', baseUrl: 'https://api.anthropic.com', keyRequired: true, modelHint: 'claude-sonnet-4-5' },
  { id: PROVIDER_OPENAI, label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyRequired: true, modelHint: 'gpt-4o-mini' },
  { id: PROVIDER_GEMINI, label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com', keyRequired: true, modelHint: 'gemini-2.0-flash' },
  { id: PROVIDER_OPENROUTER, label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyRequired: true, modelHint: 'anthropic/claude-sonnet-4.5' },
  { id: PROVIDER_OLLAMA, label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', keyRequired: false, modelHint: 'llama3.1' },
  { id: PROVIDER_CUSTOM, label: 'OpenAI-compatible URL', baseUrl: '', keyRequired: false, modelHint: 'model id' },
]

export const providerById = (id) => PROVIDERS.find((provider) => provider.id === id) || PROVIDERS[0]

export const hostOf = (config) => {
  const base = config.baseUrl || providerById(config.provider).baseUrl
  try {
    return new URL(base).host
  } catch {
    return base
  }
}
