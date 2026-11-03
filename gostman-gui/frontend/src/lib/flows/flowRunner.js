import { create } from 'zustand'
import { parseJSON } from '../dataUtils'
import { rememberPrompts } from '../execution'
import { runResult, sessionGiver, skipped } from '../runner'
import { withRunStreamBudget } from '../runStream'
import { flowAllowance } from '../scripting/limits'
import { flowTurnInSandbox, sizeSandboxPool } from '../scripting/sandbox'
import { isSocketAddress } from '../socketSessions'
import { timelineHops } from '../timeline'
import { RUNNER_TEXT } from '../runnerText'
import { FLOW_ENGINE_TEXT } from '../flowsText'
import { useAppStore, variableTextFor } from '../../store/appStore'
import { requestCatalog } from './catalog'
import { ACTION_DONE, ACTION_FLOW, ACTION_WAIT, EVENT_HANDLED } from './engine'
import { forgetHistory } from './history'
import { applyInputs } from './inputs'
import { emptyMeter, finishMeter, meterEvents, meterTiming, stepIndexOf } from './metrics'
import { OUTCOME_FAILED, STEP_FLOW, STEP_REQUEST } from './model'

export const RUN_RUNNING = 'running'
export const RUN_STOPPED = 'stopped'
export const NODE_RUNNING = 'running'

const ROOT_SCOPE = { folderId: '', vars: '' }

const topLevel = () => ({ depth: 0, given: {}, root: '' })

export const useFlowRunStore = create(() => ({ runs: {} }))

const store = () => useAppStore.getState()

const patchRun = (tabId, change) => useFlowRunStore.setState((state) => {
  const current = state.runs[tabId]
  return current ? { runs: { ...state.runs, [tabId]: { ...current, ...change(current) } } } : state
})

const markNode = (tabId, step, node) => patchRun(tabId, (run) => ({
  nodes: { ...run.nodes, [step]: { ...run.nodes[step], ...node, visits: (run.nodes[step]?.visits || 0) + (node.state === NODE_RUNNING ? 0 : 1) } },
}))

const addEntry = (tabId, entry) => patchRun(tabId, (run) => ({ entries: [...run.entries, { ...entry, key: run.entries.length }] }))

const isOpenFor = (entry) => (candidate) => candidate.isOpen && candidate.step === entry.step && candidate.depth === entry.depth

const closeEntry = (tabId, entry) => patchRun(tabId, (run) => {
  const at = run.entries.findLastIndex(isOpenFor(entry))
  if (at === -1) return { entries: [...run.entries, { ...entry, key: run.entries.length }] }
  return { entries: run.entries.map((candidate, position) => (position === at ? { ...entry, key: candidate.key } : candidate)) }
})

const openEntry = (action, place) => ({
  type: STEP_FLOW, step: action.step, title: action.title, isOpen: true, ...place,
  event: { step: action.step, kind: STEP_FLOW, title: action.title, status: NODE_RUNNING, summary: '' },
})

const context = (scope) => {
  const state = store()
  return {
    requests: requestCatalog(state.requests, state.folders),
    flows: state.flows,
    variables: { ...parseJSON(variableTextFor(state, ROOT_SCOPE), {}), ...scope.given },
    ...(scope.depth > 0 && { sendsLeft: scope.sendsLeft }),
  }
}

const nestedScope = (scope, action) => ({
  depth: scope.depth + 1,
  given: { ...scope.given, ...action.variables },
  sendsLeft: action.sendsLeft,
  root: scope.root || action.step,
})

const settledResult = (pending, event) => ({
  ...pending,
  tests: [...pending.tests, ...(event.checks || [])],
  handled: event.status === EVENT_HANDLED ? event.summary : '',
  hasFailed: pending.hasFailed || (event.checks || []).some((check) => !check.passed),
})

function withPending(run, entry) {
  if (entry.type !== STEP_REQUEST || run.pending?.step !== entry.step) return entry
  const result = settledResult(run.pending, entry.event)
  run.pending = null
  return { ...entry, result }
}

const placeOf = (scope) => ({ depth: scope.depth, root: scope.root })

const sentBytes = (response) => (response?.timeline ? timelineHops(response.timeline).reduce((total, hop) => total + (hop.requestBytes || 0), 0) : 0)

const withDurations = (nodes, steps) => Object.fromEntries(Object.entries(nodes).map(([id, node]) => (
  steps[id] ? [id, { ...node, durationMs: steps[id].totalMs, lastMs: steps[id].lastMs }] : [id, node]
)))

const withoutNames = (values, names) => Object.fromEntries(Object.entries(values).filter(([name]) => !names.includes(name)))

let sendSequence = 0

async function decide(job) {
  const outcome = await flowTurnInSandbox(job, flowAllowance())
  if (!outcome.turn) throw new Error(outcome.error)
  return outcome.turn
}

const forgetRun = (tabId) => useFlowRunStore.setState((state) => {
  if (!state.runs[tabId]) return state
  const runs = { ...state.runs }
  delete runs[tabId]
  return { runs }
})

