import { dereference, validate } from '@scalar/openapi-parser'
import YAML from 'js-yaml'
import { BODY_BINARY, BODY_FORM, BODY_JSON, BODY_MULTIPART, BODY_NONE, BODY_TEXT, BODY_XML } from './body'
import { buildCollectionTree, foldersIn, listFolders, requestsIn, ROOT_ID } from './collectionTree'
import { isPlainObject, parseJSON, pluralize } from './dataUtils'
import { readParamRows } from './queryString'
import { isFileRow, isSentRow, parseRows, ROW_FILE, ROW_TEXT, serializeRows } from './rows'

export const MAX_FILE_SIZE = 10 * 1024 * 1024

const MAX_RECURSION_DEPTH = 10
const MAX_FOLDER_DEPTH = 100
const MAX_VALIDATION_ERRORS = 10
const MAX_NAMES_IN_WARNING = 5

const POSTMAN_SCHEMA_MARKER = 'postman.com/json/collection'
const POSTMAN_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
const GOSTMAN_FORMAT_VERSION = '2.0.0'
const GRAPHQL_METHOD = 'GRAPHQL'
const OPENAPI_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
const UNTITLED_REQUEST = 'Untitled Request'

const AUTH_BASIC = 'basic'
const AUTH_BEARER = 'bearer'
const AUTH_API_KEY = 'apikey'
const AUTH_IN_HEADER = 'header'
const AUTH_IN_QUERY = 'query'
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

const asText = (value) => (value === undefined || value === null ? '' : String(value))

const createRow = (key, value, enabled = true) => ({ key, value, enabled })

const rowsField = (rows) => (rows.length > 0 ? serializeRows(rows) : '')

const sentRows = (json) => parseRows(json).filter(isSentRow)

const apiKeyLocation = (location) => (location === AUTH_IN_QUERY ? AUTH_IN_QUERY : AUTH_IN_HEADER)

const withLeadingSlash = (path) => (path.startsWith('/') ? path : `/${path}`)

function withoutQuery(url) {
  const queryStart = url.indexOf('?')
  return queryStart === -1 ? url : url.slice(0, queryStart)
}

/**
 * Safely stringifies a value, handling circular references and other edge cases.
 * Uses a WeakSet to track circular references and replaces them with a placeholder.
 * @param {any} value - The value to stringify
 * @param {string|null} [placeholder=null] - Placeholder for circular refs (defaults to "[Circular]")
 * @returns {string} JSON string or empty string on error
 */
function safeStringify(value, placeholder = null) {
  if (value === undefined) return ''
  if (value === null) return 'null'

  try {
    if (typeof value !== 'object') {
      return JSON.stringify(value)
    }

    const seen = new WeakSet()
    const circularPlaceholder = placeholder || '[Circular Reference]'

    const result = JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return circularPlaceholder
        }
        seen.add(val)
      }
      if (typeof val === 'function') {
        return '[Function]'
      }
      if (val === undefined) {
        return null
      }
      if (typeof val === 'symbol') {
        return val.toString()
      }
      return val
    }, 2)

    return result
  } catch (error) {
    // Fallback for very complex objects or edge cases
    console.warn('safeStringify failed:', error.message)
    try {
      return JSON.stringify(
        Object.keys(value || {}).reduce((acc, key) => {
          try {
            acc[key] = typeof value[key] === 'object'
              ? (Array.isArray(value[key]) ? [] : {})
              : value[key]
          } catch {
            acc[key] = '[Error accessing value]'
          }
          return acc
        }, {}),
        null,
        2
      )
    } catch {
      return '{}'
    }
  }
}

