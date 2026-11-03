import { FLOW_CANVAS_TEXT as TEXT } from '../flowsText'
import { isActiveAssertion, titleOf } from '../scripting/assertions'
import {
  CONDITION_VARIABLES, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_REPEAT, STEP_REQUEST, STEP_SET,
  STEP_SWITCH, casePosition, isCaseField,
} from './model'
import { SOURCE_CALL, SOURCE_LOOP } from './outputs'
import { caseLabel, resolveRequest, stepTitle } from './validate'
import { SCOPE_SESSION } from '../scripting/scopes'

export const TONE_FAILURE = 'failure'
export const TONE_SUCCESS = 'success'
export const TONE_MUTED = 'muted'

const FIELD_TONES = { onFailure: TONE_FAILURE, then: TONE_SUCCESS }

const firstAndMore = (conditions) => {
  const active = conditions.filter(isActiveAssertion)
  return active.length > 0 ? { first: titleOf(active[0]), more: active.length - 1 } : null
}

const isFilledValue = (value) => [value.name, value.step, value.value, value.path].some(Boolean)

const referenceTitle = (index, id, requests) => (index.get(id) ? stepTitle(index.get(id).step, requests) : id)

const conditionText = (step, conditions, match) => {
  const condition = firstAndMore(conditions)
  if (!condition) return null
  const described = TEXT.condition(condition.first, condition.more, match)
  return step.source === CONDITION_VARIABLES ? TEXT.variablesCondition(described) : described
}

function caseLine(step, kase, position) {
  const described = conditionText(step, kase.conditions, kase.match)
  return { text: TEXT.caseLine(caseLabel(kase, position), described || TEXT.noCondition), mono: true, muted: !described }
}

function repeatLines(step) {
  const until = conditionText(step, step.until, step.match)
  return [
    { text: TEXT.passes(step.times, step.delayMs), scope: SOURCE_LOOP },
    ...(until ? [{ text: TEXT.until(until, 0), mono: true }] : []),
  ]
}

const LINES = {
  [STEP_REQUEST]: (step, { requests }) => {
    const request = resolveRequest(step, requests)
    const until = firstAndMore(step.retry.until)
    return [
      request ? { method: request.method, text: request.path } : { text: step.request || TEXT.noRequest, muted: true },
      ...(step.retry.times > 1 ? [{ text: TEXT.retry(step.retry.times, step.retry.delayMs) }] : []),
      ...(step.inputs?.length > 0 ? [{ text: TEXT.inputs(step.inputs.length) }] : []),
      ...(until ? [{ text: TEXT.until(until.first, until.more), mono: true }] : []),
    ]
  },
  [STEP_SET]: (step, { index, requests }) => {
    const values = step.values.filter(isFilledValue)
    if (values.length === 0) return [{ text: TEXT.noValues, muted: true }]
    return values.map((value) => ({
      text: TEXT.sets(value.name, value.step ? TEXT.fromResponse(value.source, value.path, referenceTitle(index, value.step, requests)) : TEXT.fromTemplate(value.value)),
      mono: true,
      scope: SCOPE_SESSION,
    }))
  },
  [STEP_IF]: (step) => {
    const described = conditionText(step, step.conditions, step.match)
    return [described ? { text: described, mono: true } : { text: TEXT.noCondition, muted: true }]
  },
  [STEP_SWITCH]: (step) => (step.cases.length > 0 ? step.cases.map((kase, position) => caseLine(step, kase, position)) : [{ text: TEXT.noCases, muted: true }]),
  [STEP_FOR_EACH]: (step, { index, requests }) => [{ text: TEXT.loop(step.path, step.step ? referenceTitle(index, step.step, requests) : '?'), mono: true, scope: SOURCE_LOOP }],
  [STEP_REPEAT]: repeatLines,
  [STEP_FLOW]: (step) => [
    step.flow ? { text: TEXT.runsFlow(step.flow) } : { text: TEXT.noFlow, muted: true },
    ...Object.keys(step.variables).map((name) => ({ text: TEXT.sets(name, step.variables[name]), mono: true, scope: SOURCE_CALL })),
  ],
  [STEP_DELAY]: (step) => [{ text: TEXT.wait(step.ms) }],
  [STEP_END]: (step) => [{ text: TEXT.outcomes[step.outcome] }, ...(step.message ? [{ text: step.message, muted: true }] : [])],
}

export const stepLines = (step, context) => LINES[step.kind]?.(step, context) ?? []

function edgeWord(step, field) {
  if (field === 'next' && step.onFailure) return 'passes'
  if (field === 'else' && step.kind === STEP_SWITCH) return 'otherwise'
  return field
}

export function jumpLabel(step, field) {
  if (isCaseField(field)) return caseLabel(step.cases[casePosition(field)], casePosition(field))
  return TEXT.edges[edgeWord(step, field)]
}

export const jumpTone = (field) => FIELD_TONES[field] || (isCaseField(field) ? TONE_SUCCESS : TONE_MUTED)
