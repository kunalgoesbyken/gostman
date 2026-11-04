import { FLOW_ENGINE_TEXT as TEXT } from '../flowsText'
import { hasActiveCondition } from './conditions'
import { TYPE_STRING, coerce, declarationOrder, declaredTypes, namedDeclared } from './declared'
import {
  BRANCH_CANCELLED, BRANCH_FAILED, BRANCH_PASSED, BRANCH_RUNNING, CONDITION_VARIABLES, ELAPSED_FACT, END_TARGET, MAX_SENDS_CAP,
  OUTCOME_FAILED, OUTCOME_PASSED, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_PARALLEL, STEP_REPEAT,
  STEP_REQUEST, STEP_SET, STEP_SWITCH, caseField, indexSteps, loopsAround, normalizeFlow,
} from './model'
import { INPUT_BODY, resolveInputs } from './inputs'
import { caseLabel, describeProblems, resolveFlow, resolveRequest, stepTitle, validateFlow } from './validate'
import {
  asText, evaluateConditions, evaluateUntil, fillTemplate, itemValues, listItems, readResponse, subjectOf, withoutNames,
} from './values'

export const ACTION_SEND = 'send'
export const ACTION_WAIT = 'wait'
export const ACTION_DONE = 'done'
export const ACTION_FLOW = 'flow'
export const ACTION_PARALLEL = 'parallel'

export const EVENT_PASSED = 'passed'
export const EVENT_FAILED = 'failed'
export const EVENT_HANDLED = 'handled'

const BRANCH_ELSE = 'else'

const MAX_QUIET_STEPS = 10000

const freshState = () => ({ at: '', frames: [], attempt: 0, sends: 0, quiet: 0, responses: {}, last: '', locals: {} })

const copyState = (state) => ({
  ...freshState(),
  ...state,
  frames: (state.frames || []).map((frame) => ({ ...frame })),
  responses: { ...state.responses },
  locals: { ...state.locals },
})

function createTurn(flow, state, context) {
  return {
    flow,
    state,
    index: indexSteps(flow.steps),
    requests: context.requests || [],
    flows: context.flows || [],
    isNested: Number.isFinite(context.sendsLeft),
    sendsLeft: Number.isFinite(context.sendsLeft) ? context.sendsLeft : MAX_SENDS_CAP,
    given: context.variables || {},
    types: declaredTypes(flow),
    writes: {},
    forgets: [],
    events: [],
    action: null,
  }
}

const variablesOf = (turn) => ({ ...withoutNames(turn.given, turn.forgets), ...turn.writes, ...turn.state.locals })

const isDeclared = (turn, name) => Object.hasOwn(turn.types, name)

const titleOfStep = (turn, step) => stepTitle(step, turn.requests, turn.flows)

const titleOf = (turn, id) => titleOfStep(turn, turn.index.get(id).step)

const targetTitle = (turn, target) => (target === END_TARGET ? TEXT.endOfFlow : titleOf(turn, target))

function record(turn, step, status, details = {}) {
  turn.events.push({ step: step.id, kind: step.kind, title: titleOfStep(turn, step), status, summary: '', ...details })
}

function flowOutputs(turn) {
  const values = {}
  for (const output of turn.flow.outputs) {
    if (output.name !== '') {
      const read = setValue(turn, output)
      if (!read.ok) return { ok: false, message: TEXT.outputFailed(output.name, read.message) }
      values[output.name] = asText(read.value)
    }
  }
  return { ok: true, values }
}

function finish(turn, outcome, message, reason = {}) {
  const outputs = outcome === OUTCOME_PASSED ? flowOutputs(turn) : { ok: true, values: {} }
  if (!outputs.ok) return finish(turn, OUTCOME_FAILED, outputs.message, reason)
  leaveLoops(turn, 0)
  if (!turn.isNested) write(turn, outputs.values)
  turn.state.at = ''
  turn.action = { kind: ACTION_DONE, outcome, message, outputs: outputs.values, variables: { ...turn.state.locals }, ...reason }
  return undefined
}

