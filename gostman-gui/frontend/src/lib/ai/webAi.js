import { AI_TEXT } from '../aiText'
import {
  KIND_CANCELED, KIND_CONFIG, KIND_CUT_OFF, KIND_NETWORK, KIND_REPLY, KIND_TIMEOUT, KIND_TOO_LARGE,
  aiError, cleanDetail, rejectsSchema, statusError, unreachableMessage,
} from './errors'
import {
  PROVIDER_ANTHROPIC, PROVIDER_GEMINI, PROVIDER_OPENAI, providerById,
} from './providers'
import { scrubPrompt, scrubText } from './scrub'

const KEY_PREFIX = 'gostman-ai-key:'
const BASE_SUFFIX = ':base'
const REQUEST_TIMEOUT_MS = 120000
const MAX_PROMPT_BYTES = 96 * 1024
const MAX_OUTPUT_BYTES = 64 * 1024
const DEFAULT_TOKENS = 4096
const MAX_TOKENS = 8192
const CHECK_TOKENS = 32
const MAX_MODELS = 1000
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_CUT_OFF = ['max_tokens', 'model_context_window_exceeded']
const CHAT_CUT_OFF = 'length'
const GEMINI_CUT_OFF = 'MAX_TOKENS'
const GEMINI_GENERATE = 'generateContent'
const GEMINI_MODEL_PREFIX = 'models/'
const JSON_TYPE = 'application/json'
const SCHEMA_NAME = 'reply'
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']
const CHECK_PROMPT = { system: 'You are a connection test.', user: 'Reply with the single word ok.' }
const TEXT = AI_TEXT.errors

const pending = new Map()

const textOf = (parts) => parts.filter((part) => part?.type === 'text').map((part) => part.text).join('')

const idsOf = (list) => (Array.isArray(list) ? list.map((model) => model?.id).filter((id) => typeof id === 'string') : [])

const anthropicHeaders = (key) => ({
  'x-api-key': key,
  'anthropic-version': ANTHROPIC_VERSION,
  'anthropic-dangerous-direct-browser-access': 'true',
})

const anthropicWire = {
  complete: ({ base, model, key, prompt, maxTokens }) => ({
    url: `${base}/v1/messages`,
    headers: anthropicHeaders(key),
    body: {
      model,
      max_tokens: maxTokens,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      ...(prompt.schema && { output_config: { format: { type: 'json_schema', schema: prompt.schema } } }),
    },
    read: (json) => ({ text: textOf(json.content || []), cutOff: ANTHROPIC_CUT_OFF.includes(json.stop_reason) }),
  }),
  models: ({ base, key }) => ({ url: `${base}/v1/models?limit=${MAX_MODELS}`, headers: anthropicHeaders(key), read: (json) => idsOf(json.data) }),
}

const geminiWire = {
  complete: ({ base, model, key, prompt, maxTokens }) => ({
    url: `${base}/v1beta/models/${encodeURIComponent(model)}:${GEMINI_GENERATE}`,
    headers: { 'x-goog-api-key': key },
    body: {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(prompt.schema && { responseMimeType: JSON_TYPE, responseJsonSchema: prompt.schema }),
      },
    },
    read: (json) => {
      const candidate = json.candidates?.[0]
      return {
        text: (candidate?.content?.parts || []).map((part) => part.text || '').join(''),
        cutOff: candidate?.finishReason === GEMINI_CUT_OFF,
      }
    },
  }),
  models: ({ base, key }) => ({
    url: `${base}/v1beta/models?pageSize=${MAX_MODELS}`,
    headers: { 'x-goog-api-key': key },
    read: (json) => (json.models || [])
      .filter((model) => model?.supportedGenerationMethods?.includes(GEMINI_GENERATE) && typeof model.name === 'string')
      .map((model) => (model.name.startsWith(GEMINI_MODEL_PREFIX) ? model.name.slice(GEMINI_MODEL_PREFIX.length) : model.name)),
  }),
}

const bearer = (key) => (key ? { Authorization: `Bearer ${key}` } : {})

const chatWire = (tokenField) => ({
  complete: ({ base, model, key, prompt, maxTokens }) => ({
    url: `${base}/chat/completions`,
    headers: bearer(key),
    body: {
      model,
      [tokenField]: maxTokens,
      messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      ...(prompt.schema && { response_format: { type: 'json_schema', json_schema: { name: SCHEMA_NAME, strict: true, schema: prompt.schema } } }),
    },
    read: (json) => {
      const choice = json.choices?.[0]
      return { text: choice?.message?.content || '', cutOff: choice?.finish_reason === CHAT_CUT_OFF }
    },
  }),
  models: ({ base, key }) => ({ url: `${base}/models`, headers: bearer(key), read: (json) => idsOf(json.data) }),
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
    return { problem: aiError(KIND_CONFIG, TEXT.invalidBase) }
  }
  if (parsed.username || parsed.password) return { problem: aiError(KIND_CONFIG, TEXT.invalidBase) }
  const isLoopback = LOOPBACK_HOSTS.includes(parsed.hostname)
  if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && (isLoopback || config.allowInsecure))) {
    return { base: base.replace(/\/+$/, '') }
  }
  return { problem: aiError(KIND_CONFIG, TEXT.insecureBase) }
}

const storages = () => [sessionStorage, localStorage]