/**
 * Simple UUID generator (using crypto.randomUUID if available, else fallback)
 * @returns {string} A unique ID string
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function uniqueId(candidate, usedIds) {
  const id = candidate && !usedIds.has(candidate) ? candidate : generateId()
  usedIds.add(id)
  return id
}

const hasKey = (entry) => asText(entry?.key).trim() !== ''

function postmanRows(entries) {
  return asArray(entries)
    .filter(hasKey)
    .map((entry) => createRow(asText(entry.key), asText(entry.value), !entry.disabled))
}

const postmanUrlPart = (part) => (isPlainObject(part) ? asText(part.value) : asText(part))

const joinPostmanUrlParts = (parts, separator) => (
  Array.isArray(parts) ? parts.map(postmanUrlPart).join(separator) : asText(parts)
)

function composePostmanUrl({ protocol, host, port, path }) {
  const hostName = joinPostmanUrlParts(host, '.')
  if (!hostName) return ''
  const scheme = protocol ? `${asText(protocol).replace('://', '')}://` : ''
  const portSuffix = port ? `:${port}` : ''
  const pathText = joinPostmanUrlParts(path, '/')
  return `${scheme}${hostName}${portSuffix}${pathText ? withLeadingSlash(pathText) : ''}`
}

function postmanUrl(url) {
  if (typeof url === 'string') return url
  if (!isPlainObject(url)) return ''
  const raw = asText(url.raw) || composePostmanUrl(url)
  return Array.isArray(url.query) ? withoutQuery(raw) : raw
}

const POSTMAN_AUTH_READERS = {
  noauth: () => NO_AUTH,
  [AUTH_BASIC]: (fields) => ({ type: AUTH_BASIC, username: asText(fields.username), password: asText(fields.password) }),
  [AUTH_BEARER]: (fields) => ({ type: AUTH_BEARER, token: asText(fields.token) }),
  [AUTH_API_KEY]: (fields) => ({
    type: AUTH_API_KEY,
    key: asText(fields.key),
    value: asText(fields.value),
    in: apiKeyLocation(fields.in),
  }),
}

function postmanAuthFields(auth) {
  const fields = auth[auth.type]
  if (isPlainObject(fields)) return fields
  return Object.fromEntries(asArray(fields).filter(hasKey).map((field) => [field.key, field.value]))
}

function resolvePostmanAuth(auth, inherited, context) {
  if (!isPlainObject(auth) || !auth.type || auth.type === 'inherit') return inherited
  const read = POSTMAN_AUTH_READERS[auth.type]
  if (read) return read(postmanAuthFields(auth))
  context.unsupportedAuth.set(auth.type, (context.unsupportedAuth.get(auth.type) || 0) + 1)
  return NO_AUTH
}

const POSTMAN_RAW_BODY_TYPES = { json: BODY_JSON, xml: BODY_XML, text: BODY_TEXT, html: BODY_TEXT, javascript: BODY_TEXT }

function postmanFileName(source) {
  const path = asText(Array.isArray(source) ? source[0] : source)
  return path.split(/[\\/]/).pop()
}

function postmanFormDataRow(entry) {
  const row = createRow(asText(entry.key), '', !entry.disabled)
  if (entry.type !== ROW_FILE) return { ...row, value: asText(entry.value), type: ROW_TEXT }
  return {
    ...row,
    type: ROW_FILE,
    fileName: postmanFileName(entry.src),
    contentType: asText(entry.contentType),
    data: '',
  }
}

function postmanFormDataBody(body) {
  const rows = asArray(body.formdata).filter(hasKey).map(postmanFormDataRow)
  return { body: rowsField(rows), bodyType: BODY_MULTIPART, needsFiles: rows.some(isFileRow) }
}

function postmanGraphQLVariables(variables) {
  if (typeof variables === 'string') return variables
  return isPlainObject(variables) ? JSON.stringify(variables, null, 2) : ''
}

const POSTMAN_BODY_READERS = {
  raw: (body) => ({ body: asText(body.raw), bodyType: POSTMAN_RAW_BODY_TYPES[body.options?.raw?.language] || '' }),
  urlencoded: (body) => ({ body: rowsField(postmanRows(body.urlencoded)), bodyType: BODY_FORM }),
  formdata: postmanFormDataBody,
  file: () => ({ body: '', bodyType: BODY_BINARY, needsFiles: true }),
  graphql: (body) => ({
    method: GRAPHQL_METHOD,
    graphqlQuery: asText(body.graphql?.query),
    graphqlVariables: postmanGraphQLVariables(body.graphql?.variables),
  }),
}

function readPostmanBody(body) {
  if (!isPlainObject(body) || body.disabled) return {}
  const read = POSTMAN_BODY_READERS[body.mode]
  return read ? read(body) : {}
}

const tlsWarning = (requestNames) => (
  `TLS verification was disabled in the collection for ${listNames(requestNames)}; it was kept enabled. Turn it off in the request's Settings tab if you trust these hosts.`
)

function readPostmanRequest(item, folderId, inheritedAuth, context) {
  const source = isPlainObject(item.request) ? item.request : { url: item.request }
  const { needsFiles, ...body } = readPostmanBody(source.body)
  const name = asText(item.name).trim() || UNTITLED_REQUEST
  if (needsFiles) context.requestsNeedingFiles.push(name)
  if (item.protocolProfileBehavior?.strictSSL === false) context.requestsWithoutTls.push(name)
  return {
    id: uniqueId(item.id, context.usedIds),
    name,
    method: asText(source.method).trim().toUpperCase() || 'GET',
    url: postmanUrl(source.url),
    headers: rowsField(postmanRows(source.header)),
    queryParams: rowsField(postmanRows(source.url?.query).map((row, position) => ({ ...row, position }))),
    folderId,
    auth: resolvePostmanAuth(source.auth, inheritedAuth, context),
    options: { noFollowRedirects: item.protocolProfileBehavior?.followRedirects === false, insecureTLS: false },
    ...body,
  }
}

function readPostmanFolder(item, parentId, inheritedAuth, context, depth) {
  const folder = {
    id: uniqueId(item.id, context.usedIds),
    name: asText(item.name).trim() || 'Folder',
    isOpen: false,
    parentId,
  }
  context.folders.push(folder)
  const auth = resolvePostmanAuth(item.auth, inheritedAuth, context)
  readPostmanItems(item.item, folder.id, auth, context, depth + 1)
}

function readPostmanItems(items, parentId, inheritedAuth, context, depth = 0) {
  if (depth > MAX_FOLDER_DEPTH) {
    context.depthExceeded = true
    return
  }
  for (const item of asArray(items).filter(isPlainObject)) {
    if (Array.isArray(item.item)) {
      readPostmanFolder(item, parentId, inheritedAuth, context, depth)
    } else if (item.request) {
      context.requests.push(readPostmanRequest(item, parentId, inheritedAuth, context))
    }
  }
}

function postmanVariables(entries) {
  return Object.fromEntries(
    asArray(entries)
      .filter((entry) => hasKey(entry) && !entry.disabled)
      .map((entry) => [entry.key, asText(entry.value)])
  )
}

function listNames(names) {
  const shown = names.slice(0, MAX_NAMES_IN_WARNING).map((name) => `"${name}"`).join(', ')
  const hidden = names.length - MAX_NAMES_IN_WARNING
  return hidden > 0 ? `${shown} and ${hidden} more` : shown
}

function postmanWarnings(context) {
  const warnings = Array.from(context.unsupportedAuth, ([type, count]) => (
    `"${type}" auth is not supported and was left out (${pluralize(count, 'place')}).`
  ))
  if (context.requestsNeedingFiles.length > 0) {
    warnings.push(`Files are not part of a Postman export. Attach them again in ${listNames(context.requestsNeedingFiles)}.`)
  }
  if (context.requestsWithoutTls.length > 0) warnings.push(tlsWarning(context.requestsWithoutTls))
  if (context.depthExceeded) {
    warnings.push(`Folders nested deeper than ${MAX_FOLDER_DEPTH} levels were skipped.`)
  }
  return warnings
}

export function parsePostmanCollection(source) {
  try {
    const data = typeof source === 'string' ? JSON.parse(source) : source
    if (!asText(data?.info?.schema).includes(POSTMAN_SCHEMA_MARKER)) {
      return { success: false, error: 'Invalid Postman collection: info.schema is missing or is not a Postman collection schema' }
    }
    const context = {
      requests: [],
      folders: [],
      usedIds: new Set(),
      unsupportedAuth: new Map(),
      requestsNeedingFiles: [],
      requestsWithoutTls: [],
      depthExceeded: false,
    }
    readPostmanItems(data.item, ROOT_ID, resolvePostmanAuth(data.auth, NO_AUTH, context), context)
    return {
      success: true,
      requests: context.requests,
      folders: context.folders,
      variables: postmanVariables(data.variable),
      warnings: postmanWarnings(context),
    }
  } catch (error) {
    return { success: false, error: error.message || 'Invalid Postman collection format' }
  }
}

/**
 * Joins URL parts, handling trailing/leading slashes correctly
 * @param {string} baseUrl - Base URL
 * @param {string} path - Path to append
 * @returns {string} Properly joined URL
 *
 * @example
 * joinUrlParts("https://api.example.com", "/users") → "https://api.example.com/users"
 * joinUrlParts("https://api.example.com/", "users") → "https://api.example.com/users"
 * joinUrlParts("https://api.example.com/", "/users") → "https://api.example.com/users"
 */
