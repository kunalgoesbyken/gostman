import { JSONPath } from 'jsonpath-plus'

/**
 * Extracts a value from a response body using a JSONPath expression.
 *
 * Status codes and headers are deliberately not resolvable here: they are not
 * part of the body, so those paths return null and the caller must supply them
 * (see extractFromHeaders).
 *
 * @param {Object|string} response - Response data, parsed or raw JSON text
 * @param {string} path - JSONPath expression, e.g. "$.data.user.id"
 * @param {Object} options - Extra JSONPath options
 * @returns {string|null} The extracted value, or null if not found
 */
export function extractFromResponse(response, path, options = {}) {
  if (!path) return null

  const jsonPath = path.startsWith('$') ? path : `$.${path}`

  let data = response

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return jsonPath === '$' || jsonPath === '$.' ? data : null
    }
  }

  if (jsonPath === '$' || jsonPath === '$.' || path === 'body') {
    return typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
  }

  if (path === 'statusCode' || path === 'status') {
    return null
  }

  if (path.startsWith('header.')) {
    return null
  }

  try {
    const result = JSONPath({
      path: jsonPath,
      json: data,
      wrap: false,
      ...options
    })

    if (result === undefined || result === null) {
      return null
    }

    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2)
    }
    return String(result)
  } catch (error) {
    console.warn(`JSONPath extraction failed: ${error.message}`)
    return null
  }
}

/**
 * Extracts a value from response headers.
 * @param {Object} headers - Response headers
 * @param {string} path - Path expression, e.g. "header.Content-Type"
 * @returns {string|null} The header value, or null
 */
export function extractFromHeaders(headers, path) {
  if (!path || !path.startsWith('header.')) return null

  const headerName = path.substring(7)

  if (headers && typeof headers === 'object') {
    if (headerName in headers) {
      return String(headers[headerName])
    }

    // Header names can themselves contain dots, so fall back to JSONPath for
    // anything a direct lookup misses.
    try {
      const result = JSONPath({
        path: `$.${headerName}`,
        json: headers,
        wrap: false
      })
      if (result !== undefined) {
        return String(result)
      }
    } catch {}
  }

  return null
}

/**
 * Builds a Postman-compatible test script that stores an extracted value.
 * @param {string} variableName - The variable to set
 * @param {string} path - The path to extract
 * @param {string} scope - 'local', 'environment', or 'global'
 * @returns {string} The test script
 */
export function createTestScript(variableName, path, scope = 'environment') {
  const pmScope = scope === 'global' ? 'pm.globals' : scope === 'environment' ? 'pm.environment' : 'pm.variables'

  if (path.startsWith('header.')) {
    return `${pmScope}.set("${variableName}", pm.response.headers.get("${path.substring(7)}"));`
  }

  if (path === 'statusCode' || path === 'status') {
    return `${pmScope}.set("${variableName}", pm.response.code);`
  }

  const jsonPath = path.startsWith('$') ? path : `$.${path}`

  return `${pmScope}.set("${variableName}", pm.response.json().${jsonPath.substring(2)});`
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
