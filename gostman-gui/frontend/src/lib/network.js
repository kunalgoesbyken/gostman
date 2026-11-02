import { NETWORK_TEXT } from './networkText'

const PROXY_SYSTEM = 'system'
export const PROXY_NONE = 'none'
export const PROXY_CUSTOM = 'custom'

const proxyMode = (value, name) => ({
  value,
  get label() {
    return NETWORK_TEXT.proxyModes[name]
  },
})

export const PROXY_MODES = [
  proxyMode(PROXY_SYSTEM, 'system'),
  proxyMode(PROXY_NONE, 'none'),
  proxyMode(PROXY_CUSTOM, 'custom'),
]

export const IP_FAMILIES = [
  { value: '', get label() { return NETWORK_TEXT.ipFamilies.auto } },
  { value: '4', get label() { return NETWORK_TEXT.ipFamilies.v4 } },
  { value: '6', get label() { return NETWORK_TEXT.ipFamilies.v6 } },
]

export const BLANK_CERTIFICATE = { host: '', certFile: '', keyFile: '', passphrase: '', passphraseSaved: false }

export const DEFAULT_SETTINGS = { proxyMode: PROXY_SYSTEM, proxyUrl: '', proxyBypass: '', certificates: [], caFile: '', resolve: [], ipFamily: '' }

const asText = (value) => (typeof value === 'string' ? value : '')

const toCertificate = (raw) => ({
  host: asText(raw?.host),
  certFile: asText(raw?.certFile),
  keyFile: asText(raw?.keyFile),
  passphrase: '',
  passphraseSaved: raw?.passphraseSaved === true,
})

export function normalizeSettings(raw) {
  return {
    proxyMode: PROXY_MODES.some((mode) => mode.value === raw?.proxyMode) ? raw.proxyMode : PROXY_SYSTEM,
    proxyUrl: asText(raw?.proxyUrl),
    proxyBypass: asText(raw?.proxyBypass),
    certificates: Array.isArray(raw?.certificates) ? raw.certificates.map(toCertificate) : [],
    caFile: asText(raw?.caFile),
    resolve: Array.isArray(raw?.resolve) ? raw.resolve.filter((line) => typeof line === 'string') : [],
    ipFamily: IP_FAMILIES.some((family) => family.value === raw?.ipFamily) ? raw.ipFamily : '',
  }
}

const savedCertificate = (certificate) => ({ ...certificate, passphrase: '', passphraseSaved: certificate.passphraseSaved || certificate.passphrase !== '' })

export const withoutPassphrases = (settings) => ({ ...settings, certificates: settings.certificates.map(savedCertificate) })

export const hasCollectionNetwork = (status) => Boolean(status && (status.proxy || status.noProxy || status.ca || status.resolve?.length || status.ipVersion || status.certificates?.length || status.error))