function joinUrlParts(baseUrl, path) {
  if (!baseUrl) return path || ''
  if (!path) return baseUrl

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path

  return normalizedBase + '/' + normalizedPath
}

/**
 * Gets base URL from server configuration, handling variables
 * @param {Object} server - OpenAPI server object
 * @returns {{url: string, isRelative: boolean}} Object with URL and relative flag
 */
function getServerUrl(server) {
  if (!server) return { url: '', isRelative: false }

  let url = server.url || ''

  if (server.variables) {
    Object.entries(server.variables || {}).forEach(([name, config]) => {
      const defaultValue = config.default ?? config.enum?.[0]
      if (defaultValue === undefined) {
        // Variable has no default value - keep placeholder and warn
        console.warn(`Server variable {${name}} has no default value`)
        return // Don't substitute - leave placeholder intact
      }
      url = url.replace(`{${name}}`, defaultValue)
    })
  }

  const isRelative = !url.match(/^https?:\/\//i)

  return { url, isRelative }
}

const OPENAPI_HTTP_AUTH = {
  [AUTH_BEARER]: { type: AUTH_BEARER, token: '{{token}}' },
  [AUTH_BASIC]: { type: AUTH_BASIC, username: '{{username}}', password: '{{password}}' },
}

const OPENAPI_TOKEN_SCHEMES = ['oauth2', 'openIdConnect']
const OPENAPI_API_KEY_LOCATIONS = [AUTH_IN_HEADER, AUTH_IN_QUERY]

function authFromSecurityScheme(scheme) {
  if (!isPlainObject(scheme)) return NO_AUTH
  if (scheme.type === 'http') return OPENAPI_HTTP_AUTH[asText(scheme.scheme).toLowerCase()] || NO_AUTH
  if (OPENAPI_TOKEN_SCHEMES.includes(scheme.type)) return { type: AUTH_BEARER, token: '{{accessToken}}' }
  if (scheme.type === 'apiKey' && OPENAPI_API_KEY_LOCATIONS.includes(scheme.in)) {
    return { type: AUTH_API_KEY, key: asText(scheme.name), value: '{{apiKey}}', in: scheme.in }
  }
  return NO_AUTH
}

function openAPIAuth(spec, operation) {
  const alternatives = asArray(operation.security ?? spec.security)
  if (alternatives.length !== 1 || !isPlainObject(alternatives[0])) return NO_AUTH
  const schemeNames = Object.keys(alternatives[0])
  if (schemeNames.length !== 1) return NO_AUTH
  return authFromSecurityScheme(spec.components?.securitySchemes?.[schemeNames[0]])
}

/**
 * Extracts query parameters from an OpenAPI operation
 * @param {Object} operation - OpenAPI operation object
 * @param {Array} pathParameters - Path-level parameters to merge
 * @returns {Object|null} Query parameters as key-value pairs, or null if empty
 */
function extractOpenAPIQueryParams(operation = {}, pathParameters = []) {
  const queryParams = {}

  // Merge path-level and operation-level parameters (operation overrides path)
  const paramMap = new Map()

  ;(pathParameters || [])
    .filter(p => p && p.in === 'query')
    .forEach(param => paramMap.set(param.name, param))

  ;(operation.parameters || [])
    .filter(p => p && p.in === 'query')
    .forEach(param => paramMap.set(param.name, param))

  paramMap.forEach(param => {
    const value = param.example ||
                  param.schema?.example ||
                  getExampleValueFromSchema(param.schema)
    queryParams[param.name] = value !== undefined ? String(value) : ''
  })

  return Object.keys(queryParams).length > 0 ? queryParams : null
}

/**
 * Extracts path parameters from URL and OpenAPI operation
 * @param {string} path - URL path with {param} placeholders
 * @param {Object} operation - OpenAPI operation object
 * @param {Array} pathParameters - Path-level parameters
 * @returns {Object} Path parameters as key-value pairs
 */
function extractOpenAPIPathParams(path, operation = {}, pathParameters = []) {
  const pathParams = {}

  const pathParamMatches = path.match(/\{([^}]+)\}/g) || []
  const pathParamNames = pathParamMatches.map(match => match.slice(1, -1))

  const paramMap = new Map()

  ;(pathParameters || [])
    .filter(p => p && p.in === 'path')
    .forEach(param => paramMap.set(param.name, param))

  ;(operation.parameters || [])
    .filter(p => p && p.in === 'path')
    .forEach(param => paramMap.set(param.name, param))

  pathParamNames.forEach(paramName => {
    const param = paramMap.get(paramName)

    // Warn if path parameter is not defined in OpenAPI parameters
    if (!param) {
      console.warn(
        `Path parameter "{${paramName}}" is used in the URL path ` +
        `but is not defined in the OpenAPI parameters. ` +
        `Add a parameter definition with 'in: path' and 'required: true'.`
      )
    }

    const value = param?.example ||
                  param?.schema?.example ||
                  getExampleValueFromSchema(param?.schema) ||
                  `{{${paramName}}}`
    pathParams[paramName] = String(value)
  })

  return pathParams
}

