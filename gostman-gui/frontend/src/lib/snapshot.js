import { SNAPSHOT_TEXT } from './checksText'
import { isPlainObject, parseJSON } from './dataUtils'
import { queryPointers } from './jsonPath'
import { isSensitiveName } from './sensitiveNames'

export const SNAPSHOT_OPERATOR = 'snapshot'

const IGNORED = '(ignored)'
const MAX_LINES = 20
const MAX_VALUE_CHARS = 80
const ROOT = '$'
const VOLATILE_HEADERS = ['date', 'etag', 'last-modified', 'age', 'expires', 'content-length', 'x-request-id', 'x-correlation-id', 'x-trace-id', 'server-timing', 'cf-ray']
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const unescapeToken = (token) => token.split('~1').join('/').split('~0').join('~')

const pointerTokens = (pointer) => (pointer === '' ? [] : pointer.slice(1).split('/').map(unescapeToken))

function replaceAt(root, tokens, replacement) {
  if (tokens.length === 0) return replacement
  const holder = tokens.slice(0, -1).reduce((node, token) => (node === undefined || node === null ? undefined : node[token]), root)
  const last = tokens[tokens.length - 1]
  if (holder !== null && typeof holder === 'object' && !BLOCKED_KEYS.has(last) && Object.hasOwn(holder, last)) holder[last] = replacement
  return root
}

function withoutIgnored(value, paths) {
  let copy = JSON.parse(JSON.stringify(value === undefined ? null : value))
  for (const path of paths) {
    for (const pointer of queryPointers(path, copy)) copy = replaceAt(copy, pointerTokens(pointer), IGNORED)
  }
  return copy
}

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function orderless(value) {
  if (Array.isArray(value)) return value.map(orderless).sort((first, second) => canonical(first).localeCompare(canonical(second)))
  if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, orderless(item)]))
  return value
}

const shown = (value) => {
  const text = value === undefined ? 'undefined' : JSON.stringify(value)
  return text.length > MAX_VALUE_CHARS ? `${text.slice(0, MAX_VALUE_CHARS)}…` : text
}

const childPath = (path, key) => (IDENTIFIER.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`)

function differences(expected, actual, path, found) {
  if (found.length > MAX_LINES * 4) return
  if (Array.isArray(expected) && Array.isArray(actual)) {
    for (let index = 0; index < Math.max(expected.length, actual.length); index += 1) {
      const place = `${path}[${index}]`
      if (index >= actual.length) found.push(SNAPSHOT_TEXT.missing({ path: place, expected: shown(expected[index]) }))
      else if (index >= expected.length) found.push(SNAPSHOT_TEXT.extra({ path: place, actual: shown(actual[index]) }))
      else differences(expected[index], actual[index], place, found)
    }
    return
  }
  if (isPlainObject(expected) && isPlainObject(actual)) {
    for (const key of Object.keys(expected)) {
      if (!Object.hasOwn(actual, key)) found.push(SNAPSHOT_TEXT.missing({ path: childPath(path, key), expected: shown(expected[key]) }))
      else differences(expected[key], actual[key], childPath(path, key), found)
    }
    for (const key of Object.keys(actual)) {
      if (!Object.hasOwn(expected, key)) found.push(SNAPSHOT_TEXT.extra({ path: childPath(path, key), actual: shown(actual[key]) }))
    }
    return
  }
  if (canonical(expected) !== canonical(actual)) found.push(SNAPSHOT_TEXT.changed({ path, expected: shown(expected), actual: shown(actual) }))
}

const comparable = (value) => {
  if (typeof value !== 'string') return value
  const parsed = parseJSON(value, undefined)
  return parsed !== null && typeof parsed === 'object' ? parsed : value
}

export function snapshotMismatches(actual, document) {
  if (!isPlainObject(document) || !Object.hasOwn(document, 'expected')) return SNAPSHOT_TEXT.invalid
  const ignore = Array.isArray(document.ignore) ? document.ignore.map(String) : []
  const prepare = (value) => {
    const cleaned = withoutIgnored(comparable(value), ignore)
    return document.ignoreOrder === true ? orderless(cleaned) : cleaned
  }
  const found = []
  differences(prepare(document.expected), prepare(actual), ROOT, found)
  if (found.length === 0) return ''
  const lines = found.slice(0, MAX_LINES)
  if (found.length > MAX_LINES) lines.push(SNAPSHOT_TEXT.more(found.length - MAX_LINES))
  return lines.join('\n')
}

export function snapshotValue(expected, { ignore = [], ignoreOrder = false } = {}) {
  return JSON.stringify({ expected, ignore, ignoreOrder })
}

const VOLATILE_VALUE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$)/i

function keepSafe(value, path, ignore) {
  if (Array.isArray(value)) return value.map((item, index) => keepSafe(item, `${path}[${index}]`, ignore))
  if (typeof value === 'string' && VOLATILE_VALUE.test(value)) {
    ignore.push(path)
    return IGNORED
  }
  if (!isPlainObject(value)) return value
  const kept = {}
  for (const [key, item] of Object.entries(value)) {
    const place = childPath(path, key)
    if (isSensitiveName(key) && (item === null || typeof item !== 'object')) {
      ignore.push(place)
      kept[key] = IGNORED
    } else {
      kept[key] = keepSafe(item, place, ignore)
    }
  }
  return kept
}

export function bodySnapshot(body) {
  const ignore = []
  const expected = keepSafe(body, ROOT, ignore)
  return snapshotValue(expected, { ignore })
}

export function headersSnapshot(headers) {
  const expected = {}
  const ignore = []
  for (const [name, value] of Object.entries(headers)) {
    if (isSensitiveName(name)) continue
    expected[name] = value
    if (VOLATILE_HEADERS.includes(name.toLowerCase())) ignore.push(childPath(ROOT, name))
  }
  return snapshotValue(expected, { ignore })
}

export function refreshedSnapshot(actual, current) {
  const document = parseJSON(current, {})
  const ignore = Array.isArray(document.ignore) ? document.ignore.map(String) : []
  const found = []
  const expected = keepSafe(comparable(actual), ROOT, found)
  return snapshotValue(expected, { ignore: [...new Set([...ignore, ...found])], ignoreOrder: document.ignoreOrder === true })
}
