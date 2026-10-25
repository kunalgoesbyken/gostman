import { FLOW_ENGINE_TEXT as TEXT } from '../flowsText'
import {
  END_TARGET, MAX_SENDS_CAP, OUTCOME_FAILED, OUTCOME_PASSED, STEP_DELAY, STEP_END, STEP_FOR_EACH, STEP_IF, STEP_REQUEST, STEP_SET,
  indexSteps, loopsAround, normalizeFlow,
} from './model'
import { describeProblems, resolveRequest, stepTitle, validateFlow } from './validate'
import {
  asText, evaluateConditions, evaluateUntil, fillTemplate, itemValues, listItems, readResponse, subjectOf,
} from './values'

export const ACTION_SEND = 'send'
export const ACTION_WAIT = 'wait'
export const ACTION_DONE = 'done'

export const EVENT_PASSED = 'passed'
export const EVENT_FAILED = 'failed'
export const EVENT_HANDLED = 'handled'

const MAX_QUIET_STEPS = 10000

const freshState = () => ({ at: '', frames: [], attempt: 0, sends: 0, quiet: 0, responses: {}, last: '' })

const copyState = (state) => ({ ...freshState(), ...state, frames: (state.frames || []).map((frame) => ({ ...frame })), responses: { ...state.responses } })

function createTurn(flow, state, context) {
  return {
    flow,
    state,
    index: indexSteps(flow.steps),
    requests: context.requests || [],
    given: context.variables || {},
    writes: {},
    events: [],
    action: null,
  }
}

const variablesOf = (turn) => ({ ...turn.given, ...turn.writes })

const titleOf = (turn, id) => stepTitle(turn.index.get(id).step, turn.requests)

const targetTitle = (turn, target) => (target === END_TARGET ? TEXT.endOfFlow : titleOf(turn, target))

function record(turn, step, status, details = {}) {
  turn.events.push({ step: step.id, kind: step.kind, title: stepTitle(step, turn.requests), status, summary: '', ...details })
}

function finish(turn, outcome, message) {
  turn.state.at = ''
  turn.action = { kind: ACTION_DONE, outcome, message }
}

function write(turn, values) {
  Object.assign(turn.writes, values)
}

function enter(turn, id) {
  const around = loopsAround(turn.index, id)
  const kept = turn.state.frames.findIndex((frame) => !around.includes(frame.step))
  if (kept >= 0) turn.state.frames = turn.state.frames.slice(0, kept)
  turn.state.at = id
  turn.state.attempt = 1
}

function bindItem(turn, loop, frame) {
  write(turn, itemValues(frame.items[frame.index], frame.index, loop))
  record(turn, loop, EVENT_PASSED, { summary: TEXT.iteration(frame.index, frame.items.length), index: frame.index, count: frame.items.length })
}

function nextInLoop(turn, loopId) {
  const loop = turn.index.get(loopId).step
  const frame = turn.state.frames[turn.state.frames.length - 1]
  if (!frame || frame.step !== loopId) return following(turn, loopId)
  frame.index += 1
  if (frame.index < frame.items.length) {
    bindItem(turn, loop, frame)
    turn.state.at = loop.steps[0].id
    turn.state.attempt = 1
    return undefined
  }
  turn.state.frames.pop()
  return following(turn, loopId)
}

function following(turn, id) {
  const { list, position, parent } = turn.index.get(id)
  if (position + 1 < list.length) return enter(turn, list[position + 1].id)
  if (parent) return nextInLoop(turn, parent)
  return finish(turn, OUTCOME_PASSED, TEXT.passed)
}

function goTo(turn, from, target) {
  if (target === END_TARGET) return finish(turn, OUTCOME_PASSED, TEXT.passed)
  if (target) return enter(turn, target)
  return following(turn, from.id)
}

const continueAfter = (turn, step, target = '') => goTo(turn, step, target || step.next)

function sendAction(turn, step) {
  const retry = step.retry
  if (turn.state.sends >= turn.flow.maxSends) {
    return finish(turn, OUTCOME_FAILED, TEXT.budget(turn.state.sends, MAX_SENDS_CAP))
  }
  turn.state.sends += 1
  turn.state.quiet = 0
  const request = resolveRequest(step, turn.requests)
  turn.action = {
    kind: ACTION_SEND,
    step: step.id,
    requestId: request.id,
    attempt: turn.state.attempt,
    attempts: retry.times,
    delayMs: turn.state.attempt > 1 ? retry.delayMs : 0,
    variables: step.variables,
  }
  return undefined
}

function setValue(turn, value) {
  if (value.value !== undefined) return { ok: true, value: fillTemplate(value.value, variablesOf(turn)) }
  const title = titleOf(turn, value.step)
  return readResponse(turn.state.responses[value.step], value, title)
}

function runSet(turn, step) {
  const values = {}
  for (const value of step.values) {
    const read = setValue(turn, value)
    if (!read.ok) {
      record(turn, step, EVENT_FAILED, { summary: read.message })
      return finish(turn, OUTCOME_FAILED, `${TEXT.setFailed(stepTitle(step, turn.requests))} ${read.message}`)
    }
    values[value.name] = asText(read.value)
    write(turn, { [value.name]: values[value.name] })
  }
  record(turn, step, EVENT_PASSED, { summary: TEXT.wrote(Object.keys(values)), writes: values })
  return continueAfter(turn, step)
}

const conditionSubject = (turn, step) => turn.state.responses[step.step || turn.state.last]

