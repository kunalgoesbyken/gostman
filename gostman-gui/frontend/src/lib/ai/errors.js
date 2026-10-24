import { AI_TEXT } from '../aiText'
import { PROVIDER_ANTHROPIC, PROVIDER_CUSTOM, PROVIDER_LM_STUDIO, PROVIDER_OLLAMA } from './providers'

export const KIND_AUTH = 'auth'
export const KIND_RATE_LIMIT = 'rate_limit'
export const KIND_REQUEST = 'request'
export const KIND_SERVER = 'server'
export const KIND_NETWORK = 'network'
export const KIND_TIMEOUT = 'timeout'
export const KIND_CANCELED = 'canceled'
export const KIND_CONFIG = 'config'
export const KIND_TOO_LARGE = 'too_large'
export const KIND_REPLY = 'reply'
export const KIND_CUT_OFF = 'cut_off'

const DETAIL_LIMIT = 300
const MAX_RETRY_SECONDS = 3600
const STATUS_BAD_REQUEST = 400
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403
const STATUS_TIMEOUT = 408
const STATUS_UNPROCESSABLE = 422
const STATUS_RATE_LIMIT = 429
const STATUS_SERVER = 500

const TEXT = AI_TEXT.errors

const MESSAGES_BY_KIND = { [KIND_CUT_OFF]: AI_TEXT.cutOff }

export const aiError = (kind, message, status = 0) => ({ kind, status, message })

export const errorMessage = (error) => MESSAGES_BY_KIND[error.kind] || error.message

export const rejectsSchema = (error) => (
  error.kind === KIND_REQUEST && (error.status === STATUS_BAD_REQUEST || error.status === STATUS_UNPROCESSABLE)
)

function classify(status) {
  if (status === STATUS_UNAUTHORIZED || status === STATUS_FORBIDDEN) return [KIND_AUTH, TEXT.rejectedKey]
  if (status === STATUS_RATE_LIMIT) return [KIND_RATE_LIMIT, TEXT.rateLimited]
  if (status === STATUS_TIMEOUT) return [KIND_TIMEOUT, TEXT.providerTimeout]
  if (status >= STATUS_SERVER) return [KIND_SERVER, TEXT.providerProblem]
  return [KIND_REQUEST, TEXT.refused(status)]
}

export const cleanDetail = (text) => String(text).split(/\s+/).filter(Boolean).join(' ').slice(0, DETAIL_LIMIT)

function retryNote(retryAfter) {
  const seconds = Number(retryAfter)
  return retryAfter && Number.isInteger(seconds) && seconds > 0 && seconds <= MAX_RETRY_SECONDS ? TEXT.retryIn(seconds) : ''
}

export function statusError(status, detail, retryAfter = '') {
  const [kind, summary] = classify(status)
  const hinted = summary + retryNote(retryAfter)
  return aiError(kind, detail ? `${hinted}: ${detail}` : hinted, status)
}

const browserAdvice = (provider, origin) => {
  if (provider === PROVIDER_OLLAMA) return TEXT.ollamaAdvice(origin)
  if (provider === PROVIDER_LM_STUDIO) return TEXT.lmStudioAdvice
  if (provider === PROVIDER_CUSTOM) return `${TEXT.customAdvice(origin)} ${TEXT.desktopAdvice}`
  if (provider === PROVIDER_ANTHROPIC) return `${TEXT.anthropicAdvice} ${TEXT.desktopAdvice}`
  return `${TEXT.generalAdvice} ${TEXT.desktopAdvice}`
}

export const unreachableMessage = ({ provider, host, origin, reason }) => TEXT.unreachable(host, reason, browserAdvice(provider, origin))
