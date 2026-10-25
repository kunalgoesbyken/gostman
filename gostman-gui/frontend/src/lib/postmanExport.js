import { BODY_BINARY, BODY_FORM, BODY_MULTIPART, BODY_NONE } from './body'
import { buildCollectionTree, foldersIn, requestsIn, ROOT_ID, ROW_FOLDER, siblingsIn } from './collectionTree'
import { isPlainObject, lookup, parseJSON } from './dataUtils'
import { exampleLabel, isBinaryExample, parseExamples } from './examples'
import { AUTH_API_KEY, AUTH_BASIC, AUTH_BEARER, AUTH_IN_HEADER, AUTH_IN_QUERY, GRAPHQL_METHOD, UNTITLED_REQUEST, apiKeyLocation, asText, hasKey, sentRows } from './exportFields'
import { AUTH_INHERIT } from './inheritance'
import { GRANT_AUTHORIZATION_CODE, GRANT_PASSWORD } from './oauth'
import { readParamRows } from './queryString'
import { AUTH_OAUTH2, normalizeRequest } from './request'
import { isFileRow, parseRows, ROW_FILE, ROW_TEXT } from './rows'

const POSTMAN_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'

const sameNames = (...names) => Object.fromEntries(names.map((name) => [name, name]))

const renamed = (section, names) => (auth) => {
  const source = (section ? auth[section] : auth) || {}
  return Object.fromEntries(Object.entries(names).map(([postmanKey, key]) => [postmanKey, source[key]]))
}

const POSTMAN_GRANTS = { [GRANT_PASSWORD]: 'password_credentials' }

const postmanGrant = (config) => (
  config.grant === GRANT_AUTHORIZATION_CODE && config.pkce !== false ? 'authorization_code_with_pkce' : lookup(POSTMAN_GRANTS, config.grant) || config.grant
)

const POSTMAN_AUTH_WRITERS = {
  [AUTH_BASIC]: renamed('', sameNames('username', 'password')),
  digest: renamed('', sameNames('username', 'password')),
  ntlm: renamed('', sameNames('username', 'password', 'domain')),
  [AUTH_BEARER]: renamed('', sameNames('token')),
  [AUTH_API_KEY]: (auth) => ({ key: auth.key, value: auth.value, in: apiKeyLocation(auth.in) }),
  awsv4: renamed('aws', sameNames('accessKey', 'secretKey', 'sessionToken', 'region', 'service')),
  edgegrid: renamed('edgegrid', sameNames('clientToken', 'clientSecret', 'accessToken', 'nonce', 'timestamp', 'headersToSign')),
  oauth1: renamed('oauth1', sameNames('consumerKey', 'consumerSecret', 'token', 'tokenSecret', 'signatureMethod', 'realm', 'callback', 'verifier', 'nonce', 'timestamp')),
  asap: renamed('asap', { alg: 'algorithm', iss: 'issuer', aud: 'audience', kid: 'keyId', privateKey: 'privateKey', sub: 'subject', claims: 'claims', exp: 'expiry' }),
  hawk: (auth) => ({
    ...renamed('hawk', { authId: 'id', authKey: 'key', algorithm: 'algorithm', extraData: 'ext', app: 'app', delegation: 'dlg', nonce: 'nonce', timestamp: 'timestamp' })(auth),
    includePayloadHash: auth.hawk?.payloadHash === 'include',
  }),
  jwt: (auth) => ({
    ...renamed('jwt', { algorithm: 'algorithm', secret: 'secret', privateKey: 'privateKey', payload: 'payload', header: 'header', headerPrefix: 'prefix', queryParamKey: 'queryKey' })(auth),
    addTokenTo: auth.jwt?.in === AUTH_IN_QUERY ? 'queryParam' : AUTH_IN_HEADER,
    isSecretBase64Encoded: auth.jwt?.secretEncoding === 'base64',
  }),
  [AUTH_OAUTH2]: ({ oauth2: config = {} }) => ({
    ...renamed('', { authUrl: 'authUrl', accessTokenUrl: 'tokenUrl', clientId: 'clientId', clientSecret: 'clientSecret', scope: 'scope', username: 'username', password: 'password', redirect_uri: 'callbackUrl' })(config),
    grant_type: postmanGrant(config),
    client_authentication: config.credentialsIn === 'body' ? 'body' : AUTH_IN_HEADER,
  }),
}