function nextTitle(turn, step, target) {
  if (target) return targetTitle(turn, target)
  const { list, position, parent } = turn.index.get(step.id)
  if (position + 1 < list.length) return titleOf(turn, list[position + 1].id)
  return parent ? TEXT.nextItem : TEXT.endOfFlow
}

function runIf(turn, step) {
  const { checks, passed } = evaluateConditions(step, conditionSubject(turn, step), variablesOf(turn))
  const branch = passed ? 'then' : 'else'
  const summary = TEXT.branch(TEXT.branchNames[branch], nextTitle(turn, step, step[branch] || step.next))
  record(turn, step, EVENT_PASSED, { branch, checks, summary })
  return continueAfter(turn, step, step[branch])
}

function runForEach(turn, step) {
  const items = listItems(turn.state.responses[step.step], step.path, titleOf(turn, step.step))
  if (!items.ok) {
    record(turn, step, EVENT_FAILED, { summary: items.message })
    return finish(turn, OUTCOME_FAILED, items.message)
  }
  if (items.value.length === 0) {
    record(turn, step, EVENT_PASSED, { summary: TEXT.emptyList, count: 0 })
    return continueAfter(turn, step)
  }
  const frame = { step: step.id, items: items.value, index: 0 }
  turn.state.frames.push(frame)
  bindItem(turn, step, frame)
  turn.state.at = step.steps[0].id
  turn.state.attempt = 1
  return undefined
}

function runDelay(turn, step) {
  turn.action = { kind: ACTION_WAIT, step: step.id, ms: step.ms }
}

function runEnd(turn, step) {
  const message = step.message.trim() || TEXT.ended(step.outcome)
  record(turn, step, step.outcome === OUTCOME_FAILED ? EVENT_FAILED : EVENT_PASSED, { summary: message })
  finish(turn, step.outcome, message)
}

const HANDLERS = {
  [STEP_REQUEST]: sendAction,
  [STEP_SET]: runSet,
  [STEP_IF]: runIf,
  [STEP_FOR_EACH]: runForEach,
  [STEP_DELAY]: runDelay,
  [STEP_END]: runEnd,
}

function proceed(turn) {
  while (turn.action === null) {
    if (turn.state.quiet >= MAX_QUIET_STEPS) {
      finish(turn, OUTCOME_FAILED, TEXT.endless(turn.state.quiet))
    } else {
      const { step } = turn.index.get(turn.state.at)
      turn.state.quiet += 1
      HANDLERS[step.kind](turn, step)
    }
  }
  return { state: turn.state, action: turn.action, events: turn.events, writes: turn.writes }
}

function judgeAttempt(turn, step, input) {
  const subject = subjectOf(input.response)
  turn.state.responses[step.id] = subject
  turn.state.last = step.id
  const arrived = Boolean(input.response) && !input.response.error
  const checks = arrived ? evaluateUntil(step.retry.until, subject, variablesOf(turn)).map((check) => ({ ...check, name: TEXT.untilCheck(check.name) })) : []
  const passed = arrived && !input.failed && checks.every((check) => check.passed)
  return { checks, passed, attempt: turn.state.attempt, attempts: step.retry.times }
}

function afterSend(turn, step, input) {
  const { checks, passed, attempt, attempts } = judgeAttempt(turn, step, input)
  const details = { checks, attempt, attempts }
  if (passed) {
    record(turn, step, EVENT_PASSED, { ...details, summary: TEXT.attemptPassed(attempt, attempts) })
    return continueAfter(turn, step)
  }
  if (attempt < attempts) {
    record(turn, step, EVENT_HANDLED, { ...details, summary: TEXT.retrying(attempt, attempts), handledBy: 'retry' })
    turn.state.attempt += 1
    return undefined
  }
  if (step.onFailure) {
    record(turn, step, EVENT_HANDLED, { ...details, summary: TEXT.rerouted(targetTitle(turn, step.onFailure)), handledBy: 'failure' })
    return goTo(turn, step, step.onFailure)
  }
  record(turn, step, EVENT_FAILED, { ...details, summary: TEXT.attemptFailed(attempt, attempts) })
  return finish(turn, OUTCOME_FAILED, TEXT.failedAt(stepTitle(step, turn.requests)))
}

function afterWait(turn, step) {
  record(turn, step, EVENT_PASSED, { summary: TEXT.waited(step.ms) })
  return continueAfter(turn, step)
}

export function flowBegin(raw, context = {}) {
  const flow = normalizeFlow(raw)
  const problems = validateFlow(flow, context.requests || [])
  const turn = createTurn(flow, freshState(), context)
  if (problems.length > 0) {
    finish(turn, OUTCOME_FAILED, describeProblems(flow, problems, turn.requests))
    return { ...proceed(turn), problems }
  }
  enter(turn, flow.steps[0].id)
  return { ...proceed(turn), problems: [] }
}

export const flowTurn = ({ flow, state, input, context }) => (state ? flowAdvance(flow, state, input, context) : flowBegin(flow, context))

export function flowAdvance(raw, state, input = {}, context = {}) {
  const flow = normalizeFlow(raw)
  const turn = createTurn(flow, copyState(state), context)
  const entry = turn.index.get(turn.state.at)
  if (!entry) {
    finish(turn, OUTCOME_PASSED, TEXT.passed)
    return proceed(turn)
  }
  if (entry.step.kind === STEP_REQUEST) afterSend(turn, entry.step, input)
  else afterWait(turn, entry.step)
  return proceed(turn)
}
