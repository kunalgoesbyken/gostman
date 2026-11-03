import { SCOPE_SESSION } from '../scripting/scopes'
import { DEFAULT_INDEX_NAME, DEFAULT_ITEM_NAME, STEP_FLOW, STEP_FOR_EACH, STEP_REPEAT, STEP_REQUEST, STEP_SET, walkSteps } from './model'
import { stepTitle } from './validate'

export const SOURCE_LOOP = 'flowLoop'
export const SOURCE_SEND = 'flowSend'

const SENDING_KINDS = [STEP_REQUEST, STEP_FLOW]

const entry = (name, source, owner) => [name, { value: '', typed: '', secret: false, source, owner }]

const namedOnly = (names) => names.filter((name) => name.trim() !== '')

const LOOP_NAMES = {
  [STEP_FOR_EACH]: (step) => [step.as || DEFAULT_ITEM_NAME, step.indexAs || DEFAULT_INDEX_NAME],
  [STEP_REPEAT]: (step) => [step.indexAs || DEFAULT_INDEX_NAME],
}

function stepOutputs(step, requests, current) {
  const owner = stepTitle(step, requests)
  if (step.kind === STEP_SET) return namedOnly(step.values.map((value) => value.name)).map((name) => entry(name, SCOPE_SESSION, owner))
  if (LOOP_NAMES[step.kind]) return LOOP_NAMES[step.kind](step).map((name) => entry(name, SOURCE_LOOP, owner))
  if (SENDING_KINDS.includes(step.kind) && step.id === current?.id) return namedOnly(Object.keys(step.variables)).map((name) => entry(name, SOURCE_SEND, owner))
  return []
}

export function flowVariables(steps, requests, current) {
  const found = []
  walkSteps(steps, (step) => found.push(...stepOutputs(step, requests, current)))
  return new Map(found)
}
