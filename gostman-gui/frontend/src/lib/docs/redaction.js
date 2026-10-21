import { lookup } from '../dataUtils'
import { isSensitiveName } from '../sensitiveNames'

export const REDACTED = '<redacted>'

const PLACEHOLDER = /\{\{[^}]+\}\}/g
const KNOWN_SCHEMES = ['basic', 'bearer', 'digest', 'token']
const COOKIE_SEPARATOR = ';'
const COOKIE_ASSIGNMENT = '='

const isOnlyPlaceholders = (value) => value.replace(PLACEHOLDER, '').trim() === ''

export function maskSecret(value) {
  if (value.trim() === '') return ''
  return isOnlyPlaceholders(value) ? value.trim() : REDACTED
}

function maskAuthorization(value) {
  const [scheme, ...credentials] = value.trim().split(' ')
  const hasScheme = credentials.length > 0 && KNOWN_SCHEMES.includes(scheme.toLowerCase())
  return hasScheme ? `${scheme} ${maskSecret(credentials.join(' '))}` : maskSecret(value)
}

function maskCookiePair(pair) {
  const assignment = pair.indexOf(COOKIE_ASSIGNMENT)
  if (assignment === -1) return maskSecret(pair)
  return `${pair.slice(0, assignment).trim()}${COOKIE_ASSIGNMENT}${maskSecret(pair.slice(assignment + 1))}`
}

const maskCookies = (value) => value.split(COOKIE_SEPARATOR).map(maskCookiePair).filter(Boolean).join(`${COOKIE_SEPARATOR} `)

const HEADER_MASKS = {
  authorization: maskAuthorization,
  'proxy-authorization': maskAuthorization,
  cookie: maskCookies,
}


export function maskHeader(row) {
  const name = row.key.trim()
  const mask = lookup(HEADER_MASKS, name.toLowerCase()) || (isSensitiveName(name) ? maskSecret : null)
  return mask ? { ...row, value: mask(row.value) } : row
}

export const maskParameter = (row) => (isSensitiveName(row.key) ? { ...row, value: maskSecret(row.value) } : row)

export const UNPARSED_BODY = '<redacted: not valid JSON, so it cannot be checked for secrets>'

const isSensitiveKey = (key) => key !== undefined && isSensitiveName(key)

export function maskJsonNode(node, key) {
  if (isSensitiveKey(key) && node !== null && typeof node === 'object') return REDACTED
  if (Array.isArray(node)) return node.map((item) => maskJsonNode(item, key))
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([name, value]) => [name, maskJsonNode(value, name)]))
  }
  const isLeaf = typeof node === 'string' || typeof node === 'number'
  return isLeaf && isSensitiveKey(key) ? maskSecret(String(node)) : node
}

export function maskJsonText(text) {
  try {
    return JSON.stringify(maskJsonNode(JSON.parse(text)), null, 2)
  } catch {
    return isSensitiveName(text) ? UNPARSED_BODY : text
  }
}

const SCHEME_END = '://'
const PATH_START = '/'
const USERINFO_END = '@'
const QUERY_START = '?'
const FRAGMENT_START = '#'
const PAIR_SEPARATOR = '&'
const ALTERNATE_SEPARATOR = ';'
const PAIR_ASSIGNMENT = '='

const cutAt = (text, mark) => {
  const at = text.indexOf(mark)
  return at === -1 ? [text, ''] : [text.slice(0, at), text.slice(at)]
}

function decoded(text) {
  try {
    return decodeURIComponent(text.replaceAll('+', ' '))
  } catch {
    return text
  }
}

function maskQueryPair(pair) {
  const at = pair.indexOf(PAIR_ASSIGNMENT)
  if (at === -1 || !isSensitiveName(decoded(pair.slice(0, at)))) return pair
  return `${pair.slice(0, at)}${PAIR_ASSIGNMENT}${maskSecret(pair.slice(at + 1))}`
}

const maskPairs = (text, separator) => text.split(separator).map(maskQueryPair).join(separator)

const maskQuery = (query) => (
  query === '' ? '' : `${QUERY_START}${maskPairs(maskPairs(query.slice(1), ALTERNATE_SEPARATOR), PAIR_SEPARATOR)}`
)

function maskUserinfo(base) {
  const schemeAt = base.indexOf(SCHEME_END)
  if (schemeAt === -1) return base
  const start = schemeAt + SCHEME_END.length
  const [authority, path] = cutAt(base.slice(start), PATH_START)
  const at = authority.lastIndexOf(USERINFO_END)
  if (at === -1) return base
  return `${base.slice(0, start)}${REDACTED}${authority.slice(at)}${path}`
}

export function maskUrl(url) {
  const [head, fragment] = cutAt(url, FRAGMENT_START)
  const [base, query] = cutAt(head, QUERY_START)
  return `${maskUserinfo(base)}${maskQuery(query)}${fragment}`
}