function readEntry(name) {
  for (const storage of storages()) {
    try {
      const value = storage.getItem(name)
      if (value) return value
    } catch {
      continue
    }
  }
  return ''
}

const keyName = (provider) => KEY_PREFIX + provider
const baseName = (provider) => keyName(provider) + BASE_SUFFIX

const readKey = (provider) => readEntry(keyName(provider))

function dropKey(provider) {
  for (const storage of storages()) {
    try {
      storage.removeItem(keyName(provider))
      storage.removeItem(baseName(provider))
    } catch {
      continue
    }
  }
}

function writeKey(config, key, remember) {
  const { base, problem } = resolveBase(config)
  if (problem) throw new Error(problem.message)
  dropKey(config.provider)
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(keyName(config.provider), key)
  storage.setItem(baseName(config.provider), base)
}

function connect(config) {
  const { base, problem } = resolveBase(config)
  if (problem) return { problem }
  const key = readKey(config.provider)
  if (key && readEntry(baseName(config.provider)) !== base) return { problem: aiError(KIND_CONFIG, TEXT.keyMoved) }
  if (providerById(config.provider).keyRequired && !key) return { problem: aiError(KIND_CONFIG, TEXT.pasteKey) }
  return { base, key }
}

function providerDetail(raw) {
  try {
    return cleanDetail(JSON.parse(raw)?.error?.message || '')
  } catch {
    return ''
  }
}

function failureOf(error, controller, key, timedOut, config, base) {
  if (timedOut()) return aiError(KIND_TIMEOUT, TEXT.timedOut)
  if (controller.signal.aborted) return aiError(KIND_CANCELED, AI_TEXT.cancelled)
  const reason = scrubText(cleanDetail(error?.message || ''), [key])
  return aiError(KIND_NETWORK, unreachableMessage({ provider: config.provider, host: new URL(base).host, origin: window.location.origin, reason }))
}

async function send(id, request, { config, base, key }) {
  const controller = new AbortController()
  let didTimeOut = false
  const timer = setTimeout(() => {
    didTimeOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  pending.set(id, controller)
  try {
    const response = await fetch(request.url, {
      method: request.body ? 'POST' : 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { ...(request.body && { 'Content-Type': JSON_TYPE }), ...request.headers },
      body: request.body && JSON.stringify(request.body),
    })
    const raw = await response.text()
    if (!response.ok) {
      return { error: statusError(response.status, scrubText(providerDetail(raw), [key]), response.headers.get('retry-after') || '') }
    }
    try {
      return { value: request.read(JSON.parse(raw)) }
    } catch {
      return { error: aiError(KIND_REPLY, TEXT.notJson) }
    }
  } catch (error) {
    return { error: failureOf(error, controller, key, () => didTimeOut, config, base) }
  } finally {
    clearTimeout(timer)
    pending.delete(id)
  }
}

async function exchange(id, config, prompt, maxTokens) {
  if (!config.model.trim()) return { error: aiError(KIND_CONFIG, TEXT.enterModel) }
  const connection = connect(config)
  if (connection.problem) return { error: connection.problem }
  if (prompt.system.length + prompt.user.length > MAX_PROMPT_BYTES) return { error: aiError(KIND_TOO_LARGE, TEXT.tooLarge) }
  const wire = wireFor(config.provider)
  const context = { ...connection, config }
  const ask = (asked) => send(id, wire.complete({ ...connection, model: config.model.trim(), prompt: asked, maxTokens }), context)
  const reply = await ask(prompt)
  if (reply.error && prompt.schema && rejectsSchema(reply.error)) return ask({ ...prompt, schema: undefined })
  return reply
}

async function complete(id, config, prompt, maxTokens) {
  const { value, error } = await exchange(id, config, prompt, Math.min(maxTokens || DEFAULT_TOKENS, MAX_TOKENS))
  if (error) return { error }
  if (value.cutOff) return { error: aiError(KIND_CUT_OFF, AI_TEXT.cutOff) }
  const text = value.text.trim()
  if (!text) return { error: aiError(KIND_REPLY, TEXT.noAnswer) }
  return { text: text.slice(0, MAX_OUTPUT_BYTES) }
}

async function check(id, config) {
  const { value, error } = await exchange(id, config, CHECK_PROMPT, CHECK_TOKENS)
  if (error) return { error }
  if (!value.cutOff && !value.text.trim()) return { error: aiError(KIND_REPLY, TEXT.noAnswer) }
  return { text: '' }
}

async function models(id, config) {
  const connection = connect(config)
  if (connection.problem) return { error: connection.problem }
  const { value, error } = await send(id, wireFor(config.provider).models(connection), { ...connection, config })
  if (error) return { error }
  return { models: [...new Set(value)].sort().slice(0, MAX_MODELS) }
}

const withSecrets = (prompt, secrets, provider) => scrubPrompt(prompt, [...secrets, readKey(provider)])

export const webAi = {
  holdsKeyOnDevice: true,
  keyStored: async (provider) => readKey(provider) !== '',
  saveKey: async (config, key, remember) => writeKey(config, key.trim(), remember),
  removeKey: async (provider) => dropKey(provider),
  preview: async (provider, prompt, secrets) => withSecrets(prompt, secrets, provider),
  complete: (id, config, prompt, secrets, maxTokens) => complete(id, config, withSecrets(prompt, secrets, config.provider), maxTokens),
  check,
  models,
  cancel: async (id) => pending.get(id)?.abort(),
}