/**
 * Extracts headers from an OpenAPI operation
 * @param {Object} operation - OpenAPI operation object
 * @param {Array} pathParameters - Path-level parameters to merge
 * @returns {Object} Headers as key-value pairs
 */
function extractOpenAPIHeaders(operation = {}, pathParameters = []) {
  const headers = {}

  // Merge path-level and operation-level parameters (operation overrides path)
  const paramMap = new Map()

  ;(pathParameters || [])
    .filter(p => p && p.in === 'header')
    .forEach(param => paramMap.set(param.name, param))

  ;(operation.parameters || [])
    .filter(p => p && p.in === 'header')
    .forEach(param => paramMap.set(param.name, param))

  paramMap.forEach(param => {
    const value = param.example ||
                  param.schema?.example ||
                  getExampleValueFromSchema(param.schema)
    if (value !== undefined) {
      headers[param.name] = String(value)
    }
  })

  return headers
}

const PREFERRED_CONTENT_TYPES = [
  'application/json',
  'application/ld+json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'application/xml',
  'text/xml',
]

function bodyTypeForContentType(contentType) {
  if (contentType.includes('json')) return BODY_JSON
  if (contentType === BODY_CONTENT_TYPES[BODY_FORM]) return BODY_FORM
  if (contentType === BODY_CONTENT_TYPES[BODY_MULTIPART]) return BODY_MULTIPART
  if (contentType.includes('xml')) return BODY_XML
  if (contentType.startsWith('text/')) return BODY_TEXT
  return ''
}

function openAPIExample(mediaType) {
  if (mediaType.example !== undefined) return mediaType.example
  const namedExample = Object.values(mediaType.examples || {})[0]
  if (namedExample?.value !== undefined) return namedExample.value
  return mediaType.schema ? JSON.parse(generateExampleFromSchema(mediaType.schema)) : undefined
}

function exampleFields(example) {
  if (typeof example === 'string') return Array.from(new URLSearchParams(example))
  return isPlainObject(example) ? Object.entries(example) : []
}

const fieldText = (value) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : asText(value))

const exampleRows = (example) => exampleFields(example).map(([key, value]) => createRow(key, fieldText(value)))

function serializeExample(example, bodyType) {
  if (example === undefined || example === null) return ''
  if (bodyType === BODY_FORM) return rowsField(exampleRows(example))
  if (bodyType === BODY_MULTIPART) return rowsField(exampleRows(example).map((row) => ({ ...row, type: ROW_TEXT })))
  return typeof example === 'string' ? example : safeStringify(example)
}

function openAPIBody(requestBody) {
  const available = Object.keys(requestBody?.content || {})
  const contentType = PREFERRED_CONTENT_TYPES.find((type) => available.includes(type)) || available[0]
  if (!contentType) return { body: '', bodyType: '', contentType: '' }

  const bodyType = bodyTypeForContentType(contentType)
  const isEngineDefault = bodyType === BODY_MULTIPART || BODY_CONTENT_TYPES[bodyType] === contentType
  return {
    body: serializeExample(openAPIExample(requestBody.content[contentType] || {}), bodyType),
    bodyType,
    contentType: isEngineDefault ? '' : contentType,
  }
}

/**
 * Gets an example value from an OpenAPI schema
 * @param {Object} schema - OpenAPI schema object
 * @returns {any} Example value
 */
