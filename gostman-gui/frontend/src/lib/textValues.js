export function someText(value, test) {
  if (typeof value === 'string') return test(value)
  if (Array.isArray(value)) return value.some((item) => someText(item, test))
  if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => test(key) || someText(item, test))
  return false
}

export function mapText(value, change) {
  if (typeof value === 'string') return change(value)
  if (Array.isArray(value)) return value.map((item) => mapText(item, change))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [change(key), mapText(item, change)]))
  return value
}
