import { FLOW_CANVAS_TEXT as TEXT } from '../flowsText'
import { isActiveAssertion, titleOf } from '../scripting/assertions'
import {
  CONDITION_VARIABLES, END_TARGET, STEP_DELAY, STEP_END, STEP_FOR_EACH, STEP_IF, STEP_REQUEST, STEP_SET, TARGET_FIELDS,
} from './model'
import { resolveRequest, stepTitle } from './validate'

const firstAndMore = (conditions) => {
  const active = conditions.filter(isActiveAssertion)
  return active.length > 0 ? { first: titleOf(active[0]), more: active.length - 1 } : null
}

const referenceTitle = (index, id, requests) => (index.get(id) ? stepTitle(index.get(id).step, requests) : id)

const LINES = {
  [STEP_REQUEST]: (step, { requests }) => {
    const request = resolveRequest(step, requests)
    const until = firstAndMore(step.retry.until)
    return [
      request ? { method: request.method, text: request.path } : { text: step.request || TEXT.noRequest, muted: true },
      ...(step.retry.times > 1 ? [{ text: TEXT.retry(step.retry.times, step.retry.delayMs) }] : []),
      ...(until ? [{ text: TEXT.until(until.first, until.more), mono: true }] : []),
    ]
  },
  [STEP_SET]: (step, { index, requests }) => {
    if (step.values.length === 0) return [{ text: TEXT.noValues, muted: true }]
    return step.values.map((value) => ({
      text: TEXT.sets(value.name, value.step ? TEXT.fromResponse(value.source, value.path, referenceTitle(index, value.step, requests)) : TEXT.fromTemplate(value.value)),
      mono: true,
    }))
  },
  [STEP_IF]: (step) => {
    const condition = firstAndMore(step.conditions)
    if (!condition) return [{ text: TEXT.noCondition, muted: true }]
    const described = TEXT.condition(condition.first, condition.more, step.match)
    return [{ text: step.source === CONDITION_VARIABLES ? TEXT.variablesCondition(described) : described, mono: true }]
  },
  [STEP_FOR_EACH]: (step, { index, requests }) => [{ text: TEXT.loop(step.path, step.step ? referenceTitle(index, step.step, requests) : '?'), mono: true }],
  [STEP_DELAY]: (step) => [{ text: TEXT.wait(step.ms) }],
  [STEP_END]: (step) => [{ text: TEXT.outcomes[step.outcome] }, ...(step.message ? [{ text: step.message, muted: true }] : [])],
}

export const stepLines = (step, context) => LINES[step.kind]?.(step, context) ?? []

export function fallsThrough(step) {
  if (step.kind === STEP_END || step.next) return false
  if (step.kind === STEP_IF) return !step.then || !step.else
  return true
}

export function jumpsOf(step) {
  return TARGET_FIELDS
    .filter((field) => typeof step[field] === 'string' && step[field] !== '')
    .map((field) => ({ from: step.id, to: step[field], field, label: TEXT.edges[field], toEnd: step[field] === END_TARGET }))
}
