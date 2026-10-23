import { parseVariableMap, substitutePlaceholders } from '../placeholders'

const SCHEME_SEPARATOR = '://'
const AUTHORITY_END = ['/', '?', '#']
const LOOPBACK_NAMES = ['localhost', '::1']
const LOOPBACK_FIRST_OCTET = '127'
const IPV4_PARTS = 4
const OCTET_MAX = 255
const OCTET_DIGITS = /^\d{1,3}$/
const UNRESOLVED = '{'
const QUERY_START = '?'
const FRAGMENT_START = '#'
const PATH_END = [QUERY_START, FRAGMENT_START]
const ROOT_PATH = '/'
const SECURE_SCHEMES = ['https', 'wss']

const firstIndexOf = (text, marks) => Math.min(text.length, ...marks.map((mark) => text.indexOf(mark)).filter((index) => index >= 0))

function splitAddress(address) {
  const text = address.trim()
  const schemeEnd = text.indexOf(SCHEME_SEPARATOR)
  const scheme = schemeEnd >= 0 ? text.slice(0, schemeEnd).toLowerCase() : ''
  const rest = schemeEnd >= 0 ? text.slice(schemeEnd + SCHEME_SEPARATOR.length) : text
  const authorityEnd = firstIndexOf(rest, AUTHORITY_END)
  return { scheme, authority: rest.slice(0, authorityEnd), tail: rest.slice(authorityEnd) }
}

function authorityOf(address) {
  const { authority } = splitAddress(address)
  return authority.slice(authority.lastIndexOf('@') + 1)
}

const BACKSLASH = '\\'
const FIRST_PRINTABLE = 0x21
const hasAmbiguousCharacters = (address) => (
  address.trim().split('').some((character) => character === BACKSLASH || character.charCodeAt(0) < FIRST_PRINTABLE)
)

export function hostOf(address) {
  if (hasAmbiguousCharacters(address)) return ''
  const authority = authorityOf(address)
  const host = authority.startsWith('[') ? authority.slice(1, authority.indexOf(']')) : authority.split(':')[0]
  return host.toLowerCase()
}

export function addressParts(address) {
  const { scheme, tail } = splitAddress(address)
  const pathEnd = firstIndexOf(tail, PATH_END)
  const rest = tail.slice(pathEnd)
  const query = rest.startsWith(QUERY_START) ? rest.slice(1, firstIndexOf(rest, [FRAGMENT_START])) : ''
  return { secure: SECURE_SCHEMES.includes(scheme), host: hostOf(address), path: tail.slice(0, pathEnd) || ROOT_PATH, query }
}

const isOctet = (part) => OCTET_DIGITS.test(part) && Number(part) <= OCTET_MAX

const isLoopbackAddress = (host) => {
  const parts = host.split('.')
  return parts.length === IPV4_PARTS && parts[0] === LOOPBACK_FIRST_OCTET && parts.every(isOctet)
}

export const isLoopbackHost = (host) => LOOPBACK_NAMES.includes(host) || isLoopbackAddress(host)

export function addressHost(address, variablesJSON) {
  const variables = parseVariableMap(variablesJSON)
  return hostOf(variables ? substitutePlaceholders(address, variables) : address)
}

const addressesOf = (request) => [request.url, request.auth?.oauth2?.tokenUrl, request.auth?.oauth2?.authUrl].filter(Boolean)

export function collectionHostsBy(requests, variablesFor) {
  const hosts = requests.flatMap((request) => addressesOf(request).map((address) => addressHost(address, variablesFor(request))))
  return [...new Set(hosts.filter((host) => host !== '' && !host.includes(UNRESOLVED)))]
}

export const collectionHosts = (requests, variablesJSON) => collectionHostsBy(requests, () => variablesJSON)

export const isPermittedHost = (host, hosts) => isLoopbackHost(host) || hosts.includes(host.toLowerCase())
