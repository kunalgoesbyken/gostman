import { HTTP_METHODS } from './constants'

const DEFAULT_TOKENS = {
  GET: 'success',
  HEAD: 'success',
  OPTIONS: 'success',
  POST: 'warning',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'destructive',
  GRAPHQL: 'primary',
  GRPC: 'info',
  MCP: 'info',
  WS: 'info',
}

export const STYLED_METHODS = HTTP_METHODS.filter((method) => Object.hasOwn(DEFAULT_TOKENS, method))

export const hasMethodTone = (method) => Object.hasOwn(DEFAULT_TOKENS, method)

export const methodToken = (method) => `--method-${method.toLowerCase()}`

export const methodBackgroundToken = (method) => `${methodToken(method)}-bg`

export const defaultMethodToken = (method) => DEFAULT_TOKENS[method]

export const methodStyle = (method) => (
  hasMethodTone(method)
    ? { color: `hsl(var(${methodToken(method)}, var(--${DEFAULT_TOKENS[method]})))`, backgroundColor: `var(${methodBackgroundToken(method)}, transparent)` }
    : undefined
)

export const hasMethodBackground = (methodColors, mode, method) => Boolean(methodColors[mode][method]?.background)
