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

const DETAIL_LIMIT = 300
const MAX_RETRY_SECONDS = 3600
const STATUS_UNAUTHORIZED = 401
const STATUS_FORBIDDEN = 403
const STATUS_TIMEOUT = 408
const STATUS_RATE_LIMIT = 429
const STATUS_SERVER = 500

export const aiError = (kind, message, status = 0) => ({ kind, status, message })

function classify(status) {
  if (status === STATUS_UNAUTHORIZED || status === STATUS_FORBIDDEN) {
    return [KIND_AUTH, 'The provider rejected the key, or the account may not use this model']
  }
  if (status === STATUS_RATE_LIMIT) {
    return [KIND_RATE_LIMIT, 'The provider is rate limiting or out of quota. Wait a moment and try again']
  }
  if (status === STATUS_TIMEOUT) return [KIND_TIMEOUT, 'The provider timed out']
  if (status >= STATUS_SERVER) return [KIND_SERVER, 'The provider had a problem. Try again shortly']
  return [KIND_REQUEST, `The provider refused the request (${status})`]
}

export const cleanDetail = (text) => String(text).split(/\s+/).filter(Boolean).join(' ').slice(0, DETAIL_LIMIT)

function retryNote(retryAfter) {
  const seconds = Number(retryAfter)
  return retryAfter && Number.isInteger(seconds) && seconds > 0 && seconds <= MAX_RETRY_SECONDS ? ` (retry in ${seconds}s)` : ''
}

export function statusError(status, detail, retryAfter = '') {
  const [kind, summary] = classify(status)
  const hinted = summary + retryNote(retryAfter)
  return aiError(kind, detail ? `${hinted}: ${detail}` : hinted, status)
}