const toPostmanField = ([key, value]) => (
  typeof value === 'boolean' ? { key, value, type: 'boolean' } : { key, value: asText(value), type: 'string' }
)

function toPostmanAuth(auth, isScope = false) {
  if (auth?.type === AUTH_INHERIT || (isScope && !auth?.type)) return null
  const fieldsOf = lookup(POSTMAN_AUTH_WRITERS, auth?.type)
  if (!fieldsOf) return { type: 'noauth' }
  return { type: auth.type, [auth.type]: Object.entries(fieldsOf(auth)).map(toPostmanField) }
}

const POSTMAN_EVENTS = [['prerequest', 'preScript'], ['test', 'postScript']]

const toPostmanEvents = (source) => POSTMAN_EVENTS
  .filter(([, field]) => asText(source?.[field]).trim() !== '')
  .map(([listen, field]) => ({ listen, script: { type: 'text/javascript', exec: source[field].split('\n') } }))

function toPostmanScope(source) {
  const auth = toPostmanAuth(source?.auth, true)
  const event = toPostmanEvents(source)
  return {
    ...(asText(source?.description).trim() && { description: source.description }),
    ...(auth && { auth }),
    ...(event.length > 0 && { event }),
  }
}

const disabledFlag = (row) => (row.enabled ? {} : { disabled: true })

const toPostmanEntry = (row) => ({ key: row.key, value: row.value, ...disabledFlag(row) })

const toPostmanEntries = (rows) => rows.filter(hasKey).map(toPostmanEntry)

function toPostmanFormData(row) {
  if (!isFileRow(row)) return { ...toPostmanEntry(row), type: ROW_TEXT }
  return {
    key: row.key,
    type: ROW_FILE,
    src: asText(row.fileName),
    ...(row.contentType && { contentType: row.contentType }),
    ...disabledFlag(row),
  }
}

const POSTMAN_BODY_WRITERS = {
  [BODY_NONE]: () => null,
  [BODY_FORM]: (body) => ({ mode: 'urlencoded', urlencoded: toPostmanEntries(parseRows(body)) }),
  [BODY_MULTIPART]: (body) => ({ mode: 'formdata', formdata: parseRows(body).filter(hasKey).map(toPostmanFormData) }),
  [BODY_BINARY]: (body) => ({ mode: 'file', file: { src: asText(parseJSON(body, {})?.fileName) } }),
}

function toPostmanBody(request) {
  if (request.method === GRAPHQL_METHOD) {
    return {
      mode: 'graphql',
      graphql: { query: request.graphqlQuery || request.body, variables: request.graphqlVariables },
    }
  }
  const write = lookup(POSTMAN_BODY_WRITERS, request.bodyType)
  if (write) return write(request.body)
  if (asText(request.body) === '') return null
  return { mode: 'raw', raw: request.body, options: { raw: { language: request.bodyType } } }
}

const placeholderSegment = (name) => `{{${name}}}`

function withPathVariables(url, rows) {
  const [address, ...rest] = url.split('?')
  const segments = address.split('/')
  const firstPathSegment = address.includes('://') ? 3 : 1
  const pathSegments = new Set(segments.slice(firstPathSegment))
  const variables = rows.filter((row) => pathSegments.has(placeholderSegment(row.key)))
  const named = new Map(variables.map((row) => [placeholderSegment(row.key), `:${row.key}`]))
  const path = segments.map((segment, index) => (index >= firstPathSegment && named.get(segment)) || segment).join('/')
  return { url: [path, ...rest].join('?'), variables }
}

