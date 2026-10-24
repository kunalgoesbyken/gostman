import YAML from 'js-yaml'
import { BODY_BINARY, BODY_FORM, BODY_JSON, BODY_MULTIPART, BODY_NONE, BODY_TEXT, BODY_TYPES, BODY_XML } from './body'
import { buildCollectionTree, folderDepth, listFolders, MAX_FOLDER_DEPTH, requestsIn, ROOT_ID } from './collectionTree'
import { SCRIPT_FIELDS, activeKinds, hasActiveContent, withoutActiveContent } from './activeContent'
import { isPlainObject, lookup, parseJSON, pluralize } from './dataUtils'
import { sanitizeExamples } from './examples'
import { readParamRows } from './queryString'
import { SCHEMES } from './authSchemes'
import { AUTH_INHERIT, AUTH_NONE, activeSettingsKinds, hasActiveSettings, normalizeScopeSettings, withoutActiveSettings } from './inheritance'
import { clearToken } from './oauth'
import { AUTH_OAUTH2, normalizeRequest } from './request'
import { isFileRow, isSentRow } from './rows'
import { normalizeTags } from './tags'
import { AUTH_API_KEY, AUTH_BASIC, AUTH_BEARER, GRAPHQL_METHOD, UNTITLED_REQUEST, apiKeyLocation, asText, sentRows } from './exportFields'

export { exportToPostman } from './postmanExport'

export const MAX_FILE_SIZE = 10 * 1024 * 1024

const MAX_NAMES_IN_WARNING = 5
const MAX_NAME_LENGTH = 200
const MAX_METHOD_LENGTH = 16

const GOSTMAN_FORMAT_VERSION = '2.0.0'
const OPENAPI_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
const UNTITLED_FOLDER = 'Folder'
const UNTITLED_ENVIRONMENT = 'Environment'
const DEFAULT_METHOD = 'GET'
const METHOD_TOKEN = /^[A-Z]+$/

const NO_AUTH = { type: '' }

const BODY_CONTENT_TYPES = {
  [BODY_JSON]: 'application/json',
  [BODY_TEXT]: 'text/plain',
  [BODY_XML]: 'application/xml',
  [BODY_FORM]: 'application/x-www-form-urlencoded',
  [BODY_MULTIPART]: 'multipart/form-data',
  [BODY_BINARY]: 'application/octet-stream',
}

const asArray = (value) => (Array.isArray(value) ? value : [])

const withLeadingSlash = (path) => (path.startsWith('/') ? path : `/${path}`)

function safeStringify(value) {
  if (value === undefined) return ''
  const seen = new WeakSet()
  return JSON.stringify(value, (key, nested) => {
    if (typeof nested !== 'object' || nested === null) return nested
    if (seen.has(nested)) return '[Circular Reference]'
    seen.add(nested)
    return nested
  }, 2)
}

const generateId = () => crypto.randomUUID()

export const countActiveRequests = (data) => (
  data.requests.filter(hasActiveContent).length + [...data.folders, data.settings].filter(hasActiveSettings).length
)

export const activeKindsOf = (data) => [...new Set([
  ...data.requests.flatMap(activeKinds),
  ...[...data.folders, data.settings].flatMap(activeSettingsKinds),
])]

export const withoutActiveRequests = (data) => ({
  ...data,
  requests: data.requests.map(withoutActiveContent),
  folders: data.folders.map(withoutActiveSettings),
  settings: withoutActiveSettings(data.settings),
})

function listNames(names) {
  const shown = names.slice(0, MAX_NAMES_IN_WARNING).map((name) => `"${name}"`).join(', ')
  const hidden = names.length - MAX_NAMES_IN_WARNING
  return hidden > 0 ? `${shown} and ${hidden} more` : shown
}

const tlsWarning = (requestNames) => (
  `TLS verification was disabled in the collection for ${listNames(requestNames)}; it was kept enabled. Turn it off in the request's Settings tab if you trust these hosts.`
)

const BINARY_SCHEMA = { type: 'string', format: 'binary' }
const OPENAPI_RESERVED_HEADERS = ['accept', 'content-type', 'authorization']
const LEADING_PLACEHOLDER = /^\{\{[^{}]+\}\}/
const PATH_PLACEHOLDER = /\{([^{}]+)\}/g

