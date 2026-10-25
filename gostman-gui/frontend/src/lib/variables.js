import { fillPlaceholders } from "./placeholders.js"
import { isSensitiveName } from "./sensitiveNames.js"
import { ORIGIN_UNKNOWN, secretOrigin } from "./secretOrigins.js"
import { colorTriplet } from "./swatches.js"
import { mapText, someText, textsIn } from "./textValues.js"
import { DYNAMIC_PREFIX, DYNAMIC_VARIABLES, FAKER_VARIABLES, SOURCE_LABELS, callsFile, describeDynamic, isDynamicName, isFakerQuery, isFileName, isPromptName } from "./variableNames.js"

const TOKEN = /\{\{\s*([^{}]*?)\s*\}\}/gu
export const ENGINE_PLACEHOLDER = /\{\{([^}]+)\}\}/gu
const OPEN_REFERENCE = /\{\{\s*([\p{L}\p{N}_.$?-]*)$/u
const WORD_BEFORE_CARET = /[\p{L}\p{N}_.$]*$/u
export const CLOSING_REFERENCE = /^\s*\}\}/
export const SECRET_TINT = "--gm-secret"

export const MASKED_VALUE = "••••••••"
export const MAX_SUGGESTIONS = 50

export const VARIABLE_TEXT = {
  dynamic: "generated each time the request is sent",
  prompt: "asked for when the request is sent",
  undefinedName: "is not defined in the active environment",
  secret: "secret",
  resolvesTo: "resolves to",
  through: (names) => `through ${names.join(", ")}`,
}

export const looksSecret = isSensitiveName

export function findReferences(text) {
  return Array.from(text.matchAll(TOKEN), (match) => ({
    name: match[1],
    start: match.index,
    end: match.index + match[0].length,
  }))
}

function parsedJSON(text) {
  try {
    return { value: JSON.parse(text) }
  } catch {
    return null
  }
}

const callsFileDirectly = (text) => Array.from(text.matchAll(ENGINE_PLACEHOLDER), ([, inner]) => inner).some(callsFile)

export const holdsOnlyReferences = (text) => text.replace(TOKEN, '').replace(OPEN_REFERENCE, '').trim() === ''

export function hasFileReference(text) {
  if (callsFileDirectly(text)) return true
  const parsed = parsedJSON(text)
  return Boolean(parsed) && someText(parsed.value, hasFileReference)
}

export function fileReferencesIn(text) {
  const direct = Array.from(text.matchAll(ENGINE_PLACEHOLDER), ([, inner]) => inner.trim()).filter(callsFile)
  const parsed = parsedJSON(text)
  return parsed ? [...direct, ...textsIn(parsed.value).flatMap(fileReferencesIn)] : direct
}

export function withoutFileReferences(text) {
  const stripped = text.replace(ENGINE_PLACEHOLDER, (match, inner) => (callsFile(inner) ? "" : match))
  if (!hasFileReference(stripped)) return stripped
  return JSON.stringify(mapText(parsedJSON(stripped).value, withoutFileReferences))
}

export const isDefined = (name, variables) => variables.has(name) || isDynamicName(name) || isPromptName(name)

const builtInText = (name, kind) => (kind === "dynamic" && describeDynamic(name)) || VARIABLE_TEXT[kind]

function builtInKind(name) {
  if (isDynamicName(name)) return "dynamic"
  return isPromptName(name) ? "prompt" : null
}

const isSecretName = (name, variables) => variables.details?.get(name)?.secret === true || looksSecret(name)

const NOT_COMPOSED = { resolved: "", chain: [] }

function composition(value, variables) {
  const chain = []
  const resolved = fillPlaceholders(value, (name) => {
    if (!variables.has(name)) return undefined
    if (!chain.includes(name)) chain.push(name)
    return isSecretName(name, variables) ? MASKED_VALUE : variables.get(name)
  })
  return chain.length > 0 ? { resolved, chain } : NOT_COMPOSED
}

export function describeReference(name, variables) {
  const kind = variables.has(name) ? null : builtInKind(name)
  if (kind) return { name, defined: true, value: "", shown: builtInText(name, kind), secret: false, kind, ...NOT_COMPOSED }
  const defined = variables.has(name)
  const value = defined ? variables.get(name) : ""
  const detail = variables.details?.get(name)
  const secret = defined && isSecretName(name, variables)
  const source = detail ? [SOURCE_LABELS[detail.source], detail.owner].filter(Boolean).join(": ") : ""
  const origin = secretOrigin(detail?.ref, variables.connections)
  const composed = defined && !secret ? composition(value, variables) : NOT_COMPOSED
  return { name, defined, value, shown: secret ? MASKED_VALUE : value, secret, kind: null, source, origin, ...composed }
}

export function referenceLook(name, variables) {
  const origin = secretOrigin(variables.details?.get(name)?.ref, variables.connections)
  if (origin?.state === ORIGIN_UNKNOWN) return { className: "gm-var-missing" }
  if (origin) return { className: "gm-var-secret", attributes: { "data-secret-state": origin.state }, tint: colorTriplet(origin.color) }
  return { className: isDefined(name, variables) ? "gm-var-ok" : "gm-var-missing" }
}

const wordBefore = (text, caret) => WORD_BEFORE_CARET.exec(text.slice(0, caret))[0]

export function openReference(text, caret) {
  const match = OPEN_REFERENCE.exec(text.slice(0, caret))
  if (match) return { start: caret - match[0].length, query: match[1] }
  const word = wordBefore(text, caret)
  return isFakerQuery(word) ? { start: caret - word.length, query: word } : null
}

export function referenceAtCaret(text, caret, explicit) {
  const open = openReference(text, caret)
  if (open || !explicit) return open
  const word = wordBefore(text, caret)
  return { start: caret - word.length, query: word }
}

const GENERATED_VARIABLES = DYNAMIC_VARIABLES.filter((name) => !isFileName(name))

function builtInNames(query, fileReads, explicit) {
  if (isFakerQuery(query)) return FAKER_VARIABLES
  if (!query.startsWith(DYNAMIC_PREFIX) && !(explicit && query === "")) return []
  return fileReads ? DYNAMIC_VARIABLES : GENERATED_VARIABLES
}

export function suggestNames(variables, query, { fileReads = true, explicit = false } = {}) {
  const needle = query.toLowerCase()
  const own = Array.from(variables.keys())
  const builtIn = builtInNames(query, fileReads, explicit).filter((name) => !variables.has(name))
  const rank = (name) => (name.toLowerCase().startsWith(needle) ? 0 : 1)
  const ranked = (names) => names.filter((name) => name.toLowerCase().includes(needle)).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  return [...ranked(own), ...ranked(builtIn)].slice(0, MAX_SUGGESTIONS)
}

export function applyCompletion(text, reference, caret, name) {
  const closing = CLOSING_REFERENCE.exec(text.slice(caret))
  const end = caret + (closing ? closing[0].length : 0)
  const insertion = `{{${name}}}`
  return { text: text.slice(0, reference.start) + insertion + text.slice(end), caret: reference.start + insertion.length }
}