function toPostmanUrl(request) {
  const { url, variables } = withPathVariables(request.url, sentRows(request.vars))
  const address = url.split(/[?#]/)[0]
  const schemeEnd = address.indexOf('://')
  const [host, ...path] = (schemeEnd === -1 ? address : address.slice(schemeEnd + 3)).split('/')
  return {
    raw: url,
    ...(schemeEnd !== -1 && { protocol: address.slice(0, schemeEnd) }),
    host: host.split('.'),
    path,
    query: toPostmanEntries(readParamRows(request.url, request.queryParams)),
    ...(variables.length > 0 && { variable: variables.map(({ key, value }) => ({ key, value })) }),
  }
}

const hasContentType = (headers) => headers.some((header) => header.key.toLowerCase() === 'content-type')

const toPostmanResponse = (originalRequest) => (example) => {
  const header = example.headers.map(({ key, value }) => ({ key, value }))
  return {
    name: exampleLabel(example),
    originalRequest,
    code: example.status,
    header: example.contentType && !hasContentType(header) ? [...header, { key: 'Content-Type', value: example.contentType }] : header,
    body: isBinaryExample(example) ? '' : example.body,
  }
}

function toPostmanBehavior(options) {
  const behavior = {
    ...(options?.noFollowRedirects && { followRedirects: false }),
    ...(options?.insecureTLS && { strictSSL: false }),
  }
  return Object.keys(behavior).length > 0 ? behavior : null
}

function toPostmanItem(request) {
  const body = toPostmanBody(request)
  const behavior = toPostmanBehavior(request.options)
  const auth = toPostmanAuth(request.auth)
  const event = toPostmanEvents(request)
  const method = request.method === GRAPHQL_METHOD ? 'POST' : request.method
  const header = toPostmanEntries(parseRows(request.headers))
  const url = toPostmanUrl(request)
  return {
    id: request.id,
    name: request.name || UNTITLED_REQUEST,
    ...(behavior && { protocolProfileBehavior: behavior }),
    ...(event.length > 0 && { event }),
    request: {
      method,
      header,
      url,
      ...(auth && { auth }),
      ...(body && { body }),
      ...(asText(request.description).trim() && { description: request.description }),
    },
    response: parseExamples(request.examples).map(toPostmanResponse({ method, header, url })),
  }
}

const DEFAULT_COLLECTION_NAME = 'Gostman Collection'

const toPostmanVariables = (values) => Object.entries(values).map(([key, value]) => ({ key, value: asText(value) }))

const isEmpty = (object) => Object.keys(object).length === 0

function folderVariables(folder) {
  const variables = parseJSON(folder?.variables, {})
  return isPlainObject(variables) ? variables : {}
}

function toPostmanFolder(folder, item) {
  const variables = folderVariables(folder)
  return {
    id: folder.id,
    name: folder.name,
    ...toPostmanScope(folder),
    ...(!isEmpty(variables) && { variable: toPostmanVariables(variables) }),
    item,
  }
}

function soleFolder(tree) {
  const [folder, ...others] = foldersIn(tree, ROOT_ID)
  return folder && others.length === 0 && requestsIn(tree, ROOT_ID).length === 0 ? folder : null
}

export function exportToPostman(requests, folders = [], options = {}) {
  const { defaultName = DEFAULT_COLLECTION_NAME, variables = {}, settings, sharedOrder = false } = options
  const tree = buildCollectionTree(folders, requests, sharedOrder)
  const itemsIn = (folderId) => siblingsIn(tree, folderId).map(({ kind, item }) => (
    kind === ROW_FOLDER ? toPostmanFolder(item, itemsIn(item.id)) : toPostmanItem(normalizeRequest(item))
  ))
  const sole = soleFolder(tree)
  const collectionScope = toPostmanScope(settings)
  const root = sole && isEmpty(collectionScope) ? sole : null
  const { description, ...scope } = root ? toPostmanScope(root) : collectionScope
  return {
    info: { name: sole?.name || defaultName, schema: POSTMAN_SCHEMA, ...(description && { description }) },
    ...scope,
    item: itemsIn(root ? root.id : ROOT_ID),
    variable: toPostmanVariables({ ...variables, ...folderVariables(root) }),
  }
}