function splitUrl(url) {
  const address = url.split(/[?#]/)[0]
  const placeholder = address.match(LEADING_PLACEHOLDER)
  if (placeholder) return { origin: '', path: withLeadingSlash(address.slice(placeholder[0].length)) }
  const schemeEnd = address.indexOf('://')
  if (schemeEnd === -1) return { origin: '', path: withLeadingSlash(address) }
  const pathStart = address.indexOf('/', schemeEnd + 3)
  if (pathStart === -1) return { origin: address, path: '/' }
  return { origin: address.slice(0, pathStart), path: address.slice(pathStart) }
}

function openAPIPath(path) {
  return path
    .replace(/\/{2,}/g, '/')
    .replace(/\/:([^/]+)/g, '/{$1}')
    .replace(/\{\{([^{}]+)\}\}/g, '{$1}')
}

const toParameter = (location) => (row) => ({
  name: row.key,
  in: location,
  schema: { type: 'string' },
  example: row.value,
})

const uniqueRows = (rows, identify) => Array.from(new Map(rows.map((row) => [identify(row.key), row])).values())

function openAPIParameters(request, path) {
  const pathNames = new Set(Array.from(path.matchAll(PATH_PLACEHOLDER), (match) => match[1]))
  const query = readParamRows(request.url, request.queryParams).filter(isSentRow)
  const headers = sentRows(request.headers).filter((row) => !OPENAPI_RESERVED_HEADERS.includes(row.key.toLowerCase()))
  return [
    ...Array.from(pathNames, (name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
    ...uniqueRows(query, (key) => key).map(toParameter('query')),
    ...uniqueRows(headers, (key) => key.toLowerCase()).map(toParameter('header')),
  ]
}

function securitySchemeFor(auth) {
  if (auth?.type === AUTH_BASIC || auth?.type === AUTH_BEARER) return { type: 'http', scheme: auth.type }
  if (auth?.type === AUTH_API_KEY && auth.key) return { type: 'apiKey', in: apiKeyLocation(auth.in), name: auth.key }
  return null
}

function registerSecurityScheme(scheme, registered) {
  const signature = JSON.stringify(scheme)
  const existing = Object.keys(registered).find((name) => JSON.stringify(registered[name]) === signature)
  if (existing) return existing
  const name = scheme.type === 'http' ? `${scheme.scheme}Auth` : `apiKeyAuth${Object.keys(registered).length + 1}`
  registered[name] = scheme
  return name
}

const mediaContent = (contentType, mediaType) => ({ content: { [contentType]: mediaType } })

function formMediaType(body) {
  const rows = sentRows(body)
  const properties = rows.map((row) => [row.key, isFileRow(row) ? BINARY_SCHEMA : { type: 'string' }])
  const example = rows.filter((row) => !isFileRow(row)).map((row) => [row.key, row.value])
  return {
    schema: { type: 'object', properties: Object.fromEntries(properties) },
    example: Object.fromEntries(example),
  }
}

function rawMediaType(body, contentType) {
  const parsed = contentType.includes('json') ? parseJSON(body, null) : null
  if (parsed === null) return { schema: { type: 'string' }, example: body }
  return { schema: inferSchemaFromObject(parsed), example: parsed }
}

function openAPIRequestBody(request) {
  const { body, bodyType } = request
  if (bodyType === BODY_NONE || body.trim() === '') return null
  if (bodyType === BODY_BINARY) return mediaContent(BODY_CONTENT_TYPES[BODY_BINARY], { schema: BINARY_SCHEMA })
  if (bodyType === BODY_FORM || bodyType === BODY_MULTIPART) {
    return mediaContent(BODY_CONTENT_TYPES[bodyType], formMediaType(body))
  }
  const declared = sentRows(request.headers).find((row) => row.key.toLowerCase() === 'content-type')
  const contentType = declared
    ? declared.value.split(';')[0].trim()
    : lookup(BODY_CONTENT_TYPES, bodyType) || BODY_CONTENT_TYPES[BODY_TEXT]
  return mediaContent(contentType, rawMediaType(body, contentType))
}

function openAPIOperation(request, path, securitySchemes) {
  const requestBody = openAPIRequestBody(request)
  const scheme = securitySchemeFor(request.auth)
  const tags = normalizeTags(request.tags)
  return {
    summary: request.name || `${request.method} ${path}`,
    ...(tags.length > 0 && { tags }),
    parameters: openAPIParameters(request, path),
    ...(requestBody && { requestBody }),
    ...(scheme && { security: [{ [registerSecurityScheme(scheme, securitySchemes)]: [] }] }),
    responses: { 200: { description: 'Successful response' } },
  }
}

function exportToOpenAPI(requests, options = {}) {
  const {
    title = 'Gostman API Collection',
    version = '1.0.0',
    description = 'API collection exported from Gostman',
  } = options
  const origins = new Set()
  const securitySchemes = {}
  const paths = {}

  for (const request of asArray(requests)) {
    const method = asText(request.method).toLowerCase()
    if (!request.url || !OPENAPI_METHODS.includes(method)) continue
    const { origin, path: rawPath } = splitUrl(request.url)
    const path = openAPIPath(rawPath)
    if (origin) origins.add(origin)
    paths[path] = { ...paths[path], [method]: openAPIOperation(request, path, securitySchemes) }
  }

  return {
    openapi: '3.0.3',
    info: { title, version, description },
    servers: Array.from(origins, (url) => ({ url })),
    paths,
    components: { schemas: {}, securitySchemes },
  }
}

function inferSchemaFromObject(obj, seen = new WeakSet()) {
  if (obj === null) return { type: 'null' }
  if (typeof obj === 'string') return { type: 'string' }
  if (typeof obj === 'number') return { type: 'number', format: Number.isInteger(obj) ? 'integer' : 'float' }
  if (typeof obj === 'boolean') return { type: 'boolean' }

  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      return {
        type: 'array',
        items: inferSchemaFromObject(obj[0], seen)
      }
    }
    return { type: 'array', items: {} }
  }

  if (typeof obj === 'object') {
    if (seen.has(obj)) {
      return { type: 'object', description: '[Circular reference]' }
    }
    seen.add(obj)

    const properties = {}
    const required = []

    Object.entries(obj).forEach(([key, value]) => {
      properties[key] = inferSchemaFromObject(value, seen)
      if (value !== null && value !== undefined && value !== '') {
        required.push(key)
      }
    })

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required })
    }
  }

  return {}
}

