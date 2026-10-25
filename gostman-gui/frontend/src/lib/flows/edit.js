import { FLOW_TEMPLATE_TEXT } from '../flowsText'
import { BLANK_ASSERTION } from '../scripting/assertions'
import {
  CONDITION_RESPONSE, DEFAULT_DELAY_MS, DEFAULT_INDEX_NAME, DEFAULT_ITEM_NAME, DEFAULT_MAX_SENDS, END_TARGET, MATCH_ALL, OUTCOME_FAILED,
  OUTCOME_PASSED, STEP_DELAY, STEP_END, STEP_FOR_EACH, STEP_IF, STEP_REQUEST, STEP_SET, TARGET_FIELDS, allStepIds, compactFlow,
  indexSteps, mapSteps, normalizeFlow, slugOf, uniqueId,
} from './model'

const ROOT = ''

const createId = () => `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const blankFlow = (name) => normalizeFlow({ id: createId(), name, maxSends: DEFAULT_MAX_SENDS, steps: [] })

const STEP_FIELDS = {
  [STEP_REQUEST]: () => ({ request: '', requestId: '', variables: {}, retry: { times: 1, delayMs: 0, until: [] }, onFailure: '' }),
  [STEP_SET]: () => ({ values: [{ name: '', value: '' }] }),
  [STEP_IF]: () => ({ source: CONDITION_RESPONSE, step: '', match: MATCH_ALL, conditions: [{ ...BLANK_ASSERTION, expression: 'res.status', value: '200' }], then: '', else: '' }),
  [STEP_FOR_EACH]: () => ({ step: '', path: '$.items', as: DEFAULT_ITEM_NAME, indexAs: DEFAULT_INDEX_NAME, steps: [] }),
  [STEP_DELAY]: () => ({ ms: DEFAULT_DELAY_MS }),
  [STEP_END]: () => ({ outcome: OUTCOME_PASSED, message: '' }),
}

export function newStep(flow, kind, fields = {}, name = '') {
  const taken = new Set(allStepIds(flow.steps))
  const id = uniqueId(slugOf(name, kind), taken)
  return { id, kind, label: '', ...STEP_FIELDS[kind](), ...fields, next: '' }
}

const insertInto = (list, position, step) => [...list.slice(0, position), step, ...list.slice(position)]

function changeList(flow, parent, change) {
  if (parent === ROOT) return { ...flow, steps: change(flow.steps) }
  return { ...flow, steps: mapSteps(flow.steps, (step) => (step.id === parent ? { ...step, steps: change(step.steps) } : step)) }
}

export const insertStep = (flow, { parent = ROOT, position }, step) => changeList(flow, parent, (list) => insertInto(list, position, step))

export const updateStep = (flow, id, patch) => ({ ...flow, steps: mapSteps(flow.steps, (step) => (step.id === id ? { ...step, ...patch } : step)) })

const withoutTarget = (removed) => (step) => {
  const cleared = Object.fromEntries(TARGET_FIELDS.filter((field) => removed.has(step[field])).map((field) => [field, '']))
  return Object.keys(cleared).length > 0 ? { ...step, ...cleared } : step
}

const idsWithin = (step) => [step.id, ...(step.kind === STEP_FOR_EACH ? allStepIds(step.steps) : [])]

export function removeStep(flow, id) {
  const entry = indexSteps(flow.steps).get(id)
  if (!entry) return flow
  const removed = new Set(idsWithin(entry.step))
  const shortened = changeList(flow, entry.parent, (list) => list.filter((step) => step.id !== id))
  return { ...shortened, steps: mapSteps(shortened.steps, withoutTarget(removed)) }
}

export function moveStep(flow, id, offset) {
  const entry = indexSteps(flow.steps).get(id)
  const target = entry ? entry.position + offset : -1
  if (!entry || target < 0 || target >= entry.list.length) return flow
  return changeList(flow, entry.parent, (list) => insertInto(list.filter((step) => step.id !== id), target, entry.step))
}

function copyWithIds(step, taken) {
  const id = uniqueId(step.id, taken)
  taken.add(id)
  const copy = { ...step, id }
  return step.kind === STEP_FOR_EACH ? { ...copy, steps: step.steps.map((child) => copyWithIds(child, taken)) } : copy
}

export function duplicateStep(flow, id) {
  const entry = indexSteps(flow.steps).get(id)
  if (!entry) return { flow, id }
  const copy = copyWithIds(entry.step, new Set(allStepIds(flow.steps)))
  return { flow: insertStep(flow, { parent: entry.parent, position: entry.position + 1 }, copy), id: copy.id }
}

const renamedField = (value, from, to) => (value === from ? to : value)

function renamedReferences(step, from, to) {
  const renamed = { ...step }
  TARGET_FIELDS.forEach((field) => {
    if (typeof renamed[field] === 'string') renamed[field] = renamedField(renamed[field], from, to)
  })
  if (typeof renamed.step === 'string') renamed.step = renamedField(renamed.step, from, to)
  if (Array.isArray(renamed.values)) renamed.values = renamed.values.map((value) => (value.step === from ? { ...value, step: to } : value))
  return renamed
}

export function renameStep(flow, from, wanted) {
  const taken = new Set(allStepIds(flow.steps).filter((id) => id !== from))
  const to = uniqueId(slugOf(wanted, from), taken)
  if (to === from) return { flow, id: from }
  const steps = mapSteps(flow.steps, (step) => renamedReferences(step.id === from ? { ...step, id: to } : step, from, to))
  return { flow: { ...flow, steps }, id: to }
}

export const isFlowDirty = (draft, saved) => !saved || JSON.stringify(compactFlow(draft)) !== JSON.stringify(compactFlow(saved))

export function uniqueFlowName(wanted, flows) {
  const taken = new Set(flows.map((flow) => flow.name))
  if (!taken.has(wanted)) return wanted
  let number = 2
  while (taken.has(`${wanted} ${number}`)) number += 1
  return `${wanted} ${number}`
}

export const copiedFlow = (flow, name) => ({ ...normalizeFlow(flow), id: createId(), name })

export function exampleFlow(name) {
  const text = FLOW_TEMPLATE_TEXT
  return normalizeFlow({
    id: createId(),
    name,
    description: text.description,
    steps: [
      { id: 'login', kind: STEP_REQUEST, label: text.login },
      { id: 'keep-token', kind: STEP_SET, label: text.keepToken, values: [{ name: 'token', step: 'login', source: 'body', path: '$.token' }] },
      {
        id: 'order-ready',
        kind: STEP_REQUEST,
        label: text.waitForOrder,
        retry: { times: 5, delayMs: 1000, until: [{ expression: 'res.body.status', operator: 'eq', value: 'ready' }] },
        onFailure: 'cancel',
      },
      { id: 'done', kind: STEP_END, label: text.done, outcome: OUTCOME_PASSED },
      { id: 'cancel', kind: STEP_REQUEST, label: text.cancel },
      { id: 'cancelled', kind: STEP_END, label: text.cancelled, outcome: OUTCOME_FAILED, message: text.cancelledMessage },
    ],
  })
}

export { END_TARGET, ROOT as ROOT_LIST }
