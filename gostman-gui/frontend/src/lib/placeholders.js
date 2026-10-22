import { isPlainObject, parseJSON } from './dataUtils'

const PLACEHOLDER = /\{\{([^}]+)\}\}/g

const asText = (value) => (typeof value === 'object' ? JSON.stringify(value) : String(value))

const isDefined = (value) => value !== null && value !== undefined

export const variableMap = (variables) => new Map(
  Object.entries(variables).filter(([, value]) => isDefined(value)).map(([name, value]) => [name, asText(value)])
)

export function parseVariableMap(json) {
  const parsed = json.trim() === '' ? {} : parseJSON(json, null)
  return isPlainObject(parsed) ? variableMap(parsed) : null
}

export function substitutePlaceholders(text, variables) {
  return text.replace(PLACEHOLDER, (placeholder, name) => variables.get(name.trim()) ?? placeholder)
}

export const placeholderNames = (text) => Array.from(text.matchAll(PLACEHOLDER), ([, name]) => name.trim())