export function exportToOpenAPIJSON(requests, options = {}) {
  return safeStringify(exportToOpenAPI(requests, options))
}

export function exportToOpenAPIYAML(requests, options = {}) {
  const spec = exportToOpenAPI(requests, options)
  return YAML.dump(spec, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  })
}

const withoutToken = (request) => ({ ...request, auth: { ...request.auth, oauth2: clearToken(request.auth.oauth2) } })

const withoutScopeToken = (scope) => (scope?.auth?.oauth2 ? { ...scope, auth: { ...scope.auth, oauth2: clearToken(scope.auth.oauth2) } } : scope)

export function exportToGostman(requests, folders, environments, settings) {
  return {
    version: GOSTMAN_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    gostman: { requests: requests.map(withoutToken), folders: folders.map(withoutScopeToken), environments, settings: withoutScopeToken(settings) },
  }
}

const invalidGostmanBackup = (reason) => ({ success: false, error: `Invalid Gostman export format: ${reason}` })

function importGostman(data) {
  const backup = data?.gostman
  if (!isPlainObject(backup)) return invalidGostmanBackup('missing gostman object')
  if (!Array.isArray(backup.requests)) return invalidGostmanBackup('requests must be an array')
  if (!Array.isArray(backup.folders)) return invalidGostmanBackup('folders must be an array')
  return {
    success: true,
    warnings: [],
    requests: backup.requests,
    folders: backup.folders,
    environments: asArray(backup.environments),
    variables: isPlainObject(backup.variables) ? backup.variables : {},
    settings: backup.settings,
  }
}

function parseYAML(yamlString) {
  try {
    return YAML.load(yamlString)
  } catch (error) {
    throw new Error(`Invalid YAML: ${error.message}`)
  }
}

const MIN_FENCE_LENGTH = 3

const markdownCell = (text) => asText(text).replaceAll('|', '\\|').replaceAll('\n', ' ')

