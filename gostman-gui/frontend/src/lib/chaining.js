import { JSONPath } from 'jsonpath-plus'
import { findHeader } from './response'

const HEADER_PREFIX = 'header.'
const STATUS_PATHS = ['statusCode', 'status']
const ROOT_PATHS = ['$', '$.']

export const isHeaderPath = (path) => path.startsWith(HEADER_PREFIX)

export const isStatusPath = (path) => STATUS_PATHS.includes(path)

const toJSONPath = (path) => (path.startsWith('$') ? path : `$.${path}`)

const stringify = (value) => (typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))

export function extractFromResponse(body, path) {
  if (!path || isStatusPath(path) || isHeaderPath(path)) return null

  const jsonPath = toJSONPath(path)
  const isRoot = ROOT_PATHS.includes(jsonPath) || path === 'body'

  let data
  try {
    data = JSON.parse(body)
  } catch {
    return isRoot ? body : null
  }
  if (isRoot) return stringify(data)

  try {
    const result = JSONPath({ path: jsonPath, json: data, wrap: false })
    return result === undefined || result === null ? null : stringify(result)
  } catch {
    return null
  }
}

export function extractFromHeaders(headers, path) {
  if (!path || !isHeaderPath(path)) return null
  return findHeader(headers, path.slice(HEADER_PREFIX.length))
}

export function createTestScript(variableName, path, scope = 'environment') {
  const pmScope = scope === 'global' ? 'pm.globals' : scope === 'environment' ? 'pm.environment' : 'pm.variables'

  if (isHeaderPath(path)) {
    return `${pmScope}.set("${variableName}", pm.response.headers.get("${path.slice(HEADER_PREFIX.length)}"));`
  }

  if (isStatusPath(path)) {
    return `${pmScope}.set("${variableName}", pm.response.code);`
  }

  return `${pmScope}.set("${variableName}", pm.response.json().${toJSONPath(path).substring(2)});`
}

export const VARIABLE_TEMPLATES = [
  { name: 'User ID', path: '$.data.user.id', description: 'Extract user ID from response' },
  { name: 'All User IDs', path: '$.data.users[*].id', description: 'Extract all user IDs (array)' },
  { name: 'Auth Token', path: '$.data.token', description: 'Extract authentication token' },
  { name: 'Session ID', path: '$.sessionId', description: 'Extract session identifier' },
  { name: 'Resource ID', path: '$.data.id', description: 'Extract resource identifier' },
  { name: 'First Item Name', path: '$.items[0].name', description: 'First item in array' },
  { name: 'All Names', path: '$..name', description: 'All name properties (recursive)' },
  { name: 'Filter Active', path: '$.items[?(@.active)].id', description: 'IDs of active items' },
  { name: 'Response Status', path: 'statusCode', description: 'HTTP status code' },
  { name: 'Location Header', path: 'header.Location', description: 'Location redirect header' },
  { name: 'Authorization Header', path: 'header.Authorization', description: 'Auth header from response' },
]
