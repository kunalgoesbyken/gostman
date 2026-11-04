import { isPlainObject, parseJSON } from '../dataUtils'

export const TYPE_STRING = 'string'
export const TYPE_NUMBER = 'number'
export const TYPE_BOOLEAN = 'boolean'
export const TYPE_JSON = 'json'
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
    return { ok: true, text: JSON.stringify(JSON.parse(written)) }
  } catch {
    return { ok: false }
  }
}

const DECIMAL = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/

function asNumber(written) {
  const trimmed = written.trim()
  return DECIMAL.test(trimmed) && Number.isFinite(Number(trimmed)) ? { ok: true, text: trimmed } : { ok: false }
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

export const flowInputs = (flow) => namedDeclared(flow).filter((declared) => declared.input)

export const typedValue = (written, type) => (type === TYPE_STRING ? written : parseJSON(written, written))
