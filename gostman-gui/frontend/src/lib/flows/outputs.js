import { SCOPE_SESSION } from '../scripting/scopes'
import { DEFAULT_INDEX_NAME, DEFAULT_ITEM_NAME, STEP_FOR_EACH, STEP_REQUEST, STEP_SET, walkSteps } from './model'
import { stepTitle } from './validate'

export const SOURCE_LOOP = 'flowLoop'
export const SOURCE_SEND = 'flowSend'

const entry = (name, source, owner) => [name, { value: '', typed: '', secret: false, source, owner }]

const namedOnly = (names) => names.filter((name) => name.trim() !== '')

function stepOutputs(step, requests, current) {
  const owner = stepTitle(step, requests)
  if (step.kind === STEP_SET) return namedOnly(step.values.map((value) => value.name)).map((name) => entry(name, SCOPE_SESSION, owner))
  if (step.kind === STEP_FOR_EACH) return [step.as || DEFAULT_ITEM_NAME, step.indexAs || DEFAULT_INDEX_NAME].map((name) => entry(name, SOURCE_LOOP, owner))
  if (step.kind === STEP_REQUEST && step.id === current?.id) return namedOnly(Object.keys(step.variables)).map((name) => entry(name, SOURCE_SEND, owner))
  return []
}

export function flowVariables(steps, requests, current) {
  const found = []
  walkSteps(steps, (step) => found.push(...stepOutputs(step, requests, current)))
  return new Map(found)
}
