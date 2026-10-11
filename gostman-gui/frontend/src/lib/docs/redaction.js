import { lookup } from '../dataUtils'

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
  'x-api-key': maskSecret,
  'x-auth-token': maskSecret,
}

export function maskHeader(row) {
  const mask = lookup(HEADER_MASKS, row.key.trim().toLowerCase())
  return mask ? { ...row, value: mask(row.value) } : row
}
