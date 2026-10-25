import { create } from 'zustand'
import { parseJSON } from '../dataUtils'
import { rememberPrompts } from '../execution'
import { SKIPPED_SOCKET, runResult, sessionGiver, skipped } from '../runner'
import { withRunStreamBudget } from '../runStream'
import { flowAllowance } from '../scripting/limits'
import { flowTurnInSandbox, sizeSandboxPool } from '../scripting/sandbox'
import { isSocketAddress } from '../socketSessions'
import { useAppStore, variableTextFor } from '../../store/appStore'
import { requestCatalog } from './catalog'
import { ACTION_DONE, ACTION_WAIT, EVENT_HANDLED } from './engine'
import { forgetHistory } from './history'
import { STEP_REQUEST } from './model'

export const RUN_RUNNING = 'running'
export const RUN_STOPPED = 'stopped'
export const NODE_RUNNING = 'running'

const ROOT_SCOPE = { folderId: '', vars: '' }

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

const context = () => {
  const state = store()
  return { requests: requestCatalog(state.requests, state.folders), variables: parseJSON(variableTextFor(state, ROOT_SCOPE), {}) }
}

const settledResult = (pending, event) => ({
  ...pending,
  tests: [...pending.tests, ...(event.checks || [])],
  handled: event.status === EVENT_HANDLED ? event.summary : '',
  hasFailed: pending.hasFailed || (event.checks || []).some((check) => !check.passed),
})

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

  function absorb(tabId, run, events) {
    events.forEach((event) => {
      markNode(tabId, event.step, { state: event.status, attempt: event.attempt, attempts: event.attempts, summary: event.summary })
      if (event.kind === STEP_REQUEST && run.pending?.step === event.step) {
        addEntry(tabId, { type: STEP_REQUEST, step: event.step, title: event.title, event, result: settledResult(run.pending, event) })
        run.pending = null
        return
      }
      addEntry(tabId, { type: event.kind, step: event.step, title: event.title, event })
    })
  }

  async function send(tabId, run, action) {
    if (action.delayMs > 0) await pause(run, action.delayMs)
    if (run.isStopped) return {}
    const request = store().requests.find((candidate) => candidate.id === action.requestId)
    markNode(tabId, action.step, { state: NODE_RUNNING, attempt: action.attempt, attempts: action.attempts })
    sendSequence += 1
    const sendId = `flow-${sendSequence}`
    run.sendIds.add(sendId)
    run.giveSession(action.variables || {})
    const outcome = isSocketAddress(request.url, variableTextFor(store(), request))
      ? { skipped: SKIPPED_SOCKET }
      : await execute(withRunStreamBudget(request), sendId, run.prompts)
    run.giveSession({})
    run.sendIds.delete(sendId)
    const result = outcome.skipped ? skipped(request, outcome.skipped) : runResult(request, outcome)
    run.pending = { ...result, step: action.step, attempt: action.attempt, attempts: action.attempts }
    return { response: outcome.skipped ? undefined : outcome.response, failed: result.hasFailed }
  }

  async function perform(tabId, run, action) {
    if (action.kind !== ACTION_WAIT) return send(tabId, run, action)
    markNode(tabId, action.step, { state: NODE_RUNNING })
    await pause(run, action.ms)
    return {}
  }

  function adopt(tabId, run, turn) {
    if (Object.keys(turn.writes).length > 0) store().storeSessionVariables(turn.writes)
    absorb(tabId, run, turn.events)
  }

  async function drive(tabId, run, flow) {
    let turn = await decide({ flow, context: context() })
    while (!run.isStopped) {
      adopt(tabId, run, turn)
      if (turn.action.kind === ACTION_DONE) return turn.action
      const input = await perform(tabId, run, turn.action)
      if (run.isStopped) return null
      turn = await decide({ flow, state: turn.state, input, context: context() })
    }
    return null
  }

  async function start(tabId, flow) {
    if (active.has(tabId)) return
    const run = { isStopped: false, sendIds: new Set(), prompts: rememberPrompts(), giveSession: sessionGiver(store().sessionVariables), pending: null, wake: () => {} }
    active.set(tabId, run)
    sizeSandboxPool(1)
    useFlowRunStore.setState((state) => ({
      runs: { ...state.runs, [tabId]: { status: RUN_RUNNING, flowName: flow.name, startedAt: new Date(), finishedAt: null, message: '', nodes: {}, entries: [] } },
    }))
    try {
      const done = await drive(tabId, run, flow)
      if (done) patchRun(tabId, () => ({ status: done.outcome, message: done.message, finishedAt: new Date() }))
    } catch (error) {
      if (!run.isStopped) patchRun(tabId, () => ({ status: 'failed', message: error?.message || String(error), finishedAt: new Date() }))
    } finally {
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
