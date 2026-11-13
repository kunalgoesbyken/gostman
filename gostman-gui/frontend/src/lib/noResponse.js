export const REASON_UNKNOWN = 'unknown'
export const REASON_TIMEOUT = 'timeout'
export const REASON_CONNECTION = 'connection'
export const REASON_DNS = 'dns'
export const REASON_TLS = 'tls'
export const REASON_CANCELLED = 'cancelled'
export const REASON_BLOCKED = 'blocked'
export const REASON_OTHER = 'other'
export const REASONS = [REASON_TIMEOUT, REASON_CONNECTION, REASON_DNS, REASON_TLS, REASON_CANCELLED, REASON_BLOCKED, REASON_OTHER]
export const REASON_NAMES = [...REASONS, REASON_UNKNOWN]
export const ALL_REASONS = new Set(REASON_NAMES)

const NETWORK_NAMESPACE = 'engineMessages.network.'

const BY_ERROR = new Map([
  ['timeout', REASON_TIMEOUT],
  ['cancelled', REASON_CANCELLED],
  ['blocked', REASON_BLOCKED],
])

const BY_NETWORK_MESSAGE = new Map([
  ['hostNotFound', REASON_DNS],
  ['untrustedAuthority', REASON_TLS],
  ['handshakeCertificate', REASON_TLS],
  ['handshake', REASON_TLS],
  ['hostMismatch', REASON_TLS],
  ['certificateExpired', REASON_TLS],
  ['proxyConnect', REASON_CONNECTION],
  ['proxyConnectSettings', REASON_CONNECTION],
  ['dial', REASON_CONNECTION],
  ['dialServer', REASON_CONNECTION],
].map(([key, reason]) => [NETWORK_NAMESPACE + key, reason]))

export function noResponseReason(response) {
  return BY_ERROR.get(response?.error) ?? BY_NETWORK_MESSAGE.get(response?.localized?.code) ?? REASON_OTHER
}
