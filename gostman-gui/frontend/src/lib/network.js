const PROXY_SYSTEM = 'system'
const PROXY_NONE = 'none'
export const PROXY_CUSTOM = 'custom'

export const PROXY_MODES = [
  { value: PROXY_SYSTEM, label: 'Use the system proxy' },
  { value: PROXY_NONE, label: 'No proxy' },
  { value: PROXY_CUSTOM, label: 'Custom proxy' },
]

export const BLANK_CERTIFICATE = { host: '', certFile: '', keyFile: '' }

export const DEFAULT_SETTINGS = { proxyMode: PROXY_SYSTEM, proxyUrl: '', proxyBypass: '', certificates: [], caFile: '' }

const asText = (value) => (typeof value === 'string' ? value : '')

const toCertificate = (raw) => ({ host: asText(raw?.host), certFile: asText(raw?.certFile), keyFile: asText(raw?.keyFile) })

export function normalizeSettings(raw) {
  return {
    proxyMode: PROXY_MODES.some((mode) => mode.value === raw?.proxyMode) ? raw.proxyMode : PROXY_SYSTEM,
    proxyUrl: asText(raw?.proxyUrl),
    proxyBypass: asText(raw?.proxyBypass),
    certificates: Array.isArray(raw?.certificates) ? raw.certificates.map(toCertificate) : [],
    caFile: asText(raw?.caFile),
  }
}
