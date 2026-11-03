import { FLOW_ENGINE_TEXT as TEXT } from '../flowsText'
import { isActiveAssertion } from '../scripting/assertions'
import {
  END_TARGET, MAX_SENDS_CAP, OUTCOME_FAILED, OUTCOME_PASSED, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_REPEAT,
  STEP_REQUEST, STEP_SET, STEP_SWITCH, indexSteps, loopsAround, normalizeFlow,
} from './model'
import { caseLabel, describeProblems, resolveFlow, resolveRequest, stepTitle, validateFlow } from './validate'
import {
  asText, evaluateConditions, evaluateUntil, fillTemplate, itemValues, listItems, readResponse, subjectOf,
} from './values'

export const ACTION_SEND = 'send'
export const ACTION_WAIT = 'wait'
export const ACTION_DONE = 'done'
export const ACTION_FLOW = 'flow'

export const EVENT_PASSED = 'passed'
export const EVENT_FAILED = 'failed'
export const EVENT_HANDLED = 'handled'

export const BRANCH_ELSE = 'else'

const MAX_QUIET_STEPS = 10000

const freshState = () => ({ at: '', frames: [], attempt: 0, sends: 0, quiet: 0, responses: {}, last: '' })

const copyState = (state) => ({ ...freshState(), ...state, frames: (state.frames || []).map((frame) => ({ ...frame })), responses: { ...state.responses } })

function createTurn(flow, state, context) {
  return {
    flow,
    state,
    index: indexSteps(flow.steps),
    requests: context.requests || [],
    flows: context.flows || [],
    sendsLeft: Number.isFinite(context.sendsLeft) ? context.sendsLeft : MAX_SENDS_CAP,
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

function startPass(turn, loop) {
  turn.state.at = loop.steps[0].id
  turn.state.attempt = 1
}

function bindItem(turn, loop, frame) {
  write(turn, itemValues(frame.items[frame.index], frame.index, loop))
  record(turn, loop, EVENT_PASSED, { summary: TEXT.iteration(frame.index, frame.items.length), index: frame.index, count: frame.items.length })
  startPass(turn, loop)
}

function beginPass(turn, loop, frame) {
  write(turn, { [loop.indexAs]: String(frame.index) })
  record(turn, loop, EVENT_PASSED, { summary: TEXT.pass(frame.index, frame.count), index: frame.index, count: frame.count })
  startPass(turn, loop)
}

function endOfItem(turn, loop, frame) {
  frame.index += 1
  if (frame.index < frame.items.length) return bindItem(turn, loop, frame)
  turn.state.frames.pop()
  return continueAfter(turn, loop)
}

const untilOf = (loop) => ({ source: loop.source, step: loop.step, match: loop.match, conditions: loop.until })

const untilChecks = (checks) => checks.map((check) => ({ ...check, name: TEXT.untilCheck(check.name) }))

function repeatExhausted(turn, loop, checks) {
  turn.state.frames.pop()
  if (loop.onFailure) {
    record(turn, loop, EVENT_HANDLED, { checks, summary: TEXT.untilNeverRerouted(loop.times, targetTitle(turn, loop.onFailure)), handledBy: 'failure' })
    return goTo(turn, loop, loop.onFailure)
  }
  record(turn, loop, EVENT_FAILED, { checks, summary: TEXT.untilNever(loop.times) })
  return finish(turn, OUTCOME_FAILED, TEXT.repeatFailed(stepTitle(loop, turn.requests), loop.times))
}

function nextPass(turn, loop, frame) {
  frame.index += 1
  if (loop.delayMs === 0) return beginPass(turn, loop, frame)
  turn.state.at = loop.id
  turn.action = { kind: ACTION_WAIT, step: loop.id, ms: loop.delayMs }
  return undefined
}

function endOfPass(turn, loop, frame) {
  const isLast = frame.index + 1 >= frame.count
  if (!loop.until.some(isActiveAssertion)) {
    if (!isLast) return nextPass(turn, loop, frame)
    turn.state.frames.pop()
    return continueAfter(turn, loop)
  }
  const result = evaluateConditions(untilOf(loop), conditionSubject(turn, loop), variablesOf(turn))
  const checks = untilChecks(result.checks)
  if (result.passed) {
    turn.state.frames.pop()
    record(turn, loop, EVENT_PASSED, { checks, summary: TEXT.untilMet(frame.index + 1) })
    return continueAfter(turn, loop)
  }
  return isLast ? repeatExhausted(turn, loop, checks) : nextPass(turn, loop, frame)
}

const LOOP_ENDS = {
  [STEP_FOR_EACH]: endOfItem,
  [STEP_REPEAT]: endOfPass,
}

function nextInLoop(turn, loopId) {
  const loop = turn.index.get(loopId).step
  const frame = turn.state.frames[turn.state.frames.length - 1]
  if (!frame || frame.step !== loopId) return following(turn, loopId)
  return LOOP_ENDS[loop.kind](turn, loop, frame)
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

const sendLimit = (turn) => Math.min(turn.flow.maxSends, turn.sendsLeft)

const isOverBudget = (turn) => turn.state.sends >= sendLimit(turn)

const stopForBudget = (turn) => finish(turn, OUTCOME_FAILED, TEXT.budget(turn.state.sends, MAX_SENDS_CAP))

function sendAction(turn, step) {
  const retry = step.retry
  if (isOverBudget(turn)) return stopForBudget(turn)
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
  if (!parent) return TEXT.endOfFlow
  return turn.index.get(parent).step.kind === STEP_REPEAT ? TEXT.nextPass : TEXT.nextItem
}

function runIf(turn, step) {
  const { checks, passed } = evaluateConditions(step, conditionSubject(turn, step), variablesOf(turn))
  const branch = passed ? 'then' : 'else'
  const summary = TEXT.branch(TEXT.branchNames[branch], nextTitle(turn, step, step[branch] || step.next))
  record(turn, step, EVENT_PASSED, { branch, checks, summary })
  return continueAfter(turn, step, step[branch])
}

const caseChecks = (checks, label) => checks.map((check) => ({ ...check, name: TEXT.caseCheck(label, check.name) }))

function runSwitch(turn, step) {
  const subject = conditionSubject(turn, step)
  const variables = variablesOf(turn)
  const checks = []
  for (const [position, kase] of step.cases.entries()) {
    const label = caseLabel(kase, position)
    const result = evaluateConditions({ source: step.source, match: kase.match, conditions: kase.conditions }, subject, variables)
    checks.push(...caseChecks(result.checks, label))
    if (result.passed) {
      record(turn, step, EVENT_PASSED, { branch: position, checks, summary: TEXT.branch(label, nextTitle(turn, step, kase.target || step.next)) })
      return continueAfter(turn, step, kase.target)
    }
  }
  record(turn, step, EVENT_PASSED, { branch: BRANCH_ELSE, checks, summary: TEXT.branch(TEXT.noCaseMatched, nextTitle(turn, step, step.else || step.next)) })
  return continueAfter(turn, step, step.else)
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
  return bindItem(turn, step, frame)
}

function runRepeat(turn, step) {
  const frame = { step: step.id, index: 0, count: step.times }
  turn.state.frames.push(frame)
  return beginPass(turn, step, frame)
}

const filledVariables = (turn, variables) => Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, fillTemplate(value, variablesOf(turn))]))

