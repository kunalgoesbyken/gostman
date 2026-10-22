export function parseJSON(text) {
  try {
    return { value: JSON.parse(text) }
  } catch {
    return null
  }
}

export const pretty = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))

export function jsonOrText(text) {
  const parsed = parseJSON(text)
  return parsed ? parsed.value : text
}
