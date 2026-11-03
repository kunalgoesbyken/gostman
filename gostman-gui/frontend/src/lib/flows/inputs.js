import { isPlainObject } from '../dataUtils'
import { FLOW_ENGINE_TEXT as TEXT } from '../flowsText'
import { foldQueryParams, readParamRows, writeParamRows } from '../queryString'
import { isBlankRow, isFileRow, parseRows, serializeRows } from '../rows'
import { asText } from './values'

export const INPUT_HEADER = 'header'
export const INPUT_QUERY = 'query'
export const INPUT_BODY = 'body'
export const INPUT_FORM = 'form'
export const INPUT_VARIABLE = 'variable'
export const INPUT_TARGETS = [INPUT_HEADER, INPUT_QUERY, INPUT_BODY, INPUT_FORM, INPUT_VARIABLE]

const BODY_JSON = 'json'
const FORM_BODIES = ['form', 'multipart']
const JSON_BODIES = ['', BODY_JSON]
const JSON_INDENT = 2
const ROOT = '$'
const PATH_PART = /^(?:\.([^.[\]]+)|\[(\d+)\]|\['((?:[^'\\]|\\.)*)'\]|\["((?:[^"\\]|\\.)*)"\])/

export const acceptsBody = (bodyType) => JSON_BODIES.includes(bodyType || '')

export const acceptsForm = (bodyType) => FORM_BODIES.includes(bodyType || '')

const unescaped = (text) => text.replace(/\\(.)/g, '$1')

export function bodyPath(name) {
  const written = name.trim()
  let rest = written.startsWith(ROOT) ? written.slice(ROOT.length) : `.${written}`
  const segments = []
  while (rest !== '') {
    const part = PATH_PART.exec(rest)
    if (!part) return null
    segments.push(part[2] !== undefined ? Number(part[2]) : unescaped(part[1] ?? part[3] ?? part[4]))
    rest = rest.slice(part[0].length)
  }
  return segments
}

const success = (request) => ({ ok: true, request })

const failure = (message) => ({ ok: false, message })

const sameText = (first, second) => first === second

const sameHeader = (first, second) => first.toLowerCase() === second.toLowerCase()

const isNamed = (row, name, matches) => row.enabled && !isFileRow(row) && matches(row.key, name)

export function placeRow(rows, name, value, matches) {
  const at = rows.findIndex((row) => isNamed(row, name, matches))
  if (at === -1) return [...rows.filter((row) => !isBlankRow(row)), { key: name, value, enabled: true }]
  return rows.flatMap((row, position) => {
    if (position === at) return [{ ...row, value }]
    return isNamed(row, name, matches) ? [] : [row]
  })
}

function applyHeader(request, { name, value }) {
  return success({ ...request, headers: serializeRows(placeRow(parseRows(request.headers), name, asText(value), sameHeader)) })
}

function applyQuery(request, { name, value }) {
  const folded = foldQueryParams(request.url || '', request.queryParams)
  const rows = placeRow(readParamRows(folded.url, folded.queryParams), name, asText(value), sameText)
  return success({ ...request, ...writeParamRows(folded.url, rows) })
}

function applyForm(request, { name, value }) {
  if (!acceptsForm(request.bodyType)) return failure(TEXT.inputNotForm(name))
  return success({ ...request, body: serializeRows(placeRow(parseRows(request.body), name, asText(value), sameText)) })
}

const ownChild = (node, key) => (node !== null && typeof node === 'object' && Object.hasOwn(node, key) ? node[key] : undefined)

function holderFor(node, key) {
  if (typeof key === 'number') return Array.isArray(node) ? node.slice() : []
  return isPlainObject(node) ? { ...node } : {}
}

function placeValue(node, segments, value, name) {
  if (segments.length === 0) return value
  const [key, ...rest] = segments
  const holder = holderFor(node, key)
  if (typeof key === 'number' && key > holder.length) throw new Error(TEXT.inputPastEnd(name, holder.length))
  const child = placeValue(ownChild(holder, key), rest, value, name)
  Object.defineProperty(holder, key, { value: child, enumerable: true, writable: true, configurable: true })
  return holder
}

function parsedBody(text) {
  if (text.trim() === '') return { ok: true, value: {} }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch {
    return { ok: false }
  }
}

function applyBody(request, { name, value }) {
  const segments = bodyPath(name)
  if (!segments) return failure(TEXT.inputBadPath(name))
  if (!acceptsBody(request.bodyType)) return failure(TEXT.inputNotJson(name))
  const body = parsedBody(request.body || '')
  if (!body.ok) return failure(TEXT.inputBodyNotJson(name))
  try {
    const placed = placeValue(body.value, segments, value, name)
    return success({ ...request, bodyType: BODY_JSON, body: JSON.stringify(placed, null, JSON_INDENT) })
  } catch (error) {
    return failure(error.message)
  }
}

const APPLY = {
  [INPUT_HEADER]: applyHeader,
  [INPUT_QUERY]: applyQuery,
  [INPUT_FORM]: applyForm,
  [INPUT_BODY]: applyBody,
}

export function applyInputs(request, inputs) {
  let applied = success(request)
  for (const input of inputs || []) {
    const apply = APPLY[input.target]
    if (apply) applied = apply(applied.request, input)
    if (!applied.ok) return applied
  }
  return applied
}

const resolvedValue = (input, value) => (input.target === INPUT_BODY ? value : asText(value))

export function resolveInputs(inputs, read) {
  const resolved = []
  for (const input of inputs || []) {
    const found = input.value !== undefined ? { ok: true, value: input.value } : read(input)
    if (!found.ok) return found
    resolved.push({ target: input.target, name: input.name, value: resolvedValue(input, found.value) })
  }
  const variables = Object.fromEntries(resolved.filter((input) => input.target === INPUT_VARIABLE).map((input) => [input.name, input.value]))
  return { ok: true, inputs: resolved, variables }
}
