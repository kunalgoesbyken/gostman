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
import { declaredTypes } from './declared'
import { ACTION_DONE, ACTION_FLOW, ACTION_PARALLEL, ACTION_WAIT, EVENT_HANDLED } from './engine'
import { forgetHistory } from './history'
import { applyInputs } from './inputs'
import { emptyMeter, finishMeter, isVisit, meterEvents, meterTiming, stepIndexOf } from './metrics'
import { BRANCH_CANCELLED, BRANCH_FAILED, BRANCH_PASSED, OUTCOME_FAILED, OUTCOME_PASSED, STEP_FLOW, STEP_REQUEST, normalizeFlow } from './model'
import { withoutNames } from './values'

export const RUN_RUNNING = 'running'
export const RUN_STOPPED = 'stopped'
export const NODE_RUNNING = 'running'

const ROOT_SCOPE = { folderId: '', vars: '' }

const notCancelled = () => false

const topLevel = () => ({
  depth: 0, given: {}, root: '', counters: [], children: [], pending: new Map(), sendIds: new Set(), wakers: new Set(), isCancelled: notCancelled, concurrent: false,
})

function branchScope(scope) {
  const token = { cancelled: false }
  const branch = {
    ...scope,
    pending: new Map(),
    sendIds: new Set(),
    wakers: new Set(),
    children: [],
    concurrent: true,
    token,
    isCancelled: () => token.cancelled || scope.isCancelled(),
  }
  scope.children.push(branch)
  return branch
}

export const useFlowRunStore = create(() => ({ runs: {} }))

const store = () => useAppStore.getState()

const patchRun = (tabId, change) => useFlowRunStore.setState((state) => {
  const current = state.runs[tabId]
  return current ? { runs: { ...state.runs, [tabId]: { ...current, ...change(current) } } } : state
})