export function createFlowRunner(execute, cancel) {
  const active = new Map()

  function pause(run, milliseconds) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, milliseconds)
      run.wake = () => {
        clearTimeout(timer)
        resolve()
      }
    })
  }

  function publish(tabId, run) {
    patchRun(tabId, (current) => ({ metrics: finishMeter(run.meter, Date.now() - run.began), nodes: withDurations(current.nodes, run.meter.steps) }))
  }

  function measure(tabId, run, scope, timing) {
    run.meter = meterTiming(run.meter, run.index, { ...timing, step: scope.depth > 0 ? '' : timing.step })
    publish(tabId, run)
  }

  function absorb(tabId, run, events, scope) {
    const place = placeOf(scope)
    if (scope.depth === 0) run.meter = meterEvents(run.meter, run.index, events)
    events.forEach((event) => {
      if (scope.depth === 0) markNode(tabId, event.step, { state: event.status, attempt: event.attempt, attempts: event.attempts, summary: event.summary })
      const entry = { type: event.kind, step: event.step, title: event.title, event, ...place }
      if (event.kind === STEP_FLOW) closeEntry(tabId, entry)
      else addEntry(tabId, withPending(run, entry))
    })
  }

  function markRunning(tabId, scope, step, progress = {}) {
    if (scope.depth > 0) return markNode(tabId, scope.root, { state: NODE_RUNNING })
    return markNode(tabId, step, { state: NODE_RUNNING, ...progress })
  }

  async function send(tabId, run, action, scope) {
    if (action.delayMs > 0) await pause(run, action.delayMs)
    if (run.isStopped) return {}
    const request = store().requests.find((candidate) => candidate.id === action.requestId)
    const filled = applyInputs(request, action.inputs)
    if (!filled.ok) return { unfilled: filled.message }
    markRunning(tabId, scope, action.step, { attempt: action.attempt, attempts: action.attempts })
    sendSequence += 1
    run.sends += 1
    const sendId = `flow-${sendSequence}`
    run.sendIds.add(sendId)
    run.giveSession({ ...scope.given, ...action.variables })
    const began = Date.now()
    const outcome = isSocketAddress(filled.request.url, variableTextFor(store(), request))
      ? { skipped: RUNNER_TEXT.socketSkipped }
      : await execute(withRunStreamBudget(filled.request), sendId, run.prompts)
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began, sent: sentBytes(outcome.response), received: outcome.response?.size || 0, send: !outcome.skipped })
    run.giveSession({})
    run.sendIds.delete(sendId)
    const result = outcome.skipped ? skipped(request, outcome.skipped) : runResult(filled.request, outcome)
    run.pending = { ...result, step: action.step, attempt: action.attempt, attempts: action.attempts }
    return { response: outcome.skipped ? undefined : outcome.response, failed: result.hasFailed }
  }

  async function runNested(tabId, run, action, scope) {
    markRunning(tabId, scope, action.step)
    const called = store().flows.find((candidate) => candidate.id === action.flowId)
    if (!called) return { outcome: OUTCOME_FAILED, message: FLOW_ENGINE_TEXT.missingFlow(action.flowId), sends: 0 }
    addEntry(tabId, openEntry(action, placeOf(scope)))
    const sendsBefore = run.sends
    const began = Date.now()
    const done = await drive(tabId, run, called, nestedScope(scope, action))
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began })
    return done ? { outcome: done.outcome, message: done.message, budget: done.budget, sends: run.sends - sendsBefore } : {}
  }

  async function perform(tabId, run, action, scope) {
    if (action.kind === ACTION_FLOW) return runNested(tabId, run, action, scope)
    if (action.kind !== ACTION_WAIT) return send(tabId, run, action, scope)
    markRunning(tabId, scope, action.step)
    const began = Date.now()
    await pause(run, action.ms)
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began })
    return {}
  }

  function adopt(tabId, run, turn, scope) {
    const written = Object.keys(turn.writes)
    if (written.length > 0) store().storeSessionVariables(turn.writes)
    scope.given = withoutNames(scope.given, written)
    absorb(tabId, run, turn.events, scope)
  }

  async function drive(tabId, run, flow, scope) {
    let turn = await decide({ flow, context: context(scope) })
    while (!run.isStopped) {
      adopt(tabId, run, turn, scope)
      if (turn.action.kind === ACTION_DONE) return turn.action
      const input = await perform(tabId, run, turn.action, scope)
      if (run.isStopped) return null
      turn = await decide({ flow, state: turn.state, input, context: context(scope) })
    }
    return null
  }

  async function start(tabId, flow) {
    if (active.has(tabId)) return
    const run = {
      isStopped: false, sendIds: new Set(), prompts: rememberPrompts(), giveSession: sessionGiver(store().sessionVariables), pending: null, sends: 0, wake: () => {},
      index: stepIndexOf(flow), meter: emptyMeter(), began: Date.now(),
    }
    active.set(tabId, run)
    sizeSandboxPool(1)
    useFlowRunStore.setState((state) => ({
      runs: { ...state.runs, [tabId]: { status: RUN_RUNNING, flowName: flow.name, startedAt: new Date(), finishedAt: null, message: '', nodes: {}, entries: [], metrics: null } },
    }))
    try {
      const done = await drive(tabId, run, flow, topLevel())
      if (done) patchRun(tabId, () => ({ status: done.outcome, message: done.message, finishedAt: new Date() }))
    } catch (error) {
      if (!run.isStopped) patchRun(tabId, () => ({ status: 'failed', message: error?.message || String(error), finishedAt: new Date() }))
    } finally {
      publish(tabId, run)
      if (active.get(tabId) === run) active.delete(tabId)
    }
  }

  function stop(tabId) {
    const run = active.get(tabId)
    if (!run) return
    run.isStopped = true
    run.wake()
    run.sendIds.forEach(cancel)
    run.giveSession({})
    active.delete(tabId)
    patchRun(tabId, () => ({ status: RUN_STOPPED, finishedAt: new Date() }))
  }

  function discard(tabId) {
    stop(tabId)
    forgetRun(tabId)
    forgetHistory(tabId)
  }

  const isRunning = (tabId) => active.has(tabId)

  return { start, stop, discard, isRunning }
}

export const runResults = (run) => (run?.entries || []).filter((entry) => entry.result).map((entry) => entry.result)