function getExampleValueFromSchema(schema) {
  if (!schema) return undefined

  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default

  switch (schema.type) {
    case 'string':
      return schema.enum?.[0] ||
             schema.format === 'email' ? 'user@example.com' :
             schema.format === 'uuid' ? '550e8400-e29b-41d4-a716-446655440000' :
             schema.format === 'uri' ? 'https://example.com' :
             schema.format === 'date' ? '2024-01-01' :
             schema.format === 'date-time' ? '2024-01-01T00:00:00Z' :
             schema.format === 'binary' ? '(binary data)' :
             schema.format === 'byte' ? 'ZXhhbXBsZQ==' :
             'string'
    case 'number':
    case 'integer':
      return schema.minimum ?? schema.exclusiveMinimum ?? schema.default ?? 0
    case 'boolean':
      return schema.default !== undefined ? schema.default : true
    case 'array':
      return []
    case 'object':
      return schema.properties ? {} : undefined
    default:
      if (schema.properties) return {}
      if (schema.const !== undefined) return schema.const
      return undefined
  }
}

/**
 * Resolves a $ref reference in the spec
 * @param {string} ref - The $ref string
 * @param {Object} spec - The full OpenAPI spec
 * @returns {Object|null} The resolved schema or null if not found
 */
function resolveRef(ref, spec) {
  if (!ref || !spec) return null

  // Handle external references - track them but don't resolve
  if (!ref.startsWith('#/')) {
    // Track external refs in the spec
    if (!spec._externalRefs) {
      spec._externalRefs = []
    }
    if (!spec._externalRefs.includes(ref)) {
      spec._externalRefs.push(ref)
    }
    return null // External references not supported
  }

  const path = ref.substring(2).split('/')
  let current = spec

  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return null
    }
  }

  return current
}

/**
 * Generates a JSON example from an OpenAPI schema
 * @param {Object} schema - OpenAPI schema object
 * @param {number} depth - Current recursion depth
 * @param {WeakSet} seenSchemas - WeakSet of seen schema objects to detect circular references
 * @param {Object} spec - Full OpenAPI spec for $ref resolution
 * @returns {string} JSON string of generated example
 */
function generateExampleFromSchema(schema, depth = 0, seenSchemas = null, spec = null) {
  if (depth > MAX_RECURSION_DEPTH) {
    return '{}'
  }

  if (!schema) return '{}'

  if (spec && !spec._circularRefs) {
    spec._circularRefs = []
  }

  // Use a single WeakSet per top-level call to track seen schemas
  const freshSeenSchemas = seenSchemas || new WeakSet()

  function generate(schema, currentDepth, seen) {
    if (currentDepth > MAX_RECURSION_DEPTH) {
      return null
    }

    if (schema.$ref) {
      const resolved = resolveRef(schema.$ref, spec)

      // Check for circular reference using WeakSet for object identity tracking
      if (!resolved) {
        return {}
      }

      if (seen.has(resolved)) {
        // Circular reference detected - track and skip
        if (spec && !spec._circularRefs.includes(schema.$ref)) {
          spec._circularRefs.push(schema.$ref)
        }
        return null // Skip circular refs instead of including placeholder
      }

      seen.add(resolved)
      return generate(resolved, currentDepth + 1, seen)
    }

    if (schema.allOf && Array.isArray(schema.allOf)) {
      const result = {}
      let hasRequired = []
      schema.allOf.forEach(sub => {
        const generated = generate(sub, currentDepth + 1, seen)
        if (generated && typeof generated === 'object') {
          Object.assign(result, generated)
          if (sub.required) {
            hasRequired = hasRequired.concat(sub.required)
          }
        }
      })
      if (hasRequired.length > 0) {
        result._required = hasRequired
      }
      return result
    }

    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      for (const sub of schema.anyOf) {
        const generated = generate(sub, currentDepth + 1, seen)
        if (generated !== null) {
          return generated
        }
      }
      return {}
    }

    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      const schemas = schema.oneOf
      if (schemas.length > 0) {
        return generate(schemas[0], currentDepth + 1, seen)
      }
      return {}
    }

    const schemaType = schema.type || (schema.properties ? 'object' : schema.enum ? 'string' : undefined)

    // Warn about invalid schema without type, enum, or const
    if (!schemaType && !schema.enum && schema.const === undefined) {
      console.warn(
        'Schema is missing "type" property and has no "enum" or "const" values. ' +
        'This may result in invalid example generation.'
      )
    }

    switch (schemaType) {
      case 'string': {
        const example = getExampleValueFromSchema(schema)
        return example !== undefined ? example : 'string'
      }
      case 'number':
      case 'integer': {
        const example = getExampleValueFromSchema(schema)
        return example !== undefined ? example : 0
      }
      case 'boolean':
        return schema.default !== undefined ? schema.default : true
      case 'array': {
        if (schema.items) {
          return [generate(schema.items, currentDepth + 1, seen)]
        }
        return []
      }
      case 'object': {
        if (!schema.properties) return {}
        const obj = {}
        Object.entries(schema.properties).forEach(([key, propSchema]) => {
          // Include required properties or those with defaults/examples
          if (schema.required?.includes(key) ||
              propSchema.default !== undefined ||
              propSchema.example !== undefined ||
              propSchema.const !== undefined) {
            obj[key] = generate(propSchema, currentDepth + 1, seen)
          }
        })
        // If object is empty, add at least one property for reference
        if (Object.keys(obj).length === 0) {
          const firstKey = Object.keys(schema.properties)[0]
          if (firstKey) {
            obj[firstKey] = generate(schema.properties[firstKey], currentDepth + 1, seen)
          }
        }
        return obj
      }
      default:
        // Handle schemas without explicit type but with const
        if (schema.const !== undefined) {
          return schema.const
        }
        if (schema.enum && schema.enum.length > 0) {
          return schema.enum[0]
        }
        return {}
    }
  }

  const result = generate(schema, depth, freshSeenSchemas)
  return JSON.stringify(result, null, 2)
}

