import { BODY_BINARY, BODY_FORM, BODY_JSON, BODY_MULTIPART, BODY_NONE, BODY_TEXT, BODY_XML } from '../body'
import { isPlainObject, lookup, parseJSON } from '../dataUtils'
import { GRPC_METHOD } from '../grpc'
import { placeholderNames } from '../placeholders'
import { readParamRows } from '../queryString'
import { AUTH_OAUTH2, normalizeRequest } from '../request'
import { isFileRow, isSentRow, parseRows } from '../rows'
import { isWebSocketURL } from '../socketUrl'
import { CURL_FILE, CURL_FORM, CURL_MULTIPART, CURL_RAW, curlCommand } from './curl'
import { REDACTED, maskHeader, maskJsonNode, maskJsonText, maskParameter, maskSecret, maskUrl } from './redaction'

export const PROTOCOL_HTTP = 'http'
export const PROTOCOL_GRAPHQL = 'graphql'
export const PROTOCOL_GRPC = 'grpc'
export const PROTOCOL_SOCKET = 'socket'

export const AUTH_BASIC = 'basic'
export const AUTH_BEARER = 'bearer'
export const AUTH_API_KEY = 'apikey'

const GRAPHQL_METHOD = 'GRAPHQL'
const POST = 'POST'
const IN_QUERY = 'query'
const AUTHORIZATION = 'Authorization'
const CONTENT_TYPE = 'Content-Type'
const BEARER_PREFIX = 'Bearer'
const ACCESS_TOKEN = '<access token>'
const JSON_CONTENT = 'application/json'
const UNTITLED_REQUEST = 'Untitled request'
const OBJECT_FIELDS = ['auth', 'options']
const NO_AUTH = { headers: [], query: [], user: '' }

const CONTENT_TYPES = {
  [BODY_JSON]: JSON_CONTENT,
  [BODY_TEXT]: 'text/plain',
  [BODY_XML]: 'application/xml',
}

const VARIABLE_FIELDS = ['url', 'headers', 'queryParams', 'body', 'graphqlQuery', 'graphqlVariables', 'grpcMessage']
const AUTH_VARIABLE_FIELDS = ['username', 'password', 'token', 'key', 'value']
const OAUTH_VARIABLE_FIELDS = ['authUrl', 'tokenUrl', 'clientId', 'clientSecret', 'scope', 'username', 'password']

export const textOf = (value) => (typeof value === 'string' ? value : '')

const isReadable = ([field, value]) => (
  typeof value === 'string' || (OBJECT_FIELDS.includes(field) && isPlainObject(value))
)

export function readRequest(raw) {
  const request = normalizeRequest(Object.fromEntries(Object.entries(raw).filter(isReadable)))
  return { ...request, name: request.name.trim() || UNTITLED_REQUEST }
}

export function protocolOf(request) {
  if (request.method === GRPC_METHOD) return PROTOCOL_GRPC
  if (isWebSocketURL(request.url)) return PROTOCOL_SOCKET
  return request.method === GRAPHQL_METHOD ? PROTOCOL_GRAPHQL : PROTOCOL_HTTP
}

const credential = (value) => maskSecret(textOf(value)) || REDACTED

const AUTH_PARTS = {
  [AUTH_BASIC]: (auth) => ({ ...NO_AUTH, user: `${credential(auth.username)}:${credential(auth.password)}` }),
  [AUTH_BEARER]: (auth) => ({ ...NO_AUTH, headers: [{ key: AUTHORIZATION, value: `${BEARER_PREFIX} ${credential(auth.token)}` }] }),
  [AUTH_API_KEY]: (auth) => {
    const entry = { key: textOf(auth.key), value: credential(auth.value) }
    if (entry.key.trim() === '') return NO_AUTH
    return auth.in === IN_QUERY ? { ...NO_AUTH, query: [entry] } : { ...NO_AUTH, headers: [entry] }
  },
  [AUTH_OAUTH2]: (auth) => ({
    ...NO_AUTH,
    headers: [{ key: AUTHORIZATION, value: `${textOf(auth.oauth2?.headerPrefix).trim() || BEARER_PREFIX} ${ACCESS_TOKEN}` }],
  }),
}