const markNode = (tabId, step, node, visits = 0) => patchRun(tabId, (run) => ({
  nodes: { ...run.nodes, [step]: { ...run.nodes[step], ...node, visits: (run.nodes[step]?.visits || 0) + visits } },
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
  ...scope,
  depth: scope.depth + 1,
  given: { ...scope.given, ...action.variables },
  sendsLeft: action.sendsLeft,
  root: scope.root || action.step,
  counter: { sends: 0 },
  counters: [...scope.counters],
  pending: new Map(),
})

function nestedScopeOf(scope, action) {
  const nested = nestedScope(scope, action)
  nested.counters.push(nested.counter)
  return nested
}

const settledResult = (pending, event) => ({
  ...pending,
  tests: [...pending.tests, ...(event.checks || [])],
  handled: event.status === EVENT_HANDLED ? event.summary : '',
  hasFailed: pending.hasFailed || (event.checks || []).some((check) => !check.passed),
})

function withPending(scope, entry) {
  const pending = scope.pending.get(entry.step)
  if (entry.type !== STEP_REQUEST || !pending) return entry
  scope.pending.delete(entry.step)
  return { ...entry, result: settledResult(pending, entry.event) }
}

const mergedOverlays = (overlays) => Object.assign({}, ...overlays.values())

function overlaid(run, sendId, variables) {
  if (variables) run.overlays.set(sendId, variables)
  else run.overlays.delete(sendId)
  run.giveSession(mergedOverlays(run.overlays))
}

function cancelScope(scope, cancel) {
  scope.token.cancelled = true
  scope.sendIds.forEach(cancel)
  scope.wakers.forEach((wake) => wake())
  scope.children.forEach((child) => cancelScope(child, cancel))
}

const placeOf = (scope) => ({ depth: scope.depth, root: scope.root })

const sentBytes = (response) => (response?.timeline ? timelineHops(response.timeline).reduce((total, hop) => total + (hop.requestBytes || 0), 0) : 0)

const withDurations = (nodes, steps) => Object.fromEntries(Object.entries(nodes).map(([id, node]) => (
  steps[id] ? [id, { ...node, durationMs: steps[id].totalMs }] : [id, node]
)))

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

  function pause(run, scope, milliseconds) {
    return new Promise((resolve) => {
      const wake = () => {
        clearTimeout(timer)
        run.wakers.delete(wake)
        scope.wakers.delete(wake)
        resolve()
      }
      const timer = setTimeout(wake, milliseconds)
      run.wakers.add(wake)
      scope.wakers.add(wake)
    })
  }

  function publish(tabId, run) {
    const metrics = finishMeter(run.meter, Date.now() - run.began)
    patchRun(tabId, (current) => ({ metrics, nodes: withDurations(current.nodes, metrics.steps) }))
  }

  function measure(tabId, run, scope, timing) {
    run.meter = meterTiming(run.meter, run.index, { ...timing, step: scope.depth > 0 ? '' : timing.step, concurrent: scope.concurrent })
    publish(tabId, run)
  }

  function absorb(tabId, run, events, scope) {
    const place = placeOf(scope)
    if (scope.depth === 0) run.meter = meterEvents(run.meter, run.index, events)
    events.forEach((event) => {
      if (scope.depth === 0) markNode(tabId, event.step, { state: event.status, attempt: event.attempt, attempts: event.attempts, summary: event.summary }, isVisit(run.index, event) ? 1 : 0)
      const entry = { type: event.kind, step: event.step, title: event.title, event, ...place }
      if (event.kind === STEP_FLOW) closeEntry(tabId, entry)
      else addEntry(tabId, withPending(scope, entry))
    })
  }

  function markRunning(tabId, scope, step, progress = {}) {
    if (scope.depth > 0) return markNode(tabId, scope.root, { state: NODE_RUNNING })
    return markNode(tabId, step, { state: NODE_RUNNING, ...progress })
  }

  async function send(tabId, run, action, scope) {
    if (action.delayMs > 0) await pause(run, scope, action.delayMs)
    if (run.isStopped || scope.isCancelled()) return {}
    const request = store().requests.find((candidate) => candidate.id === action.requestId)
    const filled = applyInputs(request, action.inputs)
    if (!filled.ok) return { unfilled: filled.message }
    markRunning(tabId, scope, action.step, { attempt: action.attempt, attempts: action.attempts })
    sendSequence += 1
    run.sends += 1
    scope.counters.forEach((counter) => { counter.sends += 1 })
    const sendId = `flow-${sendSequence}`
    run.sendIds.add(sendId)
    scope.sendIds.add(sendId)
    const given = { ...scope.given, ...action.variables }
    const outgoing = scope.concurrent ? { ...filled.request, flowGiven: given } : filled.request
    if (!scope.concurrent) overlaid(run, sendId, given)
    const began = Date.now()
    const outcome = isSocketAddress(outgoing.url, variableTextFor(store(), outgoing))
      ? { skipped: RUNNER_TEXT.socketSkipped }
      : await execute(withRunStreamBudget(outgoing), sendId, run.prompts)
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began, sent: sentBytes(outcome.response), received: outcome.response?.size || 0, send: !outcome.skipped })
    if (!scope.concurrent) overlaid(run, sendId, null)
    run.sendIds.delete(sendId)
    scope.sendIds.delete(sendId)
    const result = outcome.skipped ? skipped(request, outcome.skipped) : runResult(filled.request, outcome)
    scope.pending.set(action.step, { ...result, step: action.step, attempt: action.attempt, attempts: action.attempts })
    return { response: outcome.skipped ? undefined : outcome.response, failed: result.hasFailed, skipped: outcome.skipped }
  }

  async function runNested(tabId, run, action, scope) {
    markRunning(tabId, scope, action.step)
    const called = store().flows.find((candidate) => candidate.id === action.flowId)
    if (!called) return { outcome: OUTCOME_FAILED, message: FLOW_ENGINE_TEXT.missingFlow(action.flowId), sends: 0 }
    addEntry(tabId, openEntry(action, placeOf(scope)))
    const nested = nestedScopeOf(scope, action)
    const began = Date.now()
    const done = await drive(tabId, run, called, nested)
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began })
    return done ? { outcome: done.outcome, message: done.message, budget: done.budget, sends: nested.counter.sends, outputs: done.outputs } : {}
  }

  async function runBranch(tabId, run, branch, scope) {
    const began = Date.now()
    const input = branch.kind === ACTION_FLOW ? await flowBranch(tabId, run, branch, scope) : await sendBranch(tabId, run, branch, scope)
    const ms = Date.now() - began
    const state = scope.isCancelled() && input.state !== BRANCH_PASSED ? BRANCH_CANCELLED : input.state
    return { input: { ...input, state, ms }, result: scope.pending.get(branch.step) || null }
  }

  async function flowBranch(tabId, run, branch, scope) {
    const done = await runNested(tabId, run, branch, scope)
    return { state: done.outcome === OUTCOME_PASSED ? BRANCH_PASSED : BRANCH_FAILED, message: done.message || '', sends: done.sends || 0, budget: done.budget, outputs: done.outputs }
  }

  async function sendBranch(tabId, run, branch, scope) {
    const sent = await send(tabId, run, branch, scope)
    if (typeof sent.unfilled === 'string') return { state: BRANCH_FAILED, message: sent.unfilled }
    if (sent.skipped) return { state: BRANCH_FAILED, message: sent.skipped }
    const arrived = Boolean(sent.response) && !sent.response.error
    return { state: arrived && !sent.failed ? BRANCH_PASSED : BRANCH_FAILED, response: sent.response, message: sent.response?.error || '' }
  }

  async function parallel(tabId, run, flow, turn, scope) {
    const { action } = turn
    markRunning(tabId, scope, action.step)
    const began = Date.now()
    const states = {}
    const order = []
    const branches = action.branches.map((branch) => ({ branch, scope: branchScope(scope) }))
    const control = { stopping: false, timedOut: false, doneAt: null, asked: Promise.resolve() }
    const stopAll = () => {
      control.stopping = true
      branches.forEach((entry) => cancelScope(entry.scope, cancel))
    }
    const timer = action.timeoutMs > 0 ? setTimeout(() => {
      if (control.stopping) return
      control.timedOut = true
      stopAll()
    }, action.timeoutMs) : null
    const ask = async () => {
      if (control.stopping) return
      const input = { branches: { ...states }, order: [...order], elapsedMs: Date.now() - began }
      const next = await decide({ flow, state: turn.state, input, context: context(scope) })
      if (next.action.stop && !control.stopping) {
        control.doneAt = input
        stopAll()
      }
    }
    try {
      await Promise.all(branches.map(async (entry) => {
        const done = await runBranch(tabId, run, entry.branch, entry.scope)
        states[entry.branch.step] = done.input
        order.push(entry.branch.step)
        if (done.result) scope.pending.set(entry.branch.step, done.result)
        if (order.length === branches.length) return
        control.asked = control.asked.then(ask)
        await control.asked
      }))
    } catch (error) {
      stopAll()
      throw error
    } finally {
      clearTimeout(timer)
      branches.forEach((entry) => scope.children.splice(scope.children.indexOf(entry.scope), 1))
    }
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began })
    if (run.isStopped || scope.isCancelled()) return null
    const settled = { branches: states, order, elapsedMs: Date.now() - began, settled: true, timedOut: control.timedOut, ...(control.doneAt && { doneAt: control.doneAt }) }
    return decide({ flow, state: turn.state, input: settled, context: context(scope) })
  }

  async function perform(tabId, run, action, scope) {
    if (action.kind === ACTION_FLOW) return runNested(tabId, run, action, scope)
    if (action.kind !== ACTION_WAIT) return send(tabId, run, action, scope)
    markRunning(tabId, scope, action.step)
    const began = Date.now()
    await pause(run, scope, action.ms)
    measure(tabId, run, scope, { step: action.step, ms: Date.now() - began })
    return {}
  }

  function watchVariables(tabId, run, turn, scope) {
    if (scope.depth > 0) return
    run.written = { ...withoutNames(run.written, turn.forgets), ...turn.writes }
    const variables = turn.action.kind === ACTION_DONE ? turn.action.variables || {} : turn.state.locals || {}
    const outputs = turn.action.kind === ACTION_DONE ? turn.action.outputs || {} : null
    patchRun(tabId, () => ({ variables, written: run.written, ...(outputs && { outputs }) }))
  }

  function adopt(tabId, run, turn, scope) {
    const changed = [...Object.keys(turn.writes), ...turn.forgets]
    if (changed.length > 0) store().storeSessionVariables(turn.writes, turn.forgets)
    scope.given = withoutNames(scope.given, changed)
    watchVariables(tabId, run, turn, scope)
    absorb(tabId, run, turn.events, scope)
  }

  const isLive = (run, scope) => !run.isStopped && !scope.isCancelled()

  async function drive(tabId, run, flow, scope) {
    let turn = await decide({ flow, context: context(scope) })
    while (turn && isLive(run, scope)) {
      adopt(tabId, run, turn, scope)
      if (turn.action.kind === ACTION_DONE) return turn.action
      if (turn.action.kind === ACTION_PARALLEL) {
        turn = await parallel(tabId, run, flow, turn, scope)
      } else {
        const input = await perform(tabId, run, turn.action, scope)
        turn = isLive(run, scope) ? await decide({ flow, state: turn.state, input, context: context(scope) }) : null
      }
    }
    return null
  }

  async function start(tabId, flow) {
    if (active.has(tabId)) return
    const run = {
      isStopped: false, sendIds: new Set(), prompts: rememberPrompts(), giveSession: sessionGiver(store().sessionVariables), overlays: new Map(), sends: 0, wakers: new Set(),
      index: stepIndexOf(flow), meter: emptyMeter(), began: Date.now(), written: {},
    }
    active.set(tabId, run)
    sizeSandboxPool(1)
    useFlowRunStore.setState((state) => ({
      runs: {
        ...state.runs,
        [tabId]: {
          status: RUN_RUNNING, flowName: flow.name, startedAt: new Date(), finishedAt: null, message: '', nodes: {}, entries: [], metrics: null,
          types: declaredTypes(normalizeFlow(flow)), variables: {}, written: {}, outputs: null,
        },
      },
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
    run.wakers.forEach((wake) => wake())
    run.sendIds.forEach(cancel)
    run.overlays.clear()
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
