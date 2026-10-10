import { isPlainObject, parseJSON } from './dataUtils'

const PLACEHOLDER = /\{\{([^}]+)\}\}/g

const asText = (value) => (typeof value === 'object' ? JSON.stringify(value) : String(value))

export function parseVariableMap(json) {
  const parsed = json.trim() === '' ? {} : parseJSON(json, null)
  if (!isPlainObject(parsed)) return null
  const defined = Object.entries(parsed).filter(([, value]) => value !== null)
  return new Map(defined.map(([name, value]) => [name, asText(value)]))
}

export function substitutePlaceholders(text, variables) {
  return text.replace(PLACEHOLDER, (placeholder, name) => variables.get(name.trim()) ?? placeholder)
}

export const placeholderNames = (text) => Array.from(text.matchAll(PLACEHOLDER), ([, name]) => name.trim())