function authParts(auth) {
  const describe = lookup(AUTH_PARTS, auth.type)
  return describe ? describe(auth) : NO_AUTH
}

export const sentHeaders = (request) => parseRows(request.headers).filter(isSentRow).map(maskHeader)

export function sentParams(request) {
  const rows = readParamRows(request.url, request.queryParams).filter(isSentRow)
  return [...rows.map(maskParameter), ...authParts(request.auth).query]
}

export const sentFields = (request) => parseRows(request.body).filter(isSentRow).map((row) => (isFileRow(row) ? row : maskParameter(row)))

export const fileNameOf = (request) => textOf(parseJSON(request.body, {})?.fileName)

export const fieldValue = (row) => (isFileRow(row) ? textOf(row.fileName) : row.value)

const hasHeader = (headers, name) => headers.some((header) => header.key.trim().toLowerCase() === name.toLowerCase())

const withMissing = (headers, additions) => [
  ...headers,
  ...additions.filter((addition) => !hasHeader(headers, addition.key)),
]

const curlField = (row) => (isFileRow(row) ? { key: row.key, fileName: textOf(row.fileName) } : { key: row.key, value: row.value })

const CURL_BODIES = {
  [BODY_NONE]: () => null,
  [BODY_FORM]: (request) => ({ kind: CURL_FORM, fields: sentFields(request).map(curlField) }),
  [BODY_MULTIPART]: (request) => ({ kind: CURL_MULTIPART, fields: sentFields(request).map(curlField) }),
  [BODY_BINARY]: (request) => (fileNameOf(request) ? { kind: CURL_FILE, fileName: fileNameOf(request) } : null),
}

function rawBody(request) {
  return request.body.trim() === '' ? null : { kind: CURL_RAW, text: request.bodyType === BODY_JSON ? maskJsonText(request.body) : request.body }
}

function curlBody(request) {
  const build = lookup(CURL_BODIES, request.bodyType)
  return build ? build(request) : rawBody(request)
}

export function graphqlPayload(request) {
  const variables = parseJSON(request.graphqlVariables, {})
  return JSON.stringify({ query: request.graphqlQuery, variables: isPlainObject(variables) ? maskJsonNode(variables) : {} }, null, 2)
}

function withQuery(url, entries) {
  if (entries.length === 0) return url
  const query = entries.map(({ key, value }) => `${key}=${value}`).join('&')
  return `${url}${url.includes('?') ? '&' : '?'}${query}`
}

const contentHeader = (value) => (value ? [{ key: CONTENT_TYPE, value }] : [])

function curlParts(request, method, body, contentType) {
  const auth = authParts(request.auth)
  return {
    method,
    url: withQuery(maskUrl(request.url), auth.query),
    user: auth.user,
    headers: withMissing(sentHeaders(request), [...auth.headers, ...contentHeader(body ? contentType : '')]),
    body,
  }
}

const CURL_BUILDERS = {
  [PROTOCOL_HTTP]: (request) => {
    const body = curlBody(request)
    return curlParts(request, request.method, body, body?.kind === CURL_RAW ? lookup(CONTENT_TYPES, request.bodyType) : '')
  },
  [PROTOCOL_GRAPHQL]: (request) => (
    curlParts(request, POST, { kind: CURL_RAW, text: graphqlPayload(request) }, JSON_CONTENT)
  ),
}

export function curlExample(request) {
  const build = lookup(CURL_BUILDERS, protocolOf(request))
  return build ? curlCommand(build(request)) : ''
}

function variableSources(request) {
  const { auth } = request
  return [
    ...VARIABLE_FIELDS.map((field) => request[field]),
    ...AUTH_VARIABLE_FIELDS.map((field) => textOf(auth[field])),
    ...OAUTH_VARIABLE_FIELDS.map((field) => textOf(auth.oauth2?.[field])),
  ]
}

export function variablesUsed(requests) {
  const names = requests.flatMap(variableSources).flatMap(placeholderNames).filter(Boolean)
  return Array.from(new Set(names)).sort()
}
