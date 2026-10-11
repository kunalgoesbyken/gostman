import { AUTH_OAUTH2, GRANT_CLIENT_CREDENTIALS } from './request'

export const GRANT_PASSWORD = 'password'
export const GRANT_AUTHORIZATION_CODE = 'authorization_code'

export const GRANTS = [
  { value: GRANT_CLIENT_CREDENTIALS, label: 'Client credentials' },
  { value: GRANT_PASSWORD, label: 'Password' },
  { value: GRANT_AUTHORIZATION_CODE, label: 'Authorization code' },
]

const EXPIRY_MARGIN_MS = 30_000
const SIGN_IN_NEEDED = 'This request needs an OAuth 2 token. Open the Auth tab and choose Get token.'

export const callbackUrlFor = (callback, config) => (callback.isFixed ? callback.url : config.callbackUrl || callback.url)

const withCallback = (backend, config) => ({ ...config, callbackUrl: callbackUrlFor(backend.oauthCallback, config) })

export const hasToken = (config) => config.accessToken !== ''

export const isTokenFresh = (config, now = Date.now()) => (
  hasToken(config) && (config.expiresAt === 0 || config.expiresAt - EXPIRY_MARGIN_MS > now)
)

async function exchange(backend, payload) {
  const token = await backend.fetchToken(payload)
  if (token.error) throw new Error(token.error)
  const { accessToken, refreshToken, expiresAt } = token
  return { ...payload.config, accessToken, refreshToken, expiresAt }
}

export async function obtainToken(backend, config, variables, options) {
  const payload = { config: withCallback(backend, config), variables, options }
  if (config.grant !== GRANT_AUTHORIZATION_CODE) return exchange(backend, payload)
  const grant = await backend.authorize(payload.config, variables)
  return exchange(backend, { ...payload, ...grant })
}

async function renewToken(backend, config, variables, options) {
  if (config.refreshToken !== '') {
    try {
      return await exchange(backend, { config, variables, options, refresh: true })
    } catch (error) {
      if (config.grant === GRANT_AUTHORIZATION_CODE) throw error
    }
  }
  if (config.grant === GRANT_AUTHORIZATION_CODE) throw new Error(SIGN_IN_NEEDED)
  return obtainToken(backend, config, variables, options)
}

export async function withFreshToken(backend, request, variables) {
  const { auth, options } = request
  if (auth.type !== AUTH_OAUTH2 || isTokenFresh(auth.oauth2)) return request
  const oauth2 = await renewToken(backend, auth.oauth2, variables, options)
  return { ...request, auth: { ...auth, oauth2 } }
}

export const clearToken = (config) => ({ ...config, accessToken: '', refreshToken: '', expiresAt: 0 })
