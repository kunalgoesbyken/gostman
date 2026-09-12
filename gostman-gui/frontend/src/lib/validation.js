/**
 * Validates a JSON string, reporting the failure position as line/column.
 * @returns {Object} { valid, error, parsed?, position?: { line, column, position } }
 */
function validateJSON(jsonString) {
  if (!jsonString || jsonString.trim() === '') {
    return { valid: true, error: null, parsed: {} }
  }

  try {
    const parsed = JSON.parse(jsonString)
    return { valid: true, error: null, parsed }
  } catch (error) {
    // Engine-specific prefixes vary between V8 and SpiderMonkey; normalize them
    // so the surfaced message reads the same everywhere.
    let message = error.message
    message = message.replace(/JSON\.parse: /, '')
    message = message.replace(/Unexpected token/, 'Unexpected token')
    message = message.replace(/Unexpected end of JSON input/, 'Unexpected end of JSON')

    const positionMatch = message.match(/position (\d+)/) || message.match(/at position (\d+)/)
    let position = null
    let line = 1
    let column = 1

    if (positionMatch) {
      position = parseInt(positionMatch[1], 10)
      const before = jsonString.substring(0, position)
      line = before.split('\n').length
      column = before.split('\n').pop().length + 1
    } else {
      const lineMatch = message.match(/line (\d+)/)
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10)
      }
    }

    return {
      valid: false,
      error: message,
      position: position !== null ? { line, column, position } : null
    }
  }
}

/**
 * Validates an environment-variable map: valid identifier keys mapped to
 * scalar values only, since values are substituted into requests as strings.
 * @returns {Object} { valid, error?, parsed? }
 */
export function validateEnvVariables(jsonString) {
  const result = validateJSON(jsonString)
  if (!result.valid) return result

  if (result.parsed && typeof result.parsed === 'object') {
    for (const [key, value] of Object.entries(result.parsed)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(key)) {
        return {
          valid: false,
          error: `Invalid variable name "${key}". Use alphanumeric characters, underscores, and hyphens.`
        }
      }

      const type = typeof value
      if (value !== null && type !== 'string' && type !== 'number' && type !== 'boolean') {
        return {
          valid: false,
          error: `Variable "${key}" has unsupported type "${type}". Use strings, numbers, or booleans.`
        }
      }
    }
  }

  return result
}

/** Formats a validation result from validateEnvVariables for display. */
export function formatJSONError(validationResult) {
  if (!validationResult.error) {
    return 'Valid JSON'
  }

  if (validationResult.position) {
    const { line, column } = validationResult.position
    return `${validationResult.error} (line ${line}, column ${column})`
  }

  return validationResult.error
}
