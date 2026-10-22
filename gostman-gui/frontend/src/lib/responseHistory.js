import { formatSize, lookup } from './dataUtils'
import { ERROR_TITLES, textBody } from './response'

export const RESPONSE_HISTORY_LIMIT = 10
const MAX_KEPT_BODY = 2 * 1024 * 1024
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function rememberResponse(history = [], response, at) {
  if (!response || (response.body || '').length > MAX_KEPT_BODY) return history
  return [{ at, response }, ...history].slice(0, RESPONSE_HISTORY_LIMIT)
}

export const formatTime = (at) => TIME_FORMAT.format(at)

export function describeResponse({ at, response }) {
  const outcome = response.error ? lookup(ERROR_TITLES, response.error) || response.error : response.status
  const details = response.error ? [] : [`${response.durationMs} ms`, formatSize(response.size)]
  return [formatTime(at), outcome, ...details].filter(Boolean).join(' · ')
}

const LANGUAGE_JSON = 'json'
const LANGUAGE_TEXT = 'plaintext'

function prettyJson(response) {
  try {
    return JSON.stringify(JSON.parse(textBody(response)), null, 2)
  } catch {
    return null
  }
}

const prettyText = (response) => prettyJson(response) ?? textBody(response)

const headerText = (response) => (response.headers || [])
  .map(({ key, value }) => `${key}: ${value}`)
  .sort((first, second) => first.localeCompare(second))
  .join('\n')

export const COMPARE_PARTS = {
  body: { label: 'Body', text: prettyText, language: (response) => (prettyJson(response) === null ? LANGUAGE_TEXT : LANGUAGE_JSON) },
  headers: { label: 'Headers', text: headerText, language: () => LANGUAGE_TEXT },
}