function runFlow(turn, step) {
  if (isOverBudget(turn)) return stopForBudget(turn)
  const called = resolveFlow(step, turn.flows)
  if (!called) {
    const message = TEXT.missingFlow(step.flow || step.flowId)
    record(turn, step, EVENT_FAILED, { summary: message })
    return finish(turn, OUTCOME_FAILED, message)
  }
  turn.action = {
    kind: ACTION_FLOW,
    step: step.id,
    flowId: called.id,
    title: stepTitle(step, turn.requests),
    variables: filledVariables(turn, step.variables),
    sendsLeft: sendLimit(turn) - turn.state.sends,
  }
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
  [STEP_SWITCH]: runSwitch,
  [STEP_FOR_EACH]: runForEach,
  [STEP_REPEAT]: runRepeat,
  [STEP_FLOW]: runFlow,
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
  const checks = arrived ? untilChecks(evaluateUntil(step.retry.until, subject, variablesOf(turn))) : []
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

function afterPause(turn, loop) {
  const frame = turn.state.frames[turn.state.frames.length - 1]
  if (!frame || frame.step !== loop.id) return continueAfter(turn, loop)
  return beginPass(turn, loop, frame)
}

const sendsOf = (input) => Math.max(0, Math.trunc(Number(input.sends)) || 0)

function afterFlow(turn, step, input) {
  const sends = sendsOf(input)
  turn.state.sends += sends
  if (sends > 0) turn.state.quiet = 0
  const title = stepTitle(step, turn.requests)
  const message = typeof input.message === 'string' ? input.message : ''
  if (input.outcome === OUTCOME_PASSED) {
    record(turn, step, EVENT_PASSED, { summary: TEXT.flowPassed(sends), sends })
    return continueAfter(turn, step)
  }
  if (step.onFailure) {
    record(turn, step, EVENT_HANDLED, { summary: TEXT.rerouted(targetTitle(turn, step.onFailure)), sends, handledBy: 'failure' })
    return goTo(turn, step, step.onFailure)
  }
  record(turn, step, EVENT_FAILED, { summary: message || TEXT.failedAt(title), sends })
  return finish(turn, OUTCOME_FAILED, TEXT.failedAt(title))
}

const AFTER_ACTION = {
  [STEP_REQUEST]: afterSend,
  [STEP_FLOW]: afterFlow,
  [STEP_REPEAT]: afterPause,
}

export function flowBegin(raw, context = {}) {
  const flow = normalizeFlow(raw)
  const problems = validateFlow(flow, context.requests || [], context.flows || [])
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
  const after = AFTER_ACTION[entry.step.kind] || afterWait
  after(turn, entry.step, input)
  return proceed(turn)
}
