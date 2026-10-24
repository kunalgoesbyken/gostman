import { isSensitiveName } from "./sensitiveNames.js"
import { DYNAMIC_PREFIX, DYNAMIC_VARIABLES, FAKER_VARIABLES, SOURCE_LABELS, describeDynamic, isDynamicName, isFakerQuery, isFileName, isPromptName } from "./variableNames.js"

const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/gu
const OPEN_REFERENCE = /\{\{\s*([\p{L}\p{N}_.$?-]*)$/u
const WORD_BEFORE_CARET = /[\p{L}\p{N}_.$]*$/u
export const CLOSING_REFERENCE = /^\s*\}\}/

export const MASKED_VALUE = "••••••••"
export const MAX_SUGGESTIONS = 50

export const VARIABLE_TEXT = {
  dynamic: "generated each time the request is sent",
  prompt: "asked for when the request is sent",
  undefinedName: "is not defined in the active environment",
  secret: "secret",
}

export const looksSecret = isSensitiveName

export function findReferences(text) {
  return Array.from(text.matchAll(TOKEN), (match) => ({
    name: match[1],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

export const hasFileReference = (text) => findReferences(text).some(({ name }) => isFileName(name))

export const withoutFileReferences = (text) => text.replace(TOKEN, (match, name) => (isFileName(name) ? "" : match))

export const isDefined = (name, variables) => variables.has(name) || isDynamicName(name) || isPromptName(name)

const builtInText = (name, kind) => (kind === "dynamic" && describeDynamic(name)) || VARIABLE_TEXT[kind]

function builtInKind(name) {
  if (isDynamicName(name)) return "dynamic"
  return isPromptName(name) ? "prompt" : null
}

export function describeReference(name, variables) {
  const kind = variables.has(name) ? null : builtInKind(name)
  if (kind) return { name, defined: true, value: "", shown: builtInText(name, kind), secret: false, kind }
  const defined = variables.has(name)
  const value = defined ? variables.get(name) : ""
  const detail = variables.details?.get(name)
  const secret = defined && (detail?.secret === true || looksSecret(name))
  const source = detail ? SOURCE_LABELS[detail.source] : ""
  return { name, defined, value, shown: secret ? MASKED_VALUE : value, secret, kind: null, source }
}

export function openReference(text, caret) {
  const before = text.slice(0, caret)
  const match = OPEN_REFERENCE.exec(before)
  if (match) return { start: caret - match[0].length, query: match[1] }
  const word = WORD_BEFORE_CARET.exec(before)[0]
  return isFakerQuery(word) ? { start: caret - word.length, query: word } : null
}

function builtInNames(query) {
  if (isFakerQuery(query)) return FAKER_VARIABLES
  return query.startsWith(DYNAMIC_PREFIX) ? DYNAMIC_VARIABLES : []
}

export function suggestNames(variables, query) {
  const needle = query.toLowerCase()
  const names = [...Array.from(variables.keys()), ...builtInNames(query)].filter((name) => name.toLowerCase().includes(needle))
  const rank = (name) => (name.toLowerCase().startsWith(needle) ? 0 : 1)
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, MAX_SUGGESTIONS)
}

export function applyCompletion(text, reference, caret, name) {
  const closing = CLOSING_REFERENCE.exec(text.slice(caret))
  const end = caret + (closing ? closing[0].length : 0)
  const insertion = `{{${name}}}`
  return { text: text.slice(0, reference.start) + insertion + text.slice(end), caret: reference.start + insertion.length }
}
