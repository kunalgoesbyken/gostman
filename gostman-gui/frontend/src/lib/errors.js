const ErrorType = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  TIMEOUT: 'timeout',
  SERVER: 'server',
  UNKNOWN: 'unknown'
}

function createError(type, message, details = null) {
  return {
    type,
    message,
    details,
    timestamp: new Date().toISOString()
  }
}

function isStructuredError(error) {
  return error && typeof error === 'object' && 'type' in error && 'message' in error
}

export function parseError(error) {
  if (isStructuredError(error)) return error

  const message = typeof error === 'string' ? error : error?.message || 'Unknown error'

  if (message.includes('Network Error') || message.includes('fetch') || message.includes('ECONNREFUSED')) {
    return createError(ErrorType.NETWORK, message)
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return createError(ErrorType.TIMEOUT, message)
  }
  if (message.includes('validation') || message.includes('Invalid') || message.includes('JSON')) {
    return createError(ErrorType.VALIDATION, message)
  }
  if (message.includes('Error parsing') || message.includes('parse error')) {
    return createError(ErrorType.VALIDATION, message)
  }

  return createError(ErrorType.UNKNOWN, message, error)
}

/** Returns the icon/color/title presentation for an error, keyed by its parsed type. */
export function getErrorConfig(error) {
  const parsed = parseError(error)

  const configs = {
    [ErrorType.NETWORK]: {
      icon: 'WifiOff',
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      title: 'Network Error'
    },
    [ErrorType.VALIDATION]: {
      icon: 'AlertCircle',
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/20',
      title: 'Validation Error'
    },
    [ErrorType.TIMEOUT]: {
      icon: 'Clock',
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      title: 'Request Timeout'
    },
    [ErrorType.SERVER]: {
      icon: 'Server',
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      border: 'border-destructive/20',
      title: 'Server Error'
    },
    [ErrorType.UNKNOWN]: {
      icon: 'HelpCircle',
      color: 'text-muted-foreground',
      bg: 'bg-muted',
      border: 'border-border',
      title: 'Error'
    }
  }

  return configs[parsed.type] || configs[ErrorType.UNKNOWN]
}
