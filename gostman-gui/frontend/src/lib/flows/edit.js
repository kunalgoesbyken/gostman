import { FLOW_TEMPLATE_TEXT } from '../flowsText'
import { BLANK_ASSERTION } from '../scripting/assertions'
import {
  CONDITION_RESPONSE, CONTAINER_KINDS, DEFAULT_DELAY_MS, DEFAULT_INDEX_NAME, DEFAULT_ITEM_NAME, DEFAULT_MAX_SENDS, DEFAULT_PASSES, END_TARGET,
  MATCH_ALL, OUTCOME_FAILED, OUTCOME_PASSED, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_REPEAT, STEP_REQUEST, STEP_SET,
  STEP_SWITCH, allStepIds, compactFlow, indexSteps, innerSteps, mapSteps, normalizeFlow, retargeted, rewiredReads, slugOf, uniqueId,
} from './model'

const ROOT = ''

const createId = () => `flow-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const blankFlow = (name) => normalizeFlow({ id: createId(), name, maxSends: DEFAULT_MAX_SENDS, steps: [] })

const blankCondition = () => ({ ...BLANK_ASSERTION, expression: 'res.status', value: '200' })

export const blankCase = () => ({ label: '', match: MATCH_ALL, conditions: [blankCondition()], target: '' })

const STEP_FIELDS = {
  [STEP_REQUEST]: () => ({ request: '', requestId: '', variables: {}, inputs: [], retry: { times: 1, delayMs: 0, until: [] }, onFailure: '' }),
  [STEP_SET]: () => ({ values: [{ name: '', value: '' }] }),
  [STEP_IF]: () => ({ source: CONDITION_RESPONSE, step: '', match: MATCH_ALL, conditions: [blankCondition()], then: '', else: '' }),
  [STEP_SWITCH]: () => ({ source: CONDITION_RESPONSE, step: '', cases: [blankCase()], else: '' }),
  [STEP_FOR_EACH]: () => ({ step: '', path: '$.items', as: DEFAULT_ITEM_NAME, indexAs: DEFAULT_INDEX_NAME, steps: [] }),
  [STEP_REPEAT]: () => ({
    times: DEFAULT_PASSES, delayMs: 0, indexAs: DEFAULT_INDEX_NAME, source: CONDITION_RESPONSE, step: '', match: MATCH_ALL, until: [], onFailure: '', steps: [],
  }),
  [STEP_FLOW]: () => ({ flow: '', flowId: '', variables: {}, onFailure: '' }),
  [STEP_DELAY]: () => ({ ms: DEFAULT_DELAY_MS }),
  [STEP_END]: () => ({ outcome: OUTCOME_PASSED, message: '' }),
}

export function newStep(flow, kind, fields = {}, name = '') {
  const taken = new Set(allStepIds(flow.steps))
  const id = uniqueId(slugOf(name, kind), taken)
  return { id, kind, label: '', note: '', ...STEP_FIELDS[kind](), ...fields, next: '' }
}

const insertInto = (list, position, step) => [...list.slice(0, position), step, ...list.slice(position)]

function changeList(flow, parent, change) {
  if (parent === ROOT) return { ...flow, steps: change(flow.steps) }
  return { ...flow, steps: mapSteps(flow.steps, (step) => (step.id === parent ? { ...step, steps: change(step.steps) } : step)) }
}

export const insertStep = (flow, { parent = ROOT, position }, step) => changeList(flow, parent, (list) => insertInto(list, position, step))

export const updateStep = (flow, id, patch) => ({ ...flow, steps: mapSteps(flow.steps, (step) => (step.id === id ? { ...step, ...patch } : step)) })

const towards = (removed, continuation) => (step) => retargeted(step, (target) => (removed.has(target) ? continuation : target))

const idsWithin = (step) => [step.id, ...allStepIds(innerSteps(step))]

const successorOf = (entry) => entry.list[entry.position + 1]?.id || (entry.parent === ROOT ? END_TARGET : '')

const continuationOf = (entry, removed) => (entry.step.next && !removed.has(entry.step.next) ? entry.step.next : successorOf(entry))

export function removeStep(flow, id) {
  const entry = indexSteps(flow.steps).get(id)
  if (!entry) return flow
  const removed = new Set(idsWithin(entry.step))
  const shortened = changeList(flow, entry.parent, (list) => list.filter((step) => step.id !== id))
  return { ...shortened, steps: mapSteps(shortened.steps, towards(removed, continuationOf(entry, removed))) }
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
  return CONTAINER_KINDS.includes(step.kind) ? { ...copy, steps: step.steps.map((child) => copyWithIds(child, taken)) } : copy
}

export function duplicateStep(flow, id) {
  const entry = indexSteps(flow.steps).get(id)
  if (!entry) return { flow, id }
  const copy = copyWithIds(entry.step, new Set(allStepIds(flow.steps)))
  return { flow: insertStep(flow, { parent: entry.parent, position: entry.position + 1 }, copy), id: copy.id }
}

const renamedReferences = (from, to) => {
  const renamed = (id) => (id === from ? to : id)
  return (step) => rewiredReads(retargeted({ ...step, id: renamed(step.id) }, renamed), renamed)
}

export function renameStep(flow, from, wanted) {
  const taken = new Set(allStepIds(flow.steps).filter((id) => id !== from))
  const to = uniqueId(slugOf(wanted, from), taken)
  if (to === from) return { flow, id: from }
  const steps = mapSteps(flow.steps, renamedReferences(from, to))
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
