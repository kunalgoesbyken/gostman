import { isPlainObject, parseJSON } from './dataUtils'

const ONE_PLACEHOLDER = /\{\{([^}]+)\}\}/
const PLACEHOLDER = new RegExp(ONE_PLACEHOLDER.source, 'g')

const asText = (value) => (typeof value === 'object' ? JSON.stringify(value) : String(value))

const isDefined = (value) => value !== null && value !== undefined

export const variableMap = (variables) => new Map(
  Object.entries(variables).filter(([, value]) => isDefined(value)).map(([name, value]) => [name, asText(value)])
)

function readVariableMap(json) {
  const parsed = json.trim() === '' ? {} : parseJSON(json, null)
  return isPlainObject(parsed) ? variableMap(parsed) : null
}

let lastParsed = { json: null, variables: null }

export function parseVariableMap(json) {
  if (json !== lastParsed.json) lastParsed = { json, variables: readVariableMap(json) }
  return lastParsed.variables
}

const MAX_NESTING = 8
const MAX_EXPANSIONS = 10000

const hasPlaceholder = (text) => ONE_PLACEHOLDER.test(text)

function fill(text, valueOf, filling, work) {
  return text.replace(PLACEHOLDER, (placeholder, raw) => {
    const name = raw.trim()
    const value = valueOf(name)
    if (value === undefined) return placeholder
    if (!hasPlaceholder(value)) return value
    if (filling.includes(name) || filling.length >= MAX_NESTING || work.spent >= MAX_EXPANSIONS) return placeholder
    work.spent += 1
    return fill(value, valueOf, [...filling, name], work)
  })
}

export const fillPlaceholders = (text, valueOf) => fill(text, valueOf, [], { spent: 0 })

export const substitutePlaceholders = (text, variables) => fillPlaceholders(text, (name) => variables.get(name))

export const placeholderNames = (text) => Array.from(text.matchAll(PLACEHOLDER), ([, name]) => name.trim())
