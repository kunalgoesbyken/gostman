import { isPlainObject, parseJSON } from '../dataUtils'
import { parseRows } from '../rows'
import { textBody } from '../response'
import { isSensitiveName } from '../sensitiveNames'

export const MASK = '{{redacted}}'

const BODY_EXCERPT_BYTES = 4096
const REQUEST_BODY_BYTES = 6144
const SHAPE_DEPTH = 6
const SHAPE_KEYS = 40
const TEMPLATE_OPEN = '{{'
const SCHEME_SEPARATOR = '://'
const AUTHORITY_END = ['/', '?', '#']
const USERINFO_END = '@'

const isTemplate = (value) => String(value).includes(TEMPLATE_OPEN)

const maskedValue = (name, value) => (isSensitiveName(name) && !isTemplate(value) && value !== '' ? MASK : value)

const excerpt = (text, limit) => (text.length > limit ? `${text.slice(0, limit)}\n[truncated]` : text)

export function maskedRows(raw) {
  return parseRows(raw)
    .filter((row) => row.enabled !== false && row.key)
    .map((row) => ({ key: row.key, value: maskedValue(row.key, row.value) }))
}

function maskedPairs(text) {
  const params = new URLSearchParams(text)
  return [...params].map(([name, value]) => [name, maskedValue(name, value)])
}

function maskedUserinfo(url) {
  const schemeAt = url.indexOf(SCHEME_SEPARATOR)
  if (schemeAt === -1) return url
  const start = schemeAt + SCHEME_SEPARATOR.length
  const ends = AUTHORITY_END.map((mark) => url.indexOf(mark, start)).filter((index) => index !== -1)
  const end = ends.length > 0 ? Math.min(...ends) : url.length
  const separatorAt = url.slice(start, end).lastIndexOf(USERINFO_END)
  if (separatorAt <= 0 || isTemplate(url.slice(start, start + separatorAt))) return url
  return url.slice(0, start) + MASK + url.slice(start + separatorAt)
}

export function maskedUrl(rawUrl) {
  const url = maskedUserinfo(rawUrl)
  const hashAt = url.indexOf('#')
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt)
  const queryAt = withoutHash.indexOf('?')
  if (queryAt === -1) return withoutHash
  const query = maskedPairs(withoutHash.slice(queryAt + 1)).map(([name, value]) => `${name}=${value}`).join('&')
  return `${withoutHash.slice(0, queryAt)}?${query}`
}

function maskedTree(node) {
  if (Array.isArray(node)) return node.map(maskedTree)
  if (!isPlainObject(node)) return node
  return Object.fromEntries(Object.entries(node).map(([name, value]) => [
    name,
    isSensitiveName(name) && !isTemplate(value) && typeof value !== 'object' ? MASK : maskedTree(value),
  ]))
}

export function shapeOf(node, depth = 0) {
  if (node === null) return 'null'
  if (Array.isArray(node)) {
    return depth >= SHAPE_DEPTH ? 'array' : { array: node.length, of: node.length > 0 ? shapeOf(node[0], depth + 1) : 'unknown' }
  }
  if (isPlainObject(node)) {
    if (depth >= SHAPE_DEPTH) return 'object'
    return Object.fromEntries(Object.keys(node).slice(0, SHAPE_KEYS).map((name) => [name, shapeOf(node[name], depth + 1)]))
  }
  return typeof node
}

function parsedJson(text) {
  const parsed = parseJSON(text, undefined)
  return parsed !== null && typeof parsed === 'object' ? parsed : undefined
}

export function describeBody(request) {
  const body = request.body || ''
  if (request.graphqlQuery) return { graphqlQuery: excerpt(request.graphqlQuery, REQUEST_BODY_BYTES) }
  if (!body.trim()) return ''
  const json = parsedJson(body)
  if (json !== undefined) return excerpt(JSON.stringify(maskedTree(json), null, 2), REQUEST_BODY_BYTES)
  if (request.bodyType === 'form') return maskedPairs(body).map(([name, value]) => `${name}=${value}`).join('&')
  return excerpt(body, REQUEST_BODY_BYTES)
}

export function describeRequest(request) {
  return {
    name: request.name,
    method: request.method,
    url: maskedUrl(request.url),
    headers: maskedRows(request.headers),
    bodyType: request.bodyType,
    body: describeBody(request),
    authType: request.auth?.type || 'none',
    description: request.description || '',
  }
}

function describeResponseBody(response, includeValues) {
  const text = textBody(response)
  const json = parsedJson(text)
  if (!includeValues) {
    return json === undefined ? { notJson: true, bytes: text.length } : { shape: shapeOf(json) }
  }
  if (json !== undefined) return excerpt(JSON.stringify(maskedTree(json), null, 2), BODY_EXCERPT_BYTES)
  return excerpt(text, BODY_EXCERPT_BYTES)
}

const responseHeaders = (response) => (response.headers || []).map(({ key, value }) => ({ key, value: maskedValue(key, value) }))

export function describeResponse(response, includeValues) {
  if (!response) return null
  return {
    status: response.status,
    error: response.error || '',
    durationMs: response.durationMs,
    contentType: response.contentType || '',
    headers: responseHeaders(response),
    body: response.error ? excerpt(response.body || '', BODY_EXCERPT_BYTES) : describeResponseBody(response, includeValues),
  }
}

const AUTH_SECRET_FIELDS = ['password', 'token', 'value']
const OAUTH_SECRET_FIELDS = ['clientSecret', 'accessToken', 'refreshToken', 'password']

const fieldValues = (source, fields) => fields.map((field) => source?.[field]).filter(Boolean)

export function requestSecrets(request) {
  return [...fieldValues(request.auth, AUTH_SECRET_FIELDS), ...fieldValues(request.auth?.oauth2, OAUTH_SECRET_FIELDS)]
}

export function variableSecrets(resolved) {
  return Array.from(resolved)
    .filter(([name, entry]) => entry.secret || isSensitiveName(name))
    .map(([, entry]) => entry.value)
    .filter(Boolean)
}

export const variableNames = (resolved) => Array.from(resolved.keys())
