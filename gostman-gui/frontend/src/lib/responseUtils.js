/** Get status badge variant from HTTP status */
export function getStatusVariant(status) {
  if (!status) return "default"
  const code = parseInt(status.split(" ")[0], 10)
  if (code >= 200 && code < 300) return "success"
  if (code >= 300 && code < 400) return "redirect"
  if (code >= 400 && code < 500) return "clientError"
  if (code >= 500) return "serverError"
  return "default"
}

/** Detect response content type from headers */
export function detectContentType(response, responseHeaders) {
  if (response && typeof response === 'string' && response.startsWith('data:')) {
    if (response.startsWith('data:image/')) return 'image'
    if (response.startsWith('data:text/html')) return 'html'
  }

  if (!responseHeaders) return 'text'

  const contentType = getHeaderValue(responseHeaders, 'content-type')
  if (!contentType) return 'text'

  const ct = contentType.toLowerCase()
  if (ct.includes('text/html')) return 'html'
  if (ct.includes('image/')) return 'image'
  if (ct.includes('application/json') || ct.includes('+json')) return 'json'
  return 'text'
}

/** Get header value (handles both array and object formats) */
function getHeaderValue(headers, key) {
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