const markdownCode = (text) => (text ? `\`${markdownCell(text)}\`` : '')

function markdownTable(title, rows) {
  if (rows.length === 0) return []
  return [
    `**${title}:**`,
    '',
    '| Key | Value |',
    '|-----|-------|',
    ...rows.map((row) => `| ${markdownCode(row.key)} | ${markdownCode(isFileRow(row) ? row.fileName : row.value)} |`),
    '',
  ]
}

function markdownCodeBlock(title, language, text) {
  if (text.trim() === '') return []
  const longestRun = Math.max(0, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length))
  const fence = '`'.repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1))
  return [`**${title}:**`, '', `${fence}${language}`, text, fence, '']
}

const MARKDOWN_AUTH_LABELS = {
  [AUTH_BASIC]: () => 'Basic',
  [AUTH_BEARER]: () => 'Bearer token',
  [AUTH_API_KEY]: (auth) => `API key ${markdownCode(auth.key)} in ${apiKeyLocation(auth.in)}`,
}

function markdownAuth(auth) {
  const label = lookup(MARKDOWN_AUTH_LABELS, auth?.type)
  return label ? [`**Auth:** ${label(auth)}`, ''] : []
}

function markdownBody(request) {
  const { body, bodyType } = request
  if (request.method === GRAPHQL_METHOD) {
    return [
      ...markdownCodeBlock('Query', 'graphql', request.graphqlQuery || body),
      ...markdownCodeBlock('Variables', BODY_JSON, request.graphqlVariables),
    ]
  }
  if (bodyType === BODY_NONE) return []
  if (bodyType === BODY_FORM || bodyType === BODY_MULTIPART) return markdownTable('Body', sentRows(body))
  if (bodyType === BODY_BINARY) {
    const fileName = asText(parseJSON(body, {})?.fileName)
    return fileName ? [`**Body:** file ${markdownCode(fileName)}`, ''] : []
  }
  return markdownCodeBlock('Body', bodyType, body)
}

function markdownRequest(request) {
  const method = request.method === GRAPHQL_METHOD ? 'POST' : request.method
  return [
    `### ${request.name || UNTITLED_REQUEST}`,
    '',
    `**${method}** ${markdownCode(request.url)}`,
    '',
    ...markdownAuth(request.auth),
    ...markdownTable('Headers', sentRows(request.headers)),
    ...markdownTable('Query Parameters', readParamRows(request.url, request.queryParams).filter(isSentRow)),
    ...markdownBody(request),
    '---',
    '',
  ]
}

export function exportToMarkdown(requests, folders = [], options = {}) {
  const { title = 'API Documentation' } = options
  const tree = buildCollectionTree(folders, requests)
  const sections = [
    { heading: '', requests: requestsIn(tree, ROOT_ID) },
    ...listFolders(tree).map(({ folder, path }) => ({ heading: path.join(' / '), requests: requestsIn(tree, folder.id) })),
  ]
  const lines = sections
    .filter((section) => section.requests.length > 0)
    .flatMap((section) => [
      ...(section.heading ? [`## ${section.heading}`, ''] : []),
      ...section.requests.flatMap(markdownRequest),
    ])
  return [`# ${title}`, '', ...lines].join('\n')
}

function parseStructuredText(text) {
  try {
    return JSON.parse(text)
  } catch {
    return parseYAML(text)
  }
}

function detectImportFormat(text) {
  let data
  try {
    data = parseStructuredText(text)
  } catch {
    return 'unknown'
  }
  if (!isPlainObject(data)) return 'unknown'
  if (data.gostman) return 'gostman'
  return 'unknown'
}

const IMPORT_READERS = new Map([
  ['gostman', { label: 'Gostman export', read: (text) => importGostman(JSON.parse(text)) }],
])

const importFailure = (error) => ({ success: false, error })

export async function parseImport(text) {
  const reader = IMPORT_READERS.get(detectImportFormat(text))
  if (!reader) return importFailure('Could not detect the format. Use a Postman collection, an OpenAPI or Swagger spec or a Gostman export.')
  try {
    const result = await reader.read(text)
    if (!result.success) return result
    if (result.requests.length === 0 && result.folders.length === 0) {
      return importFailure(`This ${reader.label} contains no requests or folders.`)
    }
    return { ...result, label: reader.label }
  } catch (error) {
    return importFailure(error?.message || `This ${reader.label} could not be read.`)
  }
}

