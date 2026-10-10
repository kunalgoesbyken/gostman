const DEFAULT_AUTH = { type: '', username: '', password: '', token: '', key: '', value: '', in: '' }

const DEFAULT_OPTIONS = { timeoutMs: 0, noFollowRedirects: false, insecureTLS: false }

const DEFAULT_REQUEST = {
  id: '',
  name: 'New Request',
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
  timestamp: '',
}

export function normalizeRequest(raw) {
  const source = raw || {}
  const request = {}
  for (const [field, fallback] of Object.entries(DEFAULT_REQUEST)) {
    request[field] = source[field] || fallback
  }
  request.auth = { ...DEFAULT_AUTH, ...source.auth }
  request.options = { ...DEFAULT_OPTIONS, ...source.options }
  return request
}

export function toEngineRequest(request, variables) {
  const { method, url, headers, queryParams, body, bodyType, graphqlQuery, graphqlVariables, auth, options } = normalizeRequest(request)
  return { method, url, headers, queryParams, body, bodyType, graphqlQuery, graphqlVariables, auth, options, variables }
}
