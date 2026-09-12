/** Parse JSON safely, return default value if invalid */
export function parseJSON(jsonString, defaultValue = {}) {
  if (!jsonString || jsonString.trim() === '') return defaultValue
  try {
    return JSON.parse(jsonString)
  } catch {
    return defaultValue
  }
}

/** Parse JSON to object, return null if invalid (for type checking) */
export function tryParseJSON(data) {
  if (typeof data === 'object' && data !== null) return data
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  return null
}

/** Parse request from storage or API with fallback defaults */
export function parseRequest(rawRequest) {
  if (!rawRequest) {
    return {
      id: '',
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: '{}',
      body: '',
      queryParams: '{}',
      response: ''
    }
  }
  return {
    id: rawRequest.id || '',
    name: rawRequest.name || 'New Request',
    method: rawRequest.method || 'GET',
    url: rawRequest.url || '',
    headers: rawRequest.headers || '{}',
    body: rawRequest.body || '',
    queryParams: rawRequest.queryParams || '{}',
    response: rawRequest.response || '',
    folderId: rawRequest.folderId,
  }
}

/** Format bytes to human-readable size */
export function formatSize(bytes) {
  if (!bytes || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Parse cookie string from Set-Cookie header */
export function parseCookieString(cookieStr) {
  const parts = cookieStr.split(';').map(p => p.trim())
  const [nameValue, ...attrs] = parts
  const eqIdx = nameValue.indexOf('=')
  const name = eqIdx >= 0 ? nameValue.slice(0, eqIdx) : nameValue
  const value = eqIdx >= 0 ? nameValue.slice(eqIdx + 1) : ''
  const attrMap = {}
  attrs.forEach(a => {
    const ai = a.indexOf('=')
    if (ai >= 0) attrMap[a.slice(0, ai).toLowerCase()] = a.slice(ai + 1)
    else attrMap[a.toLowerCase()] = true
  })
  return {
    name,
    value,
    domain: attrMap['domain'] || '',
    path: attrMap['path'] || '',
    expires: attrMap['expires'] || '',
    secure: !!attrMap['secure'],
    httpOnly: !!attrMap['httponly'],
  }
}

/** Get header value from headers (handles both array and object formats) */
export function getHeaderValue(headers, key) {
  if (!headers) return ''
  const lowerKey = key.toLowerCase()

  if (Array.isArray(headers)) {
    const header = headers.find(h => h.key.toLowerCase() === lowerKey)
    return header?.value || ''
  }

  for (const [k, value] of Object.entries(headers)) {
    if (k.toLowerCase() === lowerKey) {
      return Array.isArray(value) ? value[0] : value
    }
  }
  return ''
}

/** Convert headers to normalized array format */
export function normalizeHeaders(headers) {
  if (!headers) return []

  if (Array.isArray(headers)) {
    return headers.map(h => ({ name: h.key, value: h.value }))
  }

  const entries = []
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      value.forEach(v => entries.push({ name: key, value: v }))
    } else {
      entries.push({ name: key, value: String(value) })
    }
  }
  return entries
}
