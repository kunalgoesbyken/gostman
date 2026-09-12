import parseCurl from 'parse-curl'

function formatBody(body) {
  if (!body) return ''
  if (typeof body === 'object') return JSON.stringify(body, null, 2)

  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

function extractQueryParams(url) {
  try {
    const params = {}
    new URL(url).searchParams.forEach((value, key) => params[key] = value)
    return params
  } catch {
    return {}
  }
}

/**
 * Parse a curl command string into request components
 */
export function parseCurlCommand(curlCommand) {
  if (!curlCommand || typeof curlCommand !== 'string') {
    return null
  }

  const trimmed = curlCommand.trim()
  if (!/^curl\s+/i.test(trimmed)) {
    return null
  }

  try {
    const parsed = parseCurl(trimmed)
    if (!parsed) return null

    return {
      method: parsed.method?.toUpperCase() || 'GET',
      url: parsed.url || '',
      headers: JSON.stringify(parsed.header || {}, null, 2),
      body: formatBody(parsed.body),
      queryParams: JSON.stringify(extractQueryParams(parsed.url), null, 2),
    }
  } catch (error) {
    console.error('Failed to parse curl command:', error)
    return null
  }
}

/**
 * Check if text appears to be a curl command
 */
export function isCurlCommand(text) {
  return text && typeof text === 'string' && /^curl\s+/i.test(text.trim())
}
