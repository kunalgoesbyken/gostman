import { createStoredState } from './storage'

const STORAGE_KEY = 'gostman.relay'
const WEB_PROTOCOLS = ['http:', 'https:']

export const RELAY_HOSTED = 'hosted'
export const RELAY_LOCAL = 'local'
export const RELAY_MODES = [RELAY_HOSTED, RELAY_LOCAL]

export class RelayUnreachableError extends Error {
  constructor(origin, message) {
    super(message)
    this.name = 'RelayUnreachableError'
    this.origin = origin
  }
}

export function relayOrigin(address) {
  try {
    const parsed = new URL(address.trim())
    return WEB_PROTOCOLS.includes(parsed.protocol) && parsed.hostname ? parsed.origin : ''
  } catch {
    return ''
  }
}

export const useRelayStore = createStoredState(STORAGE_KEY, (source) => ({
  mode: RELAY_MODES.includes(source.mode) ? source.mode : RELAY_HOSTED,
  address: typeof source.address === 'string' ? source.address : '',
}))

export const updateRelay = (patch) => useRelayStore.getState().update(patch)

export function currentRelay() {
  const { mode, address } = useRelayStore.getState()
  const isLocal = mode === RELAY_LOCAL
  return { isLocal, origin: isLocal ? relayOrigin(address) : '' }
}
