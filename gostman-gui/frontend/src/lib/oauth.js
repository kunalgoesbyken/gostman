import { AUTH_OAUTH2, GRANT_CLIENT_CREDENTIALS } from './request'
import { OAUTH_TEXT } from './oauthText'
import { findReferences } from './variables'

export const GRANT_PASSWORD = 'password'
export const GRANT_AUTHORIZATION_CODE = 'authorization_code'
export const GRANT_DEVICE_CODE = 'device_code'

export const GRANTS = [
  { value: GRANT_CLIENT_CREDENTIALS, label: OAUTH_TEXT.grants.clientCredentials },
  { value: GRANT_PASSWORD, label: OAUTH_TEXT.grants.password },
  { value: GRANT_AUTHORIZATION_CODE, label: OAUTH_TEXT.grants.authorizationCode },
  { value: GRANT_DEVICE_CODE, label: OAUTH_TEXT.grants.deviceCode },
]

const EXPIRY_MARGIN_MS = 30_000
const SLOW_DOWN_MS = 5_000
const DEVICE_LIFETIME_MS = 900_000
const SECOND_MS = 1_000

let deviceSignIn = null

export const callbackUrlFor = (callback, config) => (callback.isFixed ? callback.url : config.callbackUrl || callback.url)

const withCallback = (backend, config) => ({ ...config, callbackUrl: callbackUrlFor(backend.oauthCallback, config) })

const needsSignIn = (config) => config.grant === GRANT_AUTHORIZATION_CODE || config.grant === GRANT_DEVICE_CODE

export const sentToken = (config) => (config.sendIdToken ? config.idToken : config.accessToken)

export const hasToken = (config) => config.accessToken !== '' || config.idToken !== ''

export const isOtherEnvironment = (config, environmentId) => hasToken(config) && config.tokenEnvironment !== (environmentId || '')

export const isTokenFresh = (config, now = Date.now()) => (
  sentToken(config) !== '' && (config.expiresAt === 0 || config.expiresAt - EXPIRY_MARGIN_MS > now)
)

export const clearToken = (config) => ({ ...config, accessToken: '', refreshToken: '', idToken: '', expiresAt: 0, tokenEnvironment: '' })

export function withToken(config, token, environmentId) {
  if (token.error) throw new Error(token.error)
  const { accessToken, refreshToken, idToken, expiresAt } = token
  return { ...config, accessToken, refreshToken, idToken, expiresAt, tokenEnvironment: environmentId || '' }
}

const exchange = async (backend, payload, environmentId) => withToken(payload.config, await backend.fetchToken(payload), environmentId)

function pause(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error(OAUTH_TEXT.cancelled))
      return
    }
    const timer = setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error(OAUTH_TEXT.cancelled))
    }, { once: true })
  })
}

async function pollDevice(backend, payload, started, signal) {
  let interval = started.interval * SECOND_MS
  const deadline = started.expiresAt || Date.now() + DEVICE_LIFETIME_MS
  while (Date.now() < deadline) {
    await pause(interval, signal)
    const token = await backend.fetchToken({ ...payload, deviceCode: started.deviceCode })
    if (signal.aborted) throw new Error(OAUTH_TEXT.cancelled)
    if (token.slowDown) interval += SLOW_DOWN_MS
    if (!token.pending) return token
  }
  throw new Error(OAUTH_TEXT.deviceExpired)
}

async function deviceToken(backend, payload, onDevice) {
  const controller = new AbortController()
  deviceSignIn = controller
  try {
    const started = await backend.startDeviceAuthorization(payload)
    if (started.error) throw new Error(started.error)
    if (controller.signal.aborted) throw new Error(OAUTH_TEXT.cancelled)
    onDevice?.({ userCode: started.userCode, verificationUri: started.verificationUriComplete || started.verificationUri })
    return await pollDevice(backend, payload, started, controller.signal)
  } finally {
    if (deviceSignIn === controller) deviceSignIn = null
  }
}

export async function obtainToken(backend, config, variables, options, { environmentId, onDevice } = {}) {
  const payload = { config: withCallback(backend, config), variables, options }
  if (config.grant === GRANT_DEVICE_CODE) return withToken(payload.config, await deviceToken(backend, payload, onDevice), environmentId)
  if (config.grant !== GRANT_AUTHORIZATION_CODE) return exchange(backend, payload, environmentId)
  const grant = await backend.authorize(payload.config, variables)
  return exchange(backend, { ...payload, ...grant }, environmentId)
}

export function cancelSignIn(backend) {
  deviceSignIn?.abort()
  backend.cancelAuthorization()
}

async function renewToken(backend, config, variables, options, environmentId, signInMessage) {
  if (config.refreshToken !== '') {
    try {
      return await exchange(backend, { config, variables, options, refresh: true }, environmentId)
    } catch (error) {
      if (needsSignIn(config)) throw error
    }
  }
  if (needsSignIn(config)) throw new Error(signInMessage)
  return obtainToken(backend, config, variables, options, { environmentId })
}

export async function withFreshToken(backend, request, variables, environmentId) {
  const { auth, options } = request
  if (auth.type !== AUTH_OAUTH2) return request
  const fromOtherEnvironment = isOtherEnvironment(auth.oauth2, environmentId)
  const current = fromOtherEnvironment ? clearToken(auth.oauth2) : auth.oauth2
  if (isTokenFresh(current)) return request
  const signInMessage = fromOtherEnvironment ? OAUTH_TEXT.signInForEnvironment : OAUTH_TEXT.signInNeeded
  const oauth2 = await renewToken(backend, current, variables, options, environmentId, signInMessage)
  return { ...request, auth: { ...auth, oauth2 } }
}

const withoutTrailingSlash = (address) => (address.endsWith('/') ? address.slice(0, -1) : address)

function addressesUnder(typedIssuer, foundIssuer) {
  const typed = withoutTrailingSlash(typedIssuer.trim())
  const found = withoutTrailingSlash(foundIssuer)
  if (findReferences(typed).length === 0) return { issuer: foundIssuer, address: (url) => url }
  return { issuer: typedIssuer.trim(), address: (url) => (url.startsWith(`${found}/`) ? typed + url.slice(found.length) : url) }
}

export async function discoverIssuer(backend, config, variables, options) {
  const found = await backend.discoverIssuer({ issuer: config.issuer, variables, options })
  if (found.error) throw new Error(found.error)
  const { issuer, address } = addressesUnder(config.issuer, found.issuer)
  return {
    ...config,
    issuer,
    tokenUrl: address(found.tokenUrl),
    authUrl: found.authUrl ? address(found.authUrl) : config.authUrl,
    deviceUrl: found.deviceUrl ? address(found.deviceUrl) : config.deviceUrl,
  }
}
