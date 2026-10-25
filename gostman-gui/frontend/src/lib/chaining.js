import { isPlainObject, parseJSON } from './dataUtils'
import { queryJson } from './jsonPath'
import { findHeader, textBody } from './response'
import { SCOPE_ENVIRONMENT, SCOPE_SESSION } from './scripting/scopes'
import { isVariableName } from './validation'

const SOURCE_BODY = 'body'
const SOURCE_HEADER = 'header'
const SOURCE_COOKIE = 'cookie'
export const SOURCE_STATUS = 'status'

export const EXTRACTOR_SOURCES = [
  { value: SOURCE_BODY, label: 'JSON body', hint: '$.data.token' },
  { value: SOURCE_HEADER, label: 'Header', hint: 'Location' },
  { value: SOURCE_COOKIE, label: 'Cookie', hint: 'session' },
  { value: SOURCE_STATUS, label: 'Status code', hint: '' },
]

export const BLANK_EXTRACTOR = { name: '', source: SOURCE_BODY, expression: '', enabled: true }

const SOURCE_VALUES = EXTRACTOR_SOURCES.map((source) => source.value)

export const EXTRACTOR_SCOPES = [SCOPE_SESSION, SCOPE_ENVIRONMENT]

export const defaultExtractScope = (workspacePath) => (workspacePath ? SCOPE_SESSION : SCOPE_ENVIRONMENT)

const parsedBodies = new WeakMap()

const found = (value) => ({ value })
const missing = (reason) => ({ reason })

const asText = (value) => (typeof value === 'string' ? value : '')

const toExtractor = (raw) => ({
  name: asText(raw.name),
  source: SOURCE_VALUES.includes(raw.source) ? raw.source : SOURCE_BODY,
  expression: asText(raw.expression),
  enabled: raw.enabled !== false,
  ...(EXTRACTOR_SCOPES.includes(raw.scope) && { scope: raw.scope }),
})

export function parseExtractors(json) {
  const parsed = parseJSON(json, [])
  return Array.isArray(parsed) ? parsed.filter(isPlainObject).map(toExtractor) : []
}

export const serializeExtractors = (extractors) => (extractors.length > 0 ? JSON.stringify(extractors) : '')

export const isBlankExtractor = (extractor) => (
  extractor.name === '' && extractor.expression === '' && extractor.source === SOURCE_BODY
)

function parseBody(response) {
  const text = textBody(response)
  if (text.trim() === '') return missing(response.body ? 'The response body is binary, not JSON' : 'The response body is empty')
  try {
    return { json: JSON.parse(text) }
  } catch {
    return missing(response.truncated ? 'The response was cut off, so its body is not complete JSON' : 'The response body is not JSON')
  }
}

function jsonBody(response) {
  if (!parsedBodies.has(response)) parsedBodies.set(response, parseBody(response))
  return parsedBodies.get(response)
}

export function evaluateJsonPath(json, path) {
  try {
    return { value: queryJson(path, json) }
  } catch (error) {
    return { error: error.message }
  }
}

function fromBody(response, path) {
  if (path === '') return missing('Enter a JSONPath such as $.data.id')
  const body = jsonBody(response)
  if (body.reason) return body
  const { value: match, error } = evaluateJsonPath(body.json, path)
  if (error) return missing(`Invalid JSONPath: ${error}`)
  if (match === undefined) return missing('Nothing in the body matches this path')
  if (match === null) return missing('The matched value is null')
  return found(typeof match === 'object' ? JSON.stringify(match) : match)
}

function fromHeader(response, name) {
  if (name === '') return missing('Enter a header name')
  const value = findHeader(response.headers, name)
  return value === null ? missing(`The response has no ${name} header`) : found(value)
}

function fromCookie(response, name) {
  if (name === '') return missing('Enter a cookie name')
  const cookie = (response.cookies || []).find((candidate) => candidate.name === name)
  return cookie ? found(cookie.value) : missing(`The response has no ${name} cookie`)
}

const READERS = {
  [SOURCE_BODY]: fromBody,
  [SOURCE_HEADER]: fromHeader,
  [SOURCE_COOKIE]: fromCookie,
  [SOURCE_STATUS]: (response) => found(response.statusCode),
}

export const isUsableResponse = (response) => Boolean(response && !response.error)

export const readsBodyPath = (extractor) => (
  extractor.source === SOURCE_BODY && isVariableName(extractor.name) && extractor.expression.trim() !== ''
)

export function evaluateExtractor(extractor, response) {
  if (!isVariableName(extractor.name)) {
    return missing(extractor.name === '' ? 'Name the variable' : 'A variable name has no } and does not start or end with a space')
  }
  return READERS[extractor.source](response, extractor.expression.trim())
}

export const enabledExtractors = (extractors) => extractors.filter((candidate) => candidate.enabled)

export const evaluateExtractors = (extractors, response) => extractors.map((extractor) => evaluateExtractor(extractor, response))

export function writesFrom(extractors, outcomes, fallbackScope) {
  const writes = Object.fromEntries(EXTRACTOR_SCOPES.map((scope) => [scope, {}]))
  extractors.forEach((extractor, index) => {
    if (!outcomes[index].reason) writes[extractor.scope || fallbackScope][extractor.name] = outcomes[index].value
  })
  return writes
}

export function extractWrites(extractors, response, fallbackScope) {
  const enabled = enabledExtractors(extractors)
  return writesFrom(enabled, evaluateExtractors(enabled, response), fallbackScope)
}

export function extractVariables(extractors, response) {
  const variables = {}
  for (const extractor of enabledExtractors(extractors)) {
    const result = evaluateExtractor(extractor, response)
    if (!result.reason) variables[extractor.name] = result.value
  }
  return variables
}
