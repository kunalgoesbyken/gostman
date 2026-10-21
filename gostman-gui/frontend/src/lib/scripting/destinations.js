import { parseVariableMap, substitutePlaceholders } from '../placeholders'

const SCHEME_SEPARATOR = '://'
const AUTHORITY_END = ['/', '?', '#']
const LOOPBACK_NAMES = ['localhost', '::1']
const LOOPBACK_PREFIX = '127.'
const UNRESOLVED = '{'

function authorityOf(address) {
  const text = address.trim()
  const rest = text.includes(SCHEME_SEPARATOR) ? text.slice(text.indexOf(SCHEME_SEPARATOR) + SCHEME_SEPARATOR.length) : text
  const ends = AUTHORITY_END.map((mark) => rest.indexOf(mark)).filter((index) => index >= 0)
  const authority = ends.length > 0 ? rest.slice(0, Math.min(...ends)) : rest
  return authority.slice(authority.lastIndexOf('@') + 1)
}

const BACKSLASH = '\\'
const FIRST_PRINTABLE = 0x21
const hasAmbiguousCharacters = (address) => (
  Array.from(address.trim()).some((character) => character === BACKSLASH || character.charCodeAt(0) < FIRST_PRINTABLE)
)

export function hostOf(address) {
  if (hasAmbiguousCharacters(address)) return ''
  const authority = authorityOf(address)
  const host = authority.startsWith('[') ? authority.slice(1, authority.indexOf(']')) : authority.split(':')[0]
  return host.toLowerCase()
}

export const isLoopbackHost = (host) => LOOPBACK_NAMES.includes(host) || host.startsWith(LOOPBACK_PREFIX)

export function addressHost(address, variablesJSON) {
  const variables = parseVariableMap(variablesJSON)
  return hostOf(variables ? substitutePlaceholders(address, variables) : address)
}

const addressesOf = (request) => [request.url, request.auth?.oauth2?.tokenUrl, request.auth?.oauth2?.authUrl].filter(Boolean)

export function collectionHosts(requests, variablesJSON) {
  const hosts = requests.flatMap(addressesOf).map((address) => addressHost(address, variablesJSON))
  return [...new Set(hosts.filter((host) => host !== '' && !host.includes(UNRESOLVED)))]
}

export const isPermittedHost = (host, hosts) => isLoopbackHost(host) || hosts.includes(host.toLowerCase())
