import {
  KIND_CANCELED, KIND_CONFIG, KIND_NETWORK, KIND_REPLY, KIND_TIMEOUT, KIND_TOO_LARGE,
  aiError, cleanDetail, statusError,
} from './errors'
import {
  PROVIDER_ANTHROPIC, PROVIDER_GEMINI, PROVIDER_OPENAI, providerById,
} from './providers'
import { scrubPrompt, scrubText } from './scrub'

const KEY_PREFIX = 'gostman-ai-key:'
const REQUEST_TIMEOUT_MS = 90000
const MAX_PROMPT_BYTES = 96 * 1024
const MAX_OUTPUT_BYTES = 64 * 1024
const DEFAULT_TOKENS = 2048
const MAX_TOKENS = 4096
const CHECK_TOKENS = 32
const ANTHROPIC_VERSION = '2023-06-01'
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']
const CHECK_PROMPT = { system: 'You are a connection test.', user: 'Reply with the single word ok.' }

const pending = new Map()

const textOf = (parts) => parts.filter((part) => part?.type === 'text').map((part) => part.text).join('')

const anthropicWire = ({ base, model, key, prompt, maxTokens }) => ({
  url: `${base}/v1/messages`,
  headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' },
  body: { model, max_tokens: maxTokens, system: prompt.system, messages: [{ role: 'user', content: prompt.user }] },
  read: (json) => textOf(json.content || []),
})

const geminiWire = ({ base, model, key, prompt, maxTokens }) => ({
  url: `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  headers: { 'x-goog-api-key': key },
  body: {
    systemInstruction: { parts: [{ text: prompt.system }] },
    contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
    generationConfig: { maxOutputTokens: maxTokens },
  },
  read: (json) => (json.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join(''),
})

const chatWire = (tokenField) => ({ base, model, key, prompt, maxTokens }) => ({
  url: `${base}/chat/completions`,
  headers: key ? { Authorization: `Bearer ${key}` } : {},
  body: {
    model,
    [tokenField]: maxTokens,
    messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
  },
  read: (json) => json.choices?.[0]?.message?.content || '',
})

const wireFor = (provider) => {
  if (provider === PROVIDER_ANTHROPIC) return anthropicWire
  if (provider === PROVIDER_GEMINI) return geminiWire
  return chatWire(provider === PROVIDER_OPENAI ? 'max_completion_tokens' : 'max_tokens')
}

function resolveBase(config) {
  const base = (config.baseUrl || providerById(config.provider).baseUrl).trim()
  let parsed
  try {
    parsed = new URL(base)
  } catch {
    return { problem: aiError(KIND_CONFIG, 'The base URL is not a valid address') }
  }
  if (parsed.username || parsed.password) return { problem: aiError(KIND_CONFIG, 'The base URL is not a valid address') }
  const isLoopback = LOOPBACK_HOSTS.includes(parsed.hostname)
  if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && (isLoopback || config.allowInsecure))) {
    return { base: base.replace(/\/+$/, '') }
  }
  return { problem: aiError(KIND_CONFIG, 'Use an https base URL, or allow plain http for it in the AI settings') }
}

const storages = () => [sessionStorage, localStorage]

function readKey(provider) {
  for (const storage of storages()) {
    try {
      const value = storage.getItem(KEY_PREFIX + provider)
      if (value) return value
    } catch {
      continue
    }
  }
  return ''
}

function dropKey(provider) {
  for (const storage of storages()) {
    try {
      storage.removeItem(KEY_PREFIX + provider)
    } catch {
      continue
    }
  }
}

function writeKey(provider, key, remember) {
  dropKey(provider)
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(KEY_PREFIX + provider, key)
}

function validate(config, key) {
  const preset = providerById(config.provider)
  if (!config.model.trim()) return { problem: aiError(KIND_CONFIG, 'Enter a model id') }
  if (preset.keyRequired && !key) return { problem: aiError(KIND_CONFIG, 'Paste an API key for this provider') }
  return resolveBase(config)
}

async function readReply(response, wire, key) {
  const raw = await response.text()
  if (!response.ok) {
    let detail = ''
    try {
      detail = cleanDetail(JSON.parse(raw)?.error?.message || '')
    } catch {
      detail = ''
    }
    return { error: statusError(response.status, scrubText(detail, [key])) }
  }
  try {
    const text = wire.read(JSON.parse(raw)).trim()
    if (!text) return { error: aiError(KIND_REPLY, 'The provider returned no answer') }
    return { text: text.slice(0, MAX_OUTPUT_BYTES) }
  } catch {
    return { error: aiError(KIND_REPLY, 'The provider answered with something that is not JSON. Check the base URL') }
  }
}

function failureOf(error, controller, key, timedOut) {
  if (timedOut()) return aiError(KIND_TIMEOUT, 'The provider did not answer in time')
  if (controller.signal.aborted) return aiError(KIND_CANCELED, 'Cancelled')
  const reason = scrubText(cleanDetail(error?.message || ''), [key])
  return aiError(KIND_NETWORK, `Could not reach the provider${reason ? `: ${reason}` : ''}. In a browser the provider must allow cross-origin calls; a local Ollama also needs OLLAMA_ORIGINS set to this site.`)
}

async function exchange(id, config, prompt, maxTokens) {
  const key = readKey(config.provider)
  const { base, problem } = validate(config, key)
  if (problem) return { error: problem }
  if (prompt.system.length + prompt.user.length > MAX_PROMPT_BYTES) {
    return { error: aiError(KIND_TOO_LARGE, 'The request is too large to send. Select less content') }
  }
  const wire = wireFor(config.provider)({ base, model: config.model.trim(), key, prompt, maxTokens })
  const controller = new AbortController()
  let didTimeOut = false
  const timer = setTimeout(() => {
    didTimeOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  pending.set(id, controller)
  try {
    const response = await fetch(wire.url, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...wire.headers },
      body: JSON.stringify(wire.body),
    })
    return await readReply(response, wire, key)
  } catch (error) {
    return { error: failureOf(error, controller, key, () => didTimeOut) }
  } finally {
    clearTimeout(timer)
    pending.delete(id)
  }
}

const withSecrets = (prompt, secrets, provider) => scrubPrompt(prompt, [...secrets, readKey(provider)])

export const webAi = {
  holdsKeyOnDevice: true,
  keyStored: async (provider) => readKey(provider) !== '',
  saveKey: async (provider, key, remember) => writeKey(provider, key.trim(), remember),
  removeKey: async (provider) => dropKey(provider),
  preview: async (provider, prompt, secrets) => withSecrets(prompt, secrets, provider),
  complete: (id, config, prompt, secrets, maxTokens) => (
    exchange(id, config, withSecrets(prompt, secrets, config.provider), Math.min(maxTokens || DEFAULT_TOKENS, MAX_TOKENS))
  ),
  check: (id, config) => exchange(id, config, CHECK_PROMPT, CHECK_TOKENS),
  cancel: async (id) => pending.get(id)?.abort(),
}
