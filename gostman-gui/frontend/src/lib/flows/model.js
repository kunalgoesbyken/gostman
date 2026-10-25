import { isPlainObject } from '../dataUtils'
import { normalizeAssertions } from '../scripting/assertions'

export const STEP_REQUEST = 'request'
export const STEP_SET = 'set'
export const STEP_IF = 'if'
export const STEP_FOR_EACH = 'forEach'
export const STEP_DELAY = 'delay'
export const STEP_END = 'end'
export const STEP_KINDS = [STEP_REQUEST, STEP_SET, STEP_IF, STEP_FOR_EACH, STEP_DELAY, STEP_END]

export const END_TARGET = 'end'
export const OUTCOME_PASSED = 'passed'
export const OUTCOME_FAILED = 'failed'
export const OUTCOMES = [OUTCOME_PASSED, OUTCOME_FAILED]

export const SOURCE_BODY = 'body'
export const SOURCE_HEADER = 'header'
export const SOURCE_STATUS = 'status'
export const VALUE_SOURCES = [SOURCE_BODY, SOURCE_HEADER, SOURCE_STATUS]

export const CONDITION_RESPONSE = 'response'
export const CONDITION_VARIABLES = 'variables'
export const CONDITION_SOURCES = [CONDITION_RESPONSE, CONDITION_VARIABLES]

export const MATCH_ALL = 'all'
export const MATCH_ANY = 'any'
export const MATCHES = [MATCH_ALL, MATCH_ANY]

export const TARGET_FIELDS = ['next', 'onFailure', 'then', 'else']

export const DEFAULT_MAX_SENDS = 1000
export const MAX_SENDS_CAP = 10000
export const MAX_ATTEMPTS = 50
export const MAX_DELAY_MS = 600000
export const DEFAULT_DELAY_MS = 1000
export const DEFAULT_ITEM_NAME = 'item'
export const DEFAULT_INDEX_NAME = 'index'
const MAX_NESTING = 8

const text = (value) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

const trimmed = (value) => text(value).trim()

const whole = (value, lowest, highest, fallback) => {
  const number = Math.trunc(Number(value))
  return Number.isFinite(number) && value !== '' && value !== null ? Math.min(Math.max(number, lowest), highest) : fallback
}

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback)

const listOf = (value) => (Array.isArray(value) ? value.filter(isPlainObject) : [])

const textMap = (value) => (
  isPlainObject(value)
    ? Object.fromEntries(Object.entries(value).map(([name, raw]) => [name.trim(), text(raw)]).filter(([name]) => name !== ''))
    : {}
)

const retryOf = (raw) => {
  const retry = isPlainObject(raw) ? raw : {}
  return {
    times: whole(retry.times, 1, MAX_ATTEMPTS, 1),
    delayMs: whole(retry.delayMs, 0, MAX_DELAY_MS, 0),
    until: normalizeAssertions(retry.until),
  }
}

const valueOf = (raw) => {
  const name = trimmed(raw.name)
  const step = trimmed(raw.step)
  if (step === '' && !VALUE_SOURCES.includes(raw.source)) return { name, value: text(raw.value) }
  return { name, step, source: oneOf(raw.source, VALUE_SOURCES, SOURCE_BODY), path: trimmed(raw.path) }
}

const FIELDS = {
  [STEP_REQUEST]: (raw) => ({
    request: trimmed(raw.request),
    requestId: trimmed(raw.requestId),
    variables: textMap(raw.variables),
    retry: retryOf(raw.retry),
    onFailure: trimmed(raw.onFailure),
  }),
  [STEP_SET]: (raw) => ({ values: listOf(raw.values).map(valueOf) }),
  [STEP_IF]: (raw) => ({
    source: oneOf(raw.source, CONDITION_SOURCES, CONDITION_RESPONSE),
    step: trimmed(raw.step),
    match: oneOf(raw.match, MATCHES, MATCH_ALL),
    conditions: normalizeAssertions(raw.conditions),
    then: trimmed(raw.then),
    else: trimmed(raw.else),
  }),
  [STEP_FOR_EACH]: (raw, depth) => ({
    step: trimmed(raw.step),
    path: trimmed(raw.path),
    as: trimmed(raw.as) || DEFAULT_ITEM_NAME,
    indexAs: trimmed(raw.indexAs) || DEFAULT_INDEX_NAME,
    steps: depth < MAX_NESTING ? normalizeList(raw.steps, depth + 1) : [],
  }),
  [STEP_DELAY]: (raw) => ({ ms: whole(raw.ms, 0, MAX_DELAY_MS, DEFAULT_DELAY_MS) }),
  [STEP_END]: (raw) => ({ outcome: oneOf(raw.outcome, OUTCOMES, OUTCOME_PASSED), message: text(raw.message) }),
}