function openAPIOperations(paths) {
  return Object.entries(paths)
    .filter(([, pathItem]) => isPlainObject(pathItem))
    .flatMap(([path, pathItem]) => OPENAPI_METHODS
      .filter((method) => isPlainObject(pathItem[method]))
      .map((method) => ({
        path,
        method,
        operation: pathItem[method],
        pathParameters: asArray(pathItem.parameters),
      })))
}

const objectRows = (object) => Object.entries(object || {}).map(([key, value]) => createRow(key, asText(value)))

function fillPathParams(url, pathParams) {
  return Object.entries(pathParams).reduce(
    (filled, [name, value]) => filled.replace(`{${name}}`, () => value),
    url
  )
}

function readOpenAPIOperation({ path, method, operation, pathParameters }, spec, baseUrl, folderId) {
  const { body, bodyType, contentType } = openAPIBody(operation.requestBody)
  const headers = objectRows(extractOpenAPIHeaders(operation, pathParameters))
  if (contentType) headers.push(createRow('Content-Type', contentType))
  return {
    id: generateId(),
    name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
    method: method.toUpperCase(),
    url: fillPathParams(joinUrlParts(baseUrl, path), extractOpenAPIPathParams(path, operation, pathParameters)),
    headers: rowsField(headers),
    queryParams: rowsField(objectRows(extractOpenAPIQueryParams(operation, pathParameters))),
    body,
    bodyType,
    folderId,
    auth: openAPIAuth(spec, operation),
  }
}

function importOpenAPISpec(spec) {
  if (spec.swagger && !spec.openapi) {
    throw new Error('Swagger 2.0 is not supported. Please use OpenAPI 3.x.')
  }
  if (!isPlainObject(spec.paths) || Object.keys(spec.paths).length === 0) {
    throw new Error('This OpenAPI spec defines no paths, so there is nothing to import.')
  }
  const { url: baseUrl, isRelative } = getServerUrl(spec.servers?.[0])
  if (!baseUrl) {
    throw new Error('This OpenAPI spec has no server URL. Add a "servers" entry such as { url: "https://api.example.com" }.')
  }
  if (isRelative) {
    throw new Error('This OpenAPI spec uses a relative server URL. Provide the full base URL, for example https://api.example.com.')
  }

  const tagFolders = new Map()
  const folderIdFor = (tag) => {
    if (tag === undefined) return ROOT_ID
    const name = asText(tag)
    if (!tagFolders.has(name)) tagFolders.set(name, { id: generateId(), name, isOpen: false, parentId: ROOT_ID })
    return tagFolders.get(name).id
  }
  const requests = openAPIOperations(spec.paths).map((entry) => (
    readOpenAPIOperation(entry, spec, baseUrl, folderIdFor(asArray(entry.operation.tags)[0]))
  ))
  return { requests, folders: Array.from(tagFolders.values()), warnings: [] }
}

/**
 * Parses an OpenAPI spec string (JSON or YAML) and converts to Gostman format
 * @param {string} specString - OpenAPI spec as JSON or YAML string
 * @returns {Promise<Object>} Parsed result with success flag, requests, folders, and error if failed
 */
