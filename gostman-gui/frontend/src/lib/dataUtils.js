const KILOBYTE = 1024
const MEGABYTE = KILOBYTE * KILOBYTE

export function parseJSON(jsonString, defaultValue = {}) {
  if (!jsonString || jsonString.trim() === '') return defaultValue
  try {
    return JSON.parse(jsonString)
  } catch {
    return defaultValue
  }
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function formatSize(bytes) {
  if (bytes < KILOBYTE) return `${bytes} B`
  if (bytes < MEGABYTE) return `${(bytes / KILOBYTE).toFixed(1)} KB`
  return `${(bytes / MEGABYTE).toFixed(2)} MB`
}
