import { AUTH_TEXT } from './authText'
import { SCHEMES } from './authSchemes'
import { AUTH_OAUTH2 } from './request'

export const AUTH_NONE = ''
export const AUTH_BASIC = 'basic'
export const AUTH_BEARER = 'bearer'
export const AUTH_API_KEY = 'apikey'

export const AUTH_METHODS = [
  { value: AUTH_BASIC, label: 'Basic' },
  { value: AUTH_BEARER, get label() { return AUTH_TEXT.methods.bearer } },
  { value: AUTH_API_KEY, get label() { return AUTH_TEXT.methods.apiKey } },
  { value: AUTH_OAUTH2, label: 'OAuth 2.0' },
  ...Object.entries(SCHEMES).map(([value, scheme]) => ({ value, label: scheme.label })),
]