const fieldsOf = (kind) => FIELDS[kind] || (() => ({}))

const normalizeStep = (raw, depth) => {
  const kind = trimmed(raw.kind) || STEP_REQUEST
  return { id: trimmed(raw.id), kind, label: text(raw.label), ...fieldsOf(kind)(raw, depth), next: trimmed(raw.next) }
}

function normalizeList(raw, depth) {
  return listOf(raw).map((step) => normalizeStep(step, depth))
}

export function walkSteps(steps, visit, parent = '') {
  steps.forEach((step, position) => {
    visit(step, { list: steps, position, parent })
    if (step.kind === STEP_FOR_EACH) walkSteps(step.steps, visit, step.id)
  })
}

export function mapSteps(steps, change) {
  return steps.map((step) => {
    const changed = change(step)
    return changed.kind === STEP_FOR_EACH ? { ...changed, steps: mapSteps(changed.steps, change) } : changed
  })
}

export const allStepIds = (steps) => {
  const ids = []
  walkSteps(steps, (step) => ids.push(step.id))
  return ids
}

export function slugOf(name, fallback) {
  const characters = Array.from(text(name).toLowerCase())
  const kept = characters.map((character) => (character.toUpperCase() !== character || (character >= '0' && character <= '9') ? character : '-'))
  const slug = kept.join('').split('-').filter(Boolean).join('-').slice(0, 40)
  return slug || fallback
}

export function uniqueId(wanted, taken) {
  const isReserved = wanted === END_TARGET || Object.hasOwn(Object.prototype, wanted)
  const base = isReserved ? `${wanted}-step` : wanted
  if (!taken.has(base)) return base
  let number = 2
  while (taken.has(`${base}-${number}`)) number += 1
  return `${base}-${number}`
}

const withUniqueIds = (steps) => {
  const taken = new Set()
  return mapSteps(steps, (step) => {
    const id = uniqueId(step.id || step.kind, taken)
    taken.add(id)
    return { ...step, id }
  })
}

export function normalizeFlow(raw) {
  const flow = isPlainObject(raw) ? raw : {}
  return {
    id: trimmed(flow.id),
    name: text(flow.name),
    description: text(flow.description),
    maxSends: whole(flow.maxSends, 1, MAX_SENDS_CAP, DEFAULT_MAX_SENDS),
    steps: withUniqueIds(normalizeList(flow.steps, 0)),
  }
}

const isEmptyValue = (value) => (
  value === '' || value === null || value === undefined
  || (Array.isArray(value) && value.length === 0)
  || (isPlainObject(value) && Object.keys(value).length === 0)
)

const isDefaultRetry = (retry) => retry.times <= 1 && retry.until.length === 0

function compact(value) {
  if (Array.isArray(value)) return value.map(compact)
  if (!isPlainObject(value)) return value
  const kept = Object.entries(value)
    .filter(([key, field]) => !(key === 'retry' && isPlainObject(field) && isDefaultRetry(field)) && !(key === 'enabled' && field === true))
    .map(([key, field]) => [key, compact(field)])
    .filter(([, field]) => !isEmptyValue(field))
  return Object.fromEntries(kept)
}

export const compactFlow = (flow) => compact(normalizeFlow(flow))

export function indexSteps(steps) {
  const index = new Map()
  walkSteps(steps, (step, place) => index.set(step.id, { step, ...place }))
  return index
}

export function loopsAround(index, id) {
  const loops = []
  for (let parent = index.get(id)?.parent; parent; parent = index.get(parent)?.parent) loops.unshift(parent)
  return loops
}

export const targetsOf = (step) => TARGET_FIELDS.filter((field) => typeof step[field] === 'string' && step[field] !== '').map((field) => [field, step[field]])
