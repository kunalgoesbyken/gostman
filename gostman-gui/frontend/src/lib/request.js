import { resolveBodyType } from './body'
import { foldQueryParams } from './queryString'

export const AUTH_OAUTH2 = 'oauth2'
export const GRANT_CLIENT_CREDENTIALS = 'client_credentials'

const DEFAULT_OAUTH2 = {
  grant: GRANT_CLIENT_CREDENTIALS,
  authUrl: '',
  tokenUrl: '',
  clientId: '',
  clientSecret: '',
  scope: '',
  username: '',
  password: '',
  callbackUrl: '',
  credentialsIn: '',
  pkce: true,
  headerPrefix: '',
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
}

const DEFAULT_AUTH = { type: '', username: '', password: '', token: '', key: '', value: '', in: '', oauth2: DEFAULT_OAUTH2 }

const DEFAULT_OPTIONS = {
  timeoutMs: 0,
  noFollowRedirects: false,
  insecureTLS: false,
  stream: false,
  streamReconnect: false,
  streamMaxEvents: 0,
  streamMaxSeconds: 0,
}

const DEFAULT_REQUEST = {
  id: '',
  name: 'New Request',
  description: '',
  method: 'GET',
  url: '',
  headers: '{}',
  body: '',
  bodyType: '',
  queryParams: '{}',
  folderId: '',
  graphqlQuery: '',
  graphqlVariables: '{}',
  auth: DEFAULT_AUTH,
  options: DEFAULT_OPTIONS,
  extractors: '',
  assertions: '',
  examples: '',
  preScript: '',
  postScript: '',
  grpcMethod: '',
  grpcMessage: '',
  grpcProtos: '',
  mcpTool: '',
  mcpArguments: '',
  socketProtocol: '',
  socketMessages: '',
  vars: '{}',
  timestamp: '',
  sortOrder: 0,
}

export const normalizeAuth = (raw) => ({ ...DEFAULT_AUTH, ...raw, oauth2: { ...DEFAULT_OAUTH2, ...raw?.oauth2 } })

export function normalizeRequest(raw) {
  const source = raw || {}
  const request = {}
  for (const [field, fallback] of Object.entries(DEFAULT_REQUEST)) {
    request[field] = source[field] || fallback
  }
  request.auth = normalizeAuth(source.auth)
  request.options = { ...DEFAULT_OPTIONS, ...source.options }
  request.bodyType = resolveBodyType(request.bodyType, request.body)
  return { ...request, ...foldQueryParams(request.url, request.queryParams) }
}

export function toEngineRequest(request, variables, cookies = []) {
  const { inherited = [] } = request
  const { method, url, headers, queryParams, body, bodyType, graphqlQuery, graphqlVariables, auth, options } = normalizeRequest(request)
  return { method, url, headers, queryParams, body, bodyType, graphqlQuery, graphqlVariables, auth, options, variables, cookies, inherited }
}