const AUTH_TYPES = [AUTH_INHERIT, AUTH_BASIC, AUTH_BEARER, AUTH_API_KEY, AUTH_OAUTH2, ...Object.keys(SCHEMES)]
const OAUTH_TEXT_FIELDS = ['grant', 'authUrl', 'tokenUrl', 'clientId', 'clientSecret', 'scope', 'username', 'password', 'callbackUrl', 'credentialsIn', 'headerPrefix', 'resource', 'issuer']
const AUTH_TEXT_FIELDS = ['username', 'password', 'token', 'key', 'value', 'domain']
const SCHEME_SECTIONS = Object.values(SCHEMES).filter((scheme) => scheme.section)
const REQUEST_TEXT_FIELDS = ['id', 'description', 'url', 'headers', 'body', 'queryParams', 'folderId', 'graphqlQuery', 'graphqlVariables', 'extractors', 'assertions', ...SCRIPT_FIELDS, 'grpcMethod', 'grpcMessage', 'grpcProtos', 'mcpMethod', 'mcpTool', 'mcpArguments', 'socketProtocol', 'socketMessages', 'vars']
const SCOPE_TEXT_FIELDS = ['description', 'headers', 'assertions', ...SCRIPT_FIELDS]
const BODY_TYPE_VALUES = BODY_TYPES.map((type) => type.value)

const stringOf = (value) => (typeof value === 'string' ? value : '')

const cleanName = (value, fallback) => stringOf(value).trim().slice(0, MAX_NAME_LENGTH) || fallback

const pickStrings = (source, fields) => Object.fromEntries(fields.map((field) => [field, stringOf(source[field])]))

function cleanMethod(value) {
  const method = stringOf(value).trim().toUpperCase()
  return method.length <= MAX_METHOD_LENGTH && METHOD_TOKEN.test(method) ? method : DEFAULT_METHOD
}

function sanitizeOAuth(raw) {
  if (!isPlainObject(raw)) return {}
  return { ...pickStrings(raw, OAUTH_TEXT_FIELDS), pkce: raw.pkce !== false }
}

function sanitizeSections(raw) {
  return Object.fromEntries(SCHEME_SECTIONS.map(({ section, fields }) => [
    section,
    isPlainObject(raw[section]) ? pickStrings(raw[section], fields.map((field) => field.key)) : {},
  ]))
}

const SCOPE_AUTH_TYPES = [AUTH_NONE, ...AUTH_TYPES]

function sanitizeAuth(raw, types = AUTH_TYPES) {
  if (!isPlainObject(raw) || !types.includes(raw.type)) return NO_AUTH
  return { ...pickStrings(raw, AUTH_TEXT_FIELDS), type: raw.type, in: apiKeyLocation(raw.in), oauth2: sanitizeOAuth(raw.oauth2), ...sanitizeSections(raw) }
}

const OPTION_COUNTS = ['timeoutMs', 'streamMaxEvents', 'streamMaxSeconds']
const OPTION_FLAGS = ['noFollowRedirects', 'stream', 'streamReconnect', 'skipCookies', 'discardCookies']
const OPTION_TEXTS = ['socketIoPath', 'socketIoAuth']

function positiveCount(value) {
  const count = Math.trunc(Number(value))
  return Number.isFinite(count) && count > 0 ? count : 0
}

function sanitizeOptions(raw) {
  const options = isPlainObject(raw) ? raw : {}
  return {
    ...Object.fromEntries(OPTION_COUNTS.map((key) => [key, positiveCount(options[key])])),
    ...Object.fromEntries(OPTION_FLAGS.map((key) => [key, options[key] === true])),
    ...pickStrings(options, OPTION_TEXTS),
    insecureTLS: false,
  }
}

function sanitizeRequest(raw) {
  return normalizeRequest({
    ...pickStrings(raw, REQUEST_TEXT_FIELDS),
    name: cleanName(raw.name, UNTITLED_REQUEST),
    tags: normalizeTags(raw.tags),
    method: cleanMethod(raw.method),
    bodyType: BODY_TYPE_VALUES.includes(raw.bodyType) ? raw.bodyType : '',
    examples: sanitizeExamples(stringOf(raw.examples)),
    auth: sanitizeAuth(raw.auth),
    options: sanitizeOptions(raw.options),
  })
}