function write(turn, values) {
  Object.assign(turn.writes, values)
  turn.forgets = turn.forgets.filter((name) => !Object.hasOwn(values, name))
}

function forget(turn, name) {
  delete turn.writes[name]
  if (!turn.forgets.includes(name)) turn.forgets.push(name)
}

function shadowOf(turn, name) {
  const variables = variablesOf(turn)
  return Object.hasOwn(variables, name) ? { shadowed: variables[name] } : {}
}

function closeLoop(turn, frame) {
  const loop = turn.index.get(frame.step).step
  if (loop.kind !== STEP_REPEAT) return
  if (Object.hasOwn(frame, 'shadowed')) write(turn, { [loop.indexAs]: frame.shadowed })
  else forget(turn, loop.indexAs)
}

function leaveLoops(turn, kept) {
  turn.state.frames.slice(kept).reverse().forEach((frame) => closeLoop(turn, frame))
  turn.state.frames = turn.state.frames.slice(0, kept)
}

const leaveLoop = (turn) => leaveLoops(turn, turn.state.frames.length - 1)

function enter(turn, id) {
  const around = loopsAround(turn.index, id)
  const kept = turn.state.frames.findIndex((frame) => !around.includes(frame.step))
  if (kept >= 0) leaveLoops(turn, kept)
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
  leaveLoop(turn)
  return continueAfter(turn, loop)
}

const untilOf = (loop) => ({ source: loop.source, step: loop.step, match: loop.match, conditions: loop.until })

const typeWord = (type) => TEXT.typeNames[type]

function assign(turn, name, value) {
  if (!isDeclared(turn, name)) {
    write(turn, { [name]: value })
    return { ok: true, value }
  }
  const typed = coerce(value, turn.types[name])
  if (!typed.ok) return { ok: false, message: TEXT.notOfType(name, typeWord(turn.types[name]), value) }
  turn.state.locals[name] = typed.text
  return { ok: true, value: typed.text }
}

function assignAll(turn, values) {
  const assigned = {}
  for (const [name, value] of Object.entries(values)) {
    const placed = assign(turn, name, asText(value))
    if (!placed.ok) return placed
    assigned[name] = placed.value
  }
  return { ok: true, values: assigned }
}

const untilChecks = (checks) => checks.map((check) => ({ ...check, name: TEXT.untilCheck(check.name) }))

