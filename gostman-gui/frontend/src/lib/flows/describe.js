import { FLOW_CANVAS_TEXT as TEXT } from '../flowsText'
import { isActiveAssertion, titleOf } from '../scripting/assertions'
import {
  CONDITION_VARIABLES, END_TARGET, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_REPEAT, STEP_REQUEST, STEP_SET,
  STEP_SWITCH, casePosition, isCaseField, targetsOf,
} from './model'
import { SOURCE_LOOP, SOURCE_SEND } from './outputs'
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
    if (step.values.length === 0) return [{ text: TEXT.noValues, muted: true }]
    return step.values.map((value) => ({
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
    ...Object.keys(step.variables).map((name) => ({ text: TEXT.sets(name, step.variables[name]), mono: true, scope: SOURCE_SEND })),
  ],
  [STEP_DELAY]: (step) => [{ text: TEXT.wait(step.ms) }],
  [STEP_END]: (step) => [{ text: TEXT.outcomes[step.outcome] }, ...(step.message ? [{ text: step.message, muted: true }] : [])],
}

export const stepLines = (step, context) => LINES[step.kind]?.(step, context) ?? []

const BRANCHING = {
  [STEP_IF]: (step) => !step.then || !step.else,
  [STEP_SWITCH]: (step) => !step.else || step.cases.some((kase) => !kase.target),
}

export function fallsThrough(step) {
  if (step.kind === STEP_END || step.next) return false
  return BRANCHING[step.kind]?.(step) ?? true
}

function jumpLabel(step, field) {
  if (isCaseField(field)) return caseLabel(step.cases[casePosition(field)], casePosition(field))
  if (step.kind === STEP_SWITCH && field === 'else') return TEXT.edges.otherwise
  return TEXT.edges[field]
}

const jumpTone = (field) => FIELD_TONES[field] || (isCaseField(field) ? TONE_SUCCESS : TONE_MUTED)

export function jumpsOf(step) {
  return targetsOf(step).map(([field, to]) => ({ from: step.id, to, field, label: jumpLabel(step, field), toEnd: to === END_TARGET, tone: jumpTone(field) }))
}