const sanitizeScope = (raw) => normalizeScopeSettings({
  ...pickStrings(isPlainObject(raw) ? raw : {}, SCOPE_TEXT_FIELDS),
  auth: sanitizeAuth(raw?.auth, SCOPE_AUTH_TYPES),
})

const sanitizeFolder = (raw) => ({
  id: stringOf(raw.id),
  name: cleanName(raw.name, UNTITLED_FOLDER),
  isOpen: raw.isOpen === true,
  parentId: stringOf(raw.parentId),
  variables: stringOf(raw.variables) || '{}',
  ...sanitizeScope(raw),
})

const variableMark = (mark) => ({ ...(mark?.secret === true && { secret: true }), ...(mark?.enabled === false && { enabled: false }) })

const secretMarks = (meta) => Object.fromEntries(
  Object.entries(parseJSON(stringOf(meta), {}) || {})
    .map(([name, mark]) => [name, variableMark(mark)])
    .filter(([, mark]) => Object.keys(mark).length > 0),
)

const sanitizeEnvironment = (raw) => ({
  id: stringOf(raw.id),
  name: cleanName(raw.name, UNTITLED_ENVIRONMENT),
  variables: stringOf(raw.variables),
  color: stringOf(raw.color),
  extends: stringOf(raw.extends),
  meta: JSON.stringify(secretMarks(raw.meta)),
})

function assignFreshIds(items, takenIds) {
  const usedIds = new Set(takenIds)
  const renamed = new Map()
  const assigned = items.map((item) => {
    const keepsId = item.id !== '' && !usedIds.has(item.id)
    const id = keepsId ? item.id : generateId()
    usedIds.add(id)
    if (item.id !== '' && !renamed.has(item.id)) renamed.set(item.id, id)
    return { ...item, id }
  })
  return { assigned, renamed }
}

function flattenDeepFolders(folders) {
  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId]))
  const isTooDeep = (folder) => folderDepth(folder.id, parentOf) > MAX_FOLDER_DEPTH
  return folders.map((folder) => (isTooDeep(folder) ? { ...folder, parentId: ROOT_ID } : folder))
}

export function sanitizeImport(data, existing) {
  const rawRequests = asArray(data?.requests).filter(isPlainObject)
  const requestsWithoutTls = rawRequests
    .filter((request) => request.options?.insecureTLS)
    .map((request) => cleanName(request.name, UNTITLED_REQUEST))

  const folderIds = assignFreshIds(asArray(data?.folders).filter(isPlainObject).map(sanitizeFolder), existing.folderIds)
  const inImport = (id) => folderIds.renamed.get(id) || ROOT_ID
  const linkedFolders = folderIds.assigned.map((folder) => ({ ...folder, parentId: inImport(folder.parentId) }))
  const folders = flattenDeepFolders(linkedFolders)
  const flattenedCount = folders.filter((folder, index) => folder.parentId !== linkedFolders[index].parentId).length

  const requestIds = assignFreshIds(rawRequests.map(sanitizeRequest), existing.requestIds)
  const requests = requestIds.assigned.map((request) => ({ ...request, folderId: inImport(request.folderId), timestamp: '' }))

  return {
    requests,
    folders,
    environments: asArray(data?.environments).filter(isPlainObject).map(sanitizeEnvironment),
    globals: asArray(data?.globals).filter(isPlainObject).map(sanitizeEnvironment),
    variables: isPlainObject(data?.variables) ? data.variables : {},
    settings: sanitizeScope(data?.settings),
    notes: asArray(data?.notes).filter((note) => typeof note === 'string'),
    warnings: [
      ...asArray(data?.warnings).filter((warning) => typeof warning === 'string'),
      ...(requestsWithoutTls.length > 0 ? [tlsWarning(requestsWithoutTls)] : []),
      ...(flattenedCount > 0 ? [`${pluralize(flattenedCount, 'folder')} nested in a loop or deeper than ${MAX_FOLDER_DEPTH} levels moved to the top level.`] : []),
    ],
  }
}
