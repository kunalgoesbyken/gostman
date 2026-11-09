import { isPlainObject, parseJSON } from '../dataUtils'
import { placeholderNames } from '../placeholders'
import { isJsonNumber, parseExact, stringifyExact } from '../exactJson'
import { TYPE_BOOLEAN, TYPE_JSON, TYPE_NUMBER, TYPE_STRING } from '../requestVariables'

export { TYPE_STRING }
export const VARIABLE_TYPES = [TYPE_STRING, TYPE_NUMBER, TYPE_BOOLEAN, TYPE_JSON]

const BOOLEANS = ['true', 'false']

const text = (value) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

export function normalizeDeclared(raw) {
  const declared = isPlainObject(raw) ? raw : {}
  const isInput = declared.input === true
  return {
    name: text(declared.name).trim(),
    type: VARIABLE_TYPES.includes(declared.type) ? declared.type : TYPE_STRING,
    value: text(declared.value),
    ...(isInput && { input: true }),
    ...(isInput && declared.required === true && { required: true }),
  }
}

function parsedJson(written) {
  try {
    return { ok: true, text: stringifyExact(parseExact(written)) }
  } catch {
    return { ok: false }
  }
}

function asNumber(written) {
  const trimmed = written.trim()
  return isJsonNumber(trimmed) && Number.isFinite(Number(trimmed)) ? { ok: true, text: trimmed } : { ok: false }
}

function asBoolean(written) {
  const lowered = written.trim().toLowerCase()
  return BOOLEANS.includes(lowered) ? { ok: true, text: lowered } : { ok: false }
}

const COERCE = {
  [TYPE_NUMBER]: asNumber,
  [TYPE_BOOLEAN]: asBoolean,
  [TYPE_JSON]: parsedJson,
}

export const coerce = (written, type) => (COERCE[type] ? COERCE[type](text(written)) : { ok: true, text: text(written) })

export const namedDeclared = (flow) => (flow.variables || []).filter((declared) => declared.name !== '')

export const declaredTypes = (flow) => Object.fromEntries(namedDeclared(flow).map((declared) => [declared.name, declared.type]))

export function declarationOrder(declared, isFixed) {
  const waiting = new Map(declared.map((entry) => [entry.name, entry]))
  const waitsFor = (entry) => !isFixed(entry) && placeholderNames(entry.value).some((name) => name !== entry.name && waiting.has(name))
  const order = []
  while (waiting.size > 0) {
    const ready = [...waiting.values()].filter((entry) => !waitsFor(entry))
    if (ready.length === 0) return { order, looped: [...waiting.keys()] }
    for (const entry of ready) {
      order.push(entry)
      waiting.delete(entry.name)
    }
  }
  return { order, looped: [] }
}

export const flowInputs = (flow) => namedDeclared(flow).filter((declared) => declared.input)

export const typedValue = (written, type) => (type === TYPE_STRING ? written : parseJSON(written, written))