export async function parseOpenAPISpec(specString) {
  let jsonError = null
  let yamlError = null

  try {
    if (!specString || typeof specString !== 'string' || !specString.trim()) {
      return {
        success: false,
        error: 'Empty or invalid input'
      }
    }

    let spec

    // Try JSON first, capture error for better reporting
    try {
      spec = JSON.parse(specString)
    } catch (jsonErr) {
      jsonError = jsonErr
      // Try YAML, capture error for better reporting
      try {
        spec = parseYAML(specString)
      } catch (yamlErr) {
        yamlError = yamlErr
        // Both parsers failed - provide combined error message
        return {
          success: false,
          error: `Could not parse the file as valid JSON or YAML.\n\nJSON error: ${jsonError.message || 'Invalid JSON syntax'}\nYAML error: ${yamlError.message || 'Invalid YAML syntax'}\n\nPlease check that your file is properly formatted.`
        }
      }
    }

    if (!spec || typeof spec !== 'object') {
      return {
        success: false,
        error: 'Invalid OpenAPI spec: could not parse as JSON or YAML'
      }
    }

    // Initialize external refs and circular refs tracking
    if (!spec._externalRefs) {
      spec._externalRefs = []
    }
    if (!spec._circularRefs) {
      spec._circularRefs = []
    }

    // Validate and ensure it's OpenAPI 3.x or 3.1
    if (spec.openapi) {
      if (!spec.openapi.startsWith('3')) {
        return {
          success: false,
          error: 'Only OpenAPI 3.x is supported. Found version: ' + spec.openapi
        }
      }
    }

    if (spec.swagger) {
      return {
        success: false,
        error: 'Swagger 2.0 is not supported. Please use OpenAPI 3.x.'
      }
    }

    // Validate using @scalar/openapi-parser
    const validation = await validateOpenAPI(spec)
    if (!validation.valid) {
      // Limit errors to first MAX_VALIDATION_ERRORS and show count
      const allErrors = Array.isArray(validation.errors) ? validation.errors : []
      const displayErrors = allErrors.slice(0, MAX_VALIDATION_ERRORS)
      const errorMessages = displayErrors.map(e => `- ${e.message || e}`).join('\n')
      const errorCount = allErrors.length
      const countMessage = errorCount > MAX_VALIDATION_ERRORS
        ? `\n(Showing ${MAX_VALIDATION_ERRORS} of ${errorCount} errors)`
        : ''

      return {
        success: false,
        error: `Invalid OpenAPI spec:\n${errorMessages}${countMessage}`
      }
    }

    // Ensure validation.spec exists and is an object
    const validatedSpec = validation.spec && typeof validation.spec === 'object' ? validation.spec : spec

    // Check for relative server URLs - add warning but allow import
    const serverInfo = getServerUrl(validatedSpec.servers?.[0]) || { url: '', isRelative: false }
    const { url: serverUrl, isRelative } = serverInfo

    const result = importOpenAPISpec(validatedSpec)

    // Add warnings about relative URLs, external refs, and circular refs
    const warnings = []
    if (isRelative || !serverUrl) {
      warnings.push(`Server URL is relative (${serverUrl || '/path'}). You may need to update the base URL in requests to match your API server.`)
    }
    const externalRefs = validation.spec._externalRefs
    if (Array.isArray(externalRefs) && externalRefs.length > 0) {
      warnings.push(`Found ${externalRefs.length} external $ref(s) that could not be resolved. These may need to be resolved manually.`)
    }
    const circularRefs = validation.spec._circularRefs
    if (Array.isArray(circularRefs) && circularRefs.length > 0) {
      warnings.push(`Skipped ${circularRefs.length} circular reference(s) during example generation.`)
    }

    // Ensure result is a plain object before spreading
    const resultObj = result && typeof result === 'object' ? result : { requests: [], folders: [], collectionName: 'Import' }

    return {
      success: true,
      ...resultObj,
      warnings
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Invalid OpenAPI format'
    }
  }
}

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
    : BODY_CONTENT_TYPES[bodyType] || BODY_CONTENT_TYPES[BODY_TEXT]
  return mediaContent(contentType, rawMediaType(body, contentType))
}