function repeatExhausted(turn, loop, checks) {
  leaveLoop(turn)
  if (loop.onFailure) {
    record(turn, loop, EVENT_HANDLED, { checks, summary: TEXT.untilNeverRerouted(loop.times, targetTitle(turn, loop.onFailure)), handledBy: 'failure' })
    return goTo(turn, loop, loop.onFailure)
  }
  record(turn, loop, EVENT_FAILED, { checks, summary: TEXT.untilNever(loop.times) })
  return finish(turn, OUTCOME_FAILED, TEXT.repeatFailed(titleOfStep(turn, loop), loop.times))
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
  if (!hasActiveCondition(loop.until)) {
    if (!isLast) return nextPass(turn, loop, frame)
    leaveLoop(turn)
    return continueAfter(turn, loop)
  }
  const result = evaluateConditions(untilOf(loop), conditionSubject(turn, loop), variablesOf(turn), turn.types)
  const checks = untilChecks(result.checks)
  if (result.passed) {
    leaveLoop(turn)
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

const ownsLimit = (turn) => turn.flow.maxSends <= turn.sendsLeft

function budgetMessage(turn) {
  if (!ownsLimit(turn)) return ''
  if (turn.isNested) return TEXT.budgetOf(turn.flow.name, sendLimit(turn), MAX_SENDS_CAP)
  return TEXT.budget(sendLimit(turn), MAX_SENDS_CAP)
}

const stopForBudget = (turn, message = budgetMessage(turn)) => finish(turn, OUTCOME_FAILED, message, { budget: true })

function inputsFailed(turn, step, message) {
  if (step.onFailure) {
    record(turn, step, EVENT_HANDLED, { summary: message, handledBy: 'failure' })
    return goTo(turn, step, step.onFailure)
  }
  record(turn, step, EVENT_FAILED, { summary: message })
  return finish(turn, OUTCOME_FAILED, `${TEXT.inputsFailed(titleOfStep(turn, step))} ${message}`)
}

const readInput = (turn) => (input) => readResponse(turn.state.responses[input.step], input, titleOf(turn, input.step))

const PLACEHOLDER_OPEN = '{{'
const PLACEHOLDER_CLOSE = '}}'

function soleName(template) {
  const trimmed = template.trim()
  if (!trimmed.startsWith(PLACEHOLDER_OPEN) || !trimmed.endsWith(PLACEHOLDER_CLOSE)) return ''
  const inner = trimmed.slice(PLACEHOLDER_OPEN.length, -PLACEHOLDER_CLOSE.length).trim()
  return inner.includes('{') || inner.includes('}') ? '' : inner
}

function typedInput(turn, input) {
  const name = input.target === INPUT_BODY && typeof input.value === 'string' ? soleName(input.value) : ''
  const type = turn.types[name]
  if (!name || !type || type === TYPE_STRING || !Object.hasOwn(turn.state.locals, name)) return input
  return { ...input, value: turn.state.locals[name], exact: true }
}

const fillInputs = (turn, step) => resolveInputs(step.inputs.map((input) => typedInput(turn, input)), readInput(turn))

const sendVariables = (turn, step, filled) => ({ ...turn.state.locals, ...step.variables, ...filled.variables })

function sendAction(turn, step) {
  const retry = step.retry
  const filled = fillInputs(turn, step)
  if (!filled.ok) return inputsFailed(turn, step, filled.message)
  if (isOverBudget(turn)) return stopForBudget(turn)
  turn.state.sends += 1
  const request = resolveRequest(step, turn.requests)
  turn.action = {
    kind: ACTION_SEND,
    step: step.id,
    requestId: request.id,
    attempt: turn.state.attempt,
    attempts: retry.times,
    delayMs: turn.state.attempt > 1 ? retry.delayMs : 0,
    variables: sendVariables(turn, step, filled),
    inputs: filled.inputs,
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
      return finish(turn, OUTCOME_FAILED, `${TEXT.setFailed(titleOfStep(turn, step))} ${read.message}`)
    }
    const placed = assign(turn, value.name, asText(read.value))
    if (!placed.ok) {
      record(turn, step, EVENT_FAILED, { summary: placed.message })
      return finish(turn, OUTCOME_FAILED, `${TEXT.setFailed(titleOfStep(turn, step))} ${placed.message}`)
    }
    values[value.name] = placed.value
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
  const { checks, passed } = evaluateConditions(step, conditionSubject(turn, step), variablesOf(turn), turn.types)
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
    const result = evaluateConditions({ source: step.source, match: kase.match, conditions: kase.conditions }, subject, variables, turn.types)
    checks.push(...caseChecks(result.checks, label))
    if (result.passed) {
      record(turn, step, EVENT_PASSED, { branch: caseField(position), checks, summary: TEXT.branch(label, nextTitle(turn, step, kase.target || step.next)) })
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
  const frame = { step: step.id, index: 0, count: step.times, ...shadowOf(turn, step.indexAs) }
  turn.state.frames.push(frame)
  return beginPass(turn, step, frame)
}

const filledVariables = (turn, variables) => Object.fromEntries(Object.entries(variables).map(([name, value]) => [name, fillTemplate(value, variablesOf(turn))]))

function runFlow(turn, step) {
  if (isOverBudget(turn)) return stopForBudget(turn)
  turn.action = {
    kind: ACTION_FLOW,
    step: step.id,
    flowId: resolveFlow(step, turn.flows)?.id || '',
    title: titleOfStep(turn, step),
    variables: filledVariables(turn, step.variables),
    sendsLeft: sendLimit(turn) - turn.state.sends,
  }
  return undefined
}

function branchAction(turn, branch) {
  const title = titleOfStep(turn, branch)
  if (branch.kind === STEP_FLOW) {
    return { ok: true, action: { kind: ACTION_FLOW, step: branch.id, flowId: resolveFlow(branch, turn.flows)?.id || '', title, variables: filledVariables(turn, branch.variables) } }
  }
  const filled = fillInputs(turn, branch)
  if (!filled.ok) return { ok: false, message: TEXT.branchInputs(title, filled.message) }
  const request = resolveRequest(branch, turn.requests)
  return {
    ok: true,
    action: {
      kind: ACTION_SEND, step: branch.id, title, requestId: request.id, attempt: 1, attempts: 1, delayMs: 0, variables: sendVariables(turn, branch, filled), inputs: filled.inputs,
    },
  }
}

function runParallel(turn, step) {
  const built = step.steps.map((branch) => branchAction(turn, branch))
  const broken = built.find((entry) => !entry.ok)
  if (broken) return inputsFailed(turn, step, broken.message)
  const sends = built.filter(({ action }) => action.kind === ACTION_SEND).length
  if (turn.state.sends + sends > sendLimit(turn)) return stopForBudget(turn)
  turn.state.sends += sends
  const flowCount = built.length - sends
  const sendsLeft = flowCount > 0 ? Math.floor((sendLimit(turn) - turn.state.sends) / flowCount) : 0
  const branches = built.map(({ action }) => (action.kind === ACTION_FLOW ? { ...action, sendsLeft } : action))
  turn.action = { kind: ACTION_PARALLEL, step: step.id, title: titleOfStep(turn, step), timeoutMs: step.timeoutMs, branches }
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
  [STEP_PARALLEL]: runParallel,
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
  return { state: turn.state, action: turn.action, events: turn.events, writes: turn.writes, forgets: turn.forgets }
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

function notFilled(turn, step, message) {
  turn.state.sends -= 1
  return inputsFailed(turn, step, message)
}

function afterSend(turn, step, input) {
  if (typeof input.unfilled === 'string') return notFilled(turn, step, input.unfilled)
  turn.state.quiet = 0
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
  return finish(turn, OUTCOME_FAILED, TEXT.failedAt(titleOfStep(turn, step)))
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

function flowOverBudget(turn, step, message, sends) {
  const stated = message || budgetMessage(turn)
  record(turn, step, EVENT_FAILED, { summary: stated || TEXT.budgetAbove, sends })
  return stopForBudget(turn, stated)
}

const sendsOf = (input) => Math.max(0, Math.trunc(Number(input.sends)) || 0)

function afterFlow(turn, step, input) {
  const sends = sendsOf(input)
  turn.state.sends += sends
  if (sends > 0) turn.state.quiet = 0
  const title = titleOfStep(turn, step)
  const message = typeof input.message === 'string' ? input.message : ''
  if (input.budget === true) return flowOverBudget(turn, step, message, sends)
  if (input.outcome === OUTCOME_PASSED) {
    const given = assignAll(turn, outputsOf(input))
    if (!given.ok) return failOrReroute(turn, step, given.message, { sends })
    record(turn, step, EVENT_PASSED, { summary: TEXT.flowPassed(sends), sends, ...writesOf(given.values) })
    return continueAfter(turn, step)
  }
  if (step.onFailure) {
    record(turn, step, EVENT_HANDLED, { summary: TEXT.rerouted(targetTitle(turn, step.onFailure)), sends, handledBy: 'failure' })
    return goTo(turn, step, step.onFailure)
  }
  record(turn, step, EVENT_FAILED, { summary: message || TEXT.failedAt(title), sends })
  return finish(turn, OUTCOME_FAILED, TEXT.failedAt(title))
}

const outputsOf = (input) => (input && typeof input.outputs === 'object' && input.outputs !== null ? input.outputs : {})

const writesOf = (values) => (Object.keys(values).length > 0 ? { writes: values } : {})

function failOrReroute(turn, step, summary, details = {}) {
  if (step.onFailure) {
    record(turn, step, EVENT_HANDLED, { ...details, summary: `${summary} ${TEXT.rerouted(targetTitle(turn, step.onFailure))}`, handledBy: 'failure' })
    return goTo(turn, step, step.onFailure)
  }
  record(turn, step, EVENT_FAILED, { ...details, summary })
  return finish(turn, OUTCOME_FAILED, `${TEXT.failedAt(titleOfStep(turn, step))} ${summary}`)
}

const branchInput = (input, id) => input.branches?.[id] || { state: BRANCH_RUNNING }

const elapsedOf = (input) => Math.max(0, Math.round(Number(input.elapsedMs)) || 0)

function branchFacts(step, input) {
  const facts = { [ELAPSED_FACT]: String(elapsedOf(input)) }
  step.steps.forEach((branch) => {
    const got = branchInput(input, branch.id)
    facts[branch.id] = got.state
    const status = got.response && !got.response.error ? subjectOf(got.response).status : undefined
    if (status !== undefined) facts[`${branch.id}.status`] = String(status)
    if (Number.isFinite(got.ms)) facts[`${branch.id}.ms`] = String(Math.round(got.ms))
  })
  return facts
}

const allPassed = (step, input) => step.steps.every((branch) => branchInput(input, branch.id).state === BRANCH_PASSED)

function parallelVerdict(turn, step, input) {
  if (!hasActiveCondition(step.until)) return { passed: allPassed(step, input), checks: [] }
  const facts = branchFacts(step, input)
  const types = withoutNames(turn.types, Object.keys(facts))
  const until = { source: CONDITION_VARIABLES, match: step.match, conditions: step.until }
  return evaluateConditions(until, null, { ...variablesOf(turn), ...facts }, types)
}

const stateWord = (state) => TEXT.branchStates[state] || state

function branchRow(turn, branch, got, input) {
  const timing = Number.isFinite(got.ms) ? TEXT.branchTook(stateWord(got.state), TEXT.milliseconds(Math.round(got.ms))) : stateWord(got.state)
  const passed = got.state === BRANCH_PASSED
  return { name: TEXT.branchFact(titleOfStep(turn, branch), timing), passed, message: passed ? '' : branchSummary(got, input) }
}

function branchEventStatus(got, isFailing) {
  if (got.state === BRANCH_PASSED) return EVENT_PASSED
  return got.state === BRANCH_FAILED && isFailing ? EVENT_FAILED : EVENT_HANDLED
}

const cancelledText = (input) => (input.timedOut === true && !input.doneAt ? TEXT.branchTimedOut : TEXT.branchCancelled)

function branchSummary(got, input) {
  if (got.state === BRANCH_CANCELLED) return cancelledText(input)
  if (got.state === BRANCH_PASSED) return TEXT.branchPassed
  return got.message || TEXT.branchFailed
}

function recordBranches(turn, step, input, isFailing) {
  step.steps.forEach((branch) => {
    const got = branchInput(input, branch.id)
    const status = branchEventStatus(got, isFailing)
    const handled = status === EVENT_HANDLED ? { handledBy: 'parallel' } : {}
    const details = branch.kind === STEP_FLOW ? { sends: sendsOf(got) } : { attempt: 1, attempts: 1 }
    record(turn, branch, status, { summary: branchSummary(got, input), ...details, ...handled })
  })
}

function keepResponses(turn, input) {
  const order = Array.isArray(input.order) ? input.order : []
  order.forEach((id) => {
    const got = branchInput(input, id)
    if (!got.response) return
    turn.state.responses[id] = subjectOf(got.response)
    turn.state.last = id
  })
}

function parallelSummary(step, input, verdict) {
  const passed = step.steps.filter((branch) => branchInput(input, branch.id).state === BRANCH_PASSED).length
  const elapsed = TEXT.milliseconds(elapsedOf(input))
  if (input.timedOut === true && !verdict.passed) return TEXT.parallelTimedOut(elapsed)
  return verdict.passed ? TEXT.parallelPassed(passed, step.steps.length, elapsed) : TEXT.parallelFailed(passed, step.steps.length)
}

function branchOutputs(turn, step, input) {
  const values = {}
  for (const branch of step.steps) {
    const got = branchInput(input, branch.id)
    if (branch.kind === STEP_FLOW && got.state === BRANCH_PASSED) {
      const given = assignAll(turn, outputsOf(got))
      if (!given.ok) return given
      Object.assign(values, given.values)
    }
  }
  return { ok: true, values }
}

const branchSends = (step, input) => step.steps.reduce((total, branch) => total + (branch.kind === STEP_FLOW ? sendsOf(branchInput(input, branch.id)) : 0), 0)

function settleParallel(turn, step, input) {
  const sends = branchSends(step, input)
  turn.state.quiet = 0
  turn.state.sends += sends
  const overBudget = step.steps.map((branch) => branchInput(input, branch.id)).find((got) => got.budget === true)
  keepResponses(turn, input)
  const verdict = parallelVerdict(turn, step, input.doneAt || input)
  recordBranches(turn, step, input, (!verdict.passed && !step.onFailure) || Boolean(overBudget))
  if (overBudget) return flowOverBudget(turn, step, overBudget.message || '', sends)
  const given = branchOutputs(turn, step, input)
  if (!given.ok) return failOrReroute(turn, step, given.message, { sends })
  const facts = step.steps.map((branch) => branchRow(turn, branch, branchInput(input, branch.id), input))
  const details = { checks: [...verdict.checks, ...facts], sends, ...writesOf(given.values) }
  const summary = parallelSummary(step, input, verdict)
  if (verdict.passed) {
    record(turn, step, EVENT_PASSED, { ...details, summary })
    return continueAfter(turn, step)
  }
  return failOrReroute(turn, step, summary, details)
}

function afterParallel(turn, step, input) {
  if (input.settled === true) return settleParallel(turn, step, input)
  turn.action = { kind: ACTION_PARALLEL, step: step.id, stop: parallelVerdict(turn, step, input).passed }
  return undefined
}

const AFTER_ACTION = {
  [STEP_REQUEST]: afterSend,
  [STEP_FLOW]: afterFlow,
  [STEP_REPEAT]: afterPause,
  [STEP_PARALLEL]: afterParallel,
}

function declare(turn) {
  const isSupplied = (declared) => declared.input === true && Object.hasOwn(turn.given, declared.name)
  const { order, looped } = declarationOrder(namedDeclared(turn.flow), isSupplied)
  const problems = looped.length > 0 ? [TEXT.variablesLoop(looped)] : []
  for (const declared of order) {
    const supplied = isSupplied(declared)
    if (declared.required && (!supplied || asText(turn.given[declared.name]).trim() === '')) {
      problems.push(TEXT.inputMissing(declared.name))
    } else {
      const written = supplied ? asText(turn.given[declared.name]) : fillTemplate(declared.value, variablesOf(turn))
      const typed = coerce(written, declared.type)
      if (typed.ok) turn.state.locals[declared.name] = typed.text
      else problems.push(TEXT.notOfType(declared.name, typeWord(declared.type), written))
    }
  }
  return problems.map((message) => ({ step: '', message }))
}

export function flowBegin(raw, context = {}) {
  const flow = normalizeFlow(raw)
  const turn = createTurn(flow, freshState(), context)
  const found = validateFlow(flow, context.requests || [], context.flows || [])
  const problems = found.length > 0 ? found : declare(turn)
  if (problems.length > 0) {
    finish(turn, OUTCOME_FAILED, describeProblems(flow, problems, turn.requests, turn.flows))
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
