import { JSONPath } from 'jsonpath-plus'
import { isPlainObject, parseJSON } from './dataUtils'
import { findHeader, textBody } from './response'
import { isVariableName } from './validation'

export const SOURCE_BODY = 'body'
export const SOURCE_HEADER = 'header'
export const SOURCE_COOKIE = 'cookie'
export const SOURCE_STATUS = 'status'

export const EXTRACTOR_SOURCES = [
  { value: SOURCE_BODY, label: 'JSON body', hint: '$.data.token' },
  { value: SOURCE_HEADER, label: 'Header', hint: 'Location' },
  { value: SOURCE_COOKIE, label: 'Cookie', hint: 'session' },
  { value: SOURCE_STATUS, label: 'Status code', hint: '' },
]

export const BLANK_EXTRACTOR = { name: '', source: SOURCE_BODY, expression: '', enabled: true }

const SOURCE_VALUES = EXTRACTOR_SOURCES.map((source) => source.value)

const parsedBodies = new WeakMap()

const found = (value) => ({ value })
const missing = (reason) => ({ reason })

const asText = (value) => (typeof value === 'string' ? value : '')

const toExtractor = (raw) => ({
  name: asText(raw.name),
  source: SOURCE_VALUES.includes(raw.source) ? raw.source : SOURCE_BODY,
  expression: asText(raw.expression),
  enabled: raw.enabled !== false,
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

function fromBody(response, path) {
  if (path === '') return missing('Enter a JSONPath such as $.data.id')
  const body = jsonBody(response)
  if (body.reason) return body
  let match
  try {
    match = JSONPath({ path, json: body.json, wrap: false })
  } catch (error) {
    return missing(`Invalid JSONPath: ${error.message}`)
  }
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

export function evaluateExtractor(extractor, response) {
  if (!isVariableName(extractor.name)) {
    return missing(extractor.name === '' ? 'Name the variable' : 'Use letters, digits, _ and - in the name')
  }
  return READERS[extractor.source](response, extractor.expression.trim())
}

export function extractVariables(extractors, response) {
  const variables = {}
  for (const extractor of extractors.filter((candidate) => candidate.enabled)) {
    const result = evaluateExtractor(extractor, response)
    if (!result.reason) variables[extractor.name] = result.value
  }
  return variables
}