function openAPIOperation(request, path, securitySchemes) {
  const requestBody = openAPIRequestBody(request)
  const scheme = securitySchemeFor(request.auth)
  return {
    summary: request.name || `${request.method} ${path}`,
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

/**
 * Infers JSON Schema from a JavaScript object
 * @param {any} obj - Object to infer schema from
 * @param {WeakSet} seen - Set of already seen objects for circular reference detection
 * @returns {Object} JSON Schema
 */
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

/**
 * Validates and optionally dereferences an OpenAPI spec using @scalar/openapi-parser
 * @param {Object|string} spec - OpenAPI spec object or JSON string
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Validation result with valid flag and errors
 */
async function validateOpenAPI(spec, options = {}) {
  const { dereference: shouldDereference = false } = options

  try {
    if (typeof spec === 'string') {
      spec = JSON.parse(spec)
    }

    // Remove custom tracking properties that would cause validation errors
    // These are added by our import processing but shouldn't be in the spec
    const specCopy = { ...spec }
    delete specCopy._externalRefs
    delete specCopy._circularRefs

    if (!spec || typeof spec !== 'object') {
      return {
        valid: false,
        errors: [{ message: 'Spec must be an object' }]
      }
    }

    if (!specCopy.openapi && !specCopy.swagger) {
      return {
        valid: false,
        errors: [{ message: 'Spec must have openapi or swagger field' }]
      }
    }

    if (shouldDereference) {
      const result = await dereference(specCopy)
      // @scalar/openapi-parser dereference returns { schema, errors }
      if (result.schema) {
        return {
          valid: true,
          spec: result.schema
        }
      }
      const errors = Array.isArray(result.errors) ? result.errors : []
      if (errors.length > 0) {
        return {
          valid: false,
          errors: errors.map(e => ({ message: e.message || String(e) }))
        }
      }
    }

    // Use validate for validation without dereferencing
    try {
      const result = await validate(specCopy)
      // @scalar/openapi-parser validate returns { valid, errors }
      if (result.valid) {
        return {
          valid: true,
          spec: spec  // Return original spec with tracking properties intact
        }
      }
      const errors = Array.isArray(result.errors) ? result.errors : []
      if (errors.length > 0) {
        // Limit errors to MAX_VALIDATION_ERRORS
        const limitedErrors = errors.slice(0, MAX_VALIDATION_ERRORS)
        return {
          valid: false,
          errors: limitedErrors.map(e => ({ message: e.message || String(e) }))
        }
      }
    } catch (validateError) {
      // If validate throws but basic structure is valid, accept it
      if (specCopy.openapi && specCopy.info && specCopy.paths) {
        return {
          valid: true,
          spec: spec  // Return original spec with tracking properties intact
        }
      }
      return {
        valid: false,
        errors: [{ message: validateError.message }]
      }
    }

    // Fallback - valid if basic structure is correct
    return {
      valid: true,
      spec: spec
    }
  } catch (error) {
    return {
      valid: false,
      errors: [{ message: error.message }]
    }
  }
}

/**
 * Converts Gostman requests to OpenAPI JSON string
 * @param {Array} requests - Gostman request objects
 * @param {Object} options - Export options
 * @returns {string} OpenAPI JSON string
 */
export function exportToOpenAPIJSON(requests, options = {}) {
  try {
    return safeStringify(exportToOpenAPI(requests, options))
  } catch (error) {
    console.warn('exportToOpenAPIJSON failed, falling back to standard stringify:', error.message)
    return JSON.stringify(exportToOpenAPI(requests, options), null, 2)
  }
}

/**
 * Converts Gostman requests to OpenAPI YAML string using js-yaml
 * @param {Array} requests - Gostman request objects
 * @param {Object} options - Export options
 * @returns {string} OpenAPI YAML string
 */
export function exportToOpenAPIYAML(requests, options = {}) {
  const spec = exportToOpenAPI(requests, options)
  return YAML.dump(spec, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  })
}

const POSTMAN_AUTH_WRITERS = {
  [AUTH_BASIC]: ({ username, password }) => ({ username, password }),
  [AUTH_BEARER]: ({ token }) => ({ token }),
  [AUTH_API_KEY]: (auth) => ({ key: auth.key, value: auth.value, in: apiKeyLocation(auth.in) }),
}

function toPostmanAuth(auth) {
  const fieldsOf = POSTMAN_AUTH_WRITERS[auth?.type]
  if (!fieldsOf) return { type: 'noauth' }
  const fields = Object.entries(fieldsOf(auth)).map(([key, value]) => ({ key, value: asText(value), type: 'string' }))
  return { type: auth.type, [auth.type]: fields }
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
  const write = POSTMAN_BODY_WRITERS[request.bodyType]
  if (write) return write(request.body)
  return { mode: 'raw', raw: request.body, options: { raw: { language: request.bodyType } } }
}

function toPostmanUrl(request) {
  const address = request.url.split(/[?#]/)[0]
  const schemeEnd = address.indexOf('://')
  const [host, ...path] = (schemeEnd === -1 ? address : address.slice(schemeEnd + 3)).split('/')
  return {
    raw: request.url,
    ...(schemeEnd !== -1 && { protocol: address.slice(0, schemeEnd) }),
    host: host.split('.'),
    path,
    query: toPostmanEntries(readParamRows(request.url, request.queryParams)),
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
  return {
    id: request.id,
    name: request.name || UNTITLED_REQUEST,
    ...(behavior && { protocolProfileBehavior: behavior }),
    request: {
      method: request.method === GRAPHQL_METHOD ? 'POST' : request.method,
      header: toPostmanEntries(parseRows(request.headers)),
      url: toPostmanUrl(request),
      auth: toPostmanAuth(request.auth),
      ...(body && { body }),
    },
    response: [],
  }
}

export function exportToPostman(requests, folders = [], options = {}) {
  const { name = 'Gostman Collection', variables = {} } = options
  const tree = buildCollectionTree(folders, requests)
  const itemsIn = (folderId) => [
    ...foldersIn(tree, folderId).map((folder) => ({ id: folder.id, name: folder.name, item: itemsIn(folder.id) })),
    ...requestsIn(tree, folderId).map(toPostmanItem),
  ]
  return {
    info: { name, schema: POSTMAN_SCHEMA },
    item: itemsIn(ROOT_ID),
    variable: Object.entries(variables).map(([key, value]) => ({ key, value: asText(value) })),
  }
}

export function exportToGostman(requests, folders, environments) {
  return {
    version: GOSTMAN_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    gostman: { requests, folders, environments },
  }
}

const invalidGostmanBackup = (reason) => ({ success: false, error: `Invalid Gostman export format: ${reason}` })

const withTlsVerification = (request) => (
  request?.options?.insecureTLS ? { ...request, options: { ...request.options, insecureTLS: false } } : request
)

export function importGostman(data) {
  const backup = data?.gostman
  if (!isPlainObject(backup)) return invalidGostmanBackup('missing gostman object')
  if (!Array.isArray(backup.requests)) return invalidGostmanBackup('requests must be an array')
  if (!Array.isArray(backup.folders)) return invalidGostmanBackup('folders must be an array')
  const requestsWithoutTls = backup.requests
    .filter((request) => request?.options?.insecureTLS)
    .map((request) => asText(request.name) || UNTITLED_REQUEST)
  return {
    success: true,
    warnings: requestsWithoutTls.length > 0 ? [tlsWarning(requestsWithoutTls)] : [],
    requests: backup.requests.map(withTlsVerification),
    folders: backup.folders,
    environments: asArray(backup.environments),
    variables: isPlainObject(backup.variables) ? backup.variables : {},
  }
}

/**
 * Parses YAML string to object using js-yaml
 * @param {string} yamlString - YAML string
 * @returns {Object} Parsed object
 */
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
  const label = MARKDOWN_AUTH_LABELS[auth?.type]
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

export function detectImportFormat(text) {
  let data
  try {
    data = parseStructuredText(text)
  } catch {
    return 'unknown'
  }
  if (!isPlainObject(data)) return 'unknown'
  if (asText(data.info?.schema).includes(POSTMAN_SCHEMA_MARKER) || data.info?._postman_id) return 'postman'
  if (data.openapi || (data.swagger && data.info)) return 'openapi'
  if (data.gostman) return 'gostman'
  return 'unknown'
}
