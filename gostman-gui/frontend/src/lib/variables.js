const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/g
const OPEN_REFERENCE = /\{\{\s*([\w.-]*)$/
const SECRET_NAME = /token|secret|key|password|auth/i

export const MASKED_VALUE = "••••••••"
export const MAX_SUGGESTIONS = 50

export const looksSecret = (name) => SECRET_NAME.test(name)

export function findReferences(text) {
  return Array.from(text.matchAll(TOKEN), (match) => ({
    name: match[1],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

export function describeReference(name, variables) {
  const defined = variables.has(name)
  const value = defined ? variables.get(name) : ""
  return { name, defined, value, shown: defined && looksSecret(name) ? MASKED_VALUE : value }
}

export function openReference(text, caret) {
  const match = OPEN_REFERENCE.exec(text.slice(0, caret))
  if (!match) return null
  return { start: caret - match[0].length, query: match[1] }
}

export function suggestNames(variables, query) {
  const needle = query.toLowerCase()
  const names = Array.from(variables.keys()).filter((name) => name.toLowerCase().includes(needle))
  const rank = (name) => (name.toLowerCase().startsWith(needle) ? 0 : 1)
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, MAX_SUGGESTIONS)
}

export function applyCompletion(text, reference, caret, name) {
  const closing = /^\s*\}\}/.exec(text.slice(caret))
  const end = caret + (closing ? closing[0].length : 0)
  const insertion = `{{${name}}}`
  return { text: text.slice(0, reference.start) + insertion + text.slice(end), caret: reference.start + insertion.length }
}
