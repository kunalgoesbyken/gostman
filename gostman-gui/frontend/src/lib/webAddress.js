const WEB_PROTOCOLS = ['http:', 'https:']

export function isWebAddress(text) {
  try {
    return WEB_PROTOCOLS.includes(new URL(text).protocol)
  } catch {
    return false
  }
}
