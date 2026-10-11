import { parseVariableMap, substitutePlaceholders } from './placeholders'

const SOCKET_SCHEME = /^wss?:\/\//i
const SOCKET_PROTOCOLS = ['ws:', 'wss:']
const UPGRADED_PROTOCOLS = { 'http:': 'ws:', 'https:': 'wss:' }

export const isWebSocketURL = (address) => SOCKET_SCHEME.test(address.trim())

export function isSocketAddress(address, variablesJSON) {
  const variables = parseVariableMap(variablesJSON)
  return isWebSocketURL(variables ? substitutePlaceholders(address, variables) : address)
}

export function toSocketURL(address) {
  let url
  try {
    url = new URL(address.trim())
  } catch {
    return null
  }
  const protocol = UPGRADED_PROTOCOLS[url.protocol] || url.protocol
  if (!SOCKET_PROTOCOLS.includes(protocol)) return null
  url.protocol = protocol
  url.hash = ''
  return url.href
}
