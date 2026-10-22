import { buildCollectionTree, collectRequests } from './collectionTree'
import { isPlainObject, parseJSON } from './dataUtils'
import { STEP_RUN } from './onboarding'
import { iterationCount, iterationVariables } from './runData'
import { createFlowFollower } from './runFlow'
import { withRunStreamBudget } from './runStream'
import { isSocketAddress } from './socketSessions'
import { selectActiveVariables, useAppStore } from '../store/appStore'

const SKIPPED_SOCKET = 'WebSocket requests are not part of a run.'
const BODY_LIMIT = 64 * 1024
const BASE64 = 'base64'

const store = () => useAppStore.getState()
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const identify = ({ id, name, method, url }) => ({ id, name, method, url })

const flagged = (result, problem) => ({ ...result, error: [result.error, problem].filter(Boolean).join('\n'), hasFailed: true })

const skipped = (request, reason, flow = { action: '' }) => ({ ...identify(request), skipped: reason, tests: [], logs: [], flow, hasFailed: false })

function capture(request, response) {
  const isBinary = response.bodyEncoding === BASE64
  const body = isBinary ? `(binary body, ${response.size} bytes)` : response.body.slice(0, BODY_LIMIT)
  return {
    request: { method: request.method, url: request.url, headers: request.headers, body: request.body },
    response: {
      headers: response.headers || [],
      body,
      contentType: response.contentType,
      size: response.size,
      truncated: !isBinary && (response.truncated || response.body.length > BODY_LIMIT),
    },
  }
}

function summarize(request, { response, tests }, iteration) {
  const failures = tests.results.filter((result) => !result.passed)
  return {
    ...identify(request),
    iteration,
    status: response.status,
    statusCode: response.statusCode,
    protocol: response.protocol,
    streamEnd: response.streamEnd,
    isAnswered: !response.error,
    error: response.error ? response.body : tests.error,
    durationMs: response.durationMs,
    tests: tests.results,
    logs: tests.logs,
    visualization: tests.visualization,
    flow: tests.flow,
    hasFailed: Boolean(response.error) || tests.error !== '' || failures.length > 0,
    exchange: capture(request, response),
  }
}

function requestsInScope(folderId) {
  const { folders, requests } = store()
  return collectRequests(buildCollectionTree(folders, requests), folderId)
}

export function createRunner(backend, execute) {
  let current = null
  let sequence = 0
  let lastRun = null

  async function runOne(run, request, iteration) {
    if (isSocketAddress(request.url, selectActiveVariables(store()))) return skipped(request, SKIPPED_SOCKET)
    sequence += 1
    const sendId = `run-${sequence}`
    run.sendIds.add(sendId)
    const outcome = await execute(withRunStreamBudget(request), sendId)
    run.sendIds.delete(sendId)
    if (outcome.skipped) return skipped(request, outcome.skipped, outcome.tests.flow)
    return summarize(request, outcome, iteration)
  }

  async function runIteration(run, requests, iteration, options) {
    const queue = [...requests]
    const workers = Math.min(Math.max(options.parallel, 1), queue.length)
    const follow = createFlowFollower(run, requests, queue, workers > 1)
    const lanes = Array.from({ length: workers }, async () => {
      while (queue.length > 0 && !run.isStopped && !run.isHalted) {
        const request = queue.shift()
        const outcome = await runOne(run, request, iteration)
        if (run.isStopped) return
        const problem = follow(outcome.flow)
        const result = problem ? flagged(outcome, problem) : outcome
        store().addRunResult(result)
        if (options.stopOnFailure && result.hasFailed) run.isHalted = true
        if (options.delayMs > 0 && !run.isHalted) await pause(options.delayMs)
      }
    })
    await Promise.all(lanes)
  }

  async function start({ folderId, delayMs, stopOnFailure, parallel = 1, rows = [], iterations = 0 }) {
    const run = { isStopped: false, isHalted: false, sendIds: new Set() }
    current = run
    const requests = requestsInScope(folderId)
    const count = iterationCount(rows, iterations)
    const isIterating = rows.length > 0 || count > 1
    const base = selectActiveVariables(store())
    const parsed = parseJSON(base, {})
    lastRun = { startedAt: new Date(), planned: requests.length * count, iterations: isIterating ? count : 0, parallel, finishedAt: null }
    store().startRun()
    store().completeOnboardingStep(STEP_RUN)
    for (let iteration = 0; iteration < count && !run.isStopped && !run.isHalted; iteration += 1) {
      if (isIterating && isPlainObject(parsed)) {
        store().setActiveVariables(JSON.stringify(iterationVariables(parsed, rows, iteration, count), null, 2))
      }
      await runIteration(run, requests, isIterating ? iteration + 1 : 0, { delayMs, stopOnFailure, parallel })
    }
    if (isIterating && isPlainObject(parsed)) store().setActiveVariables(base)
    if (current !== run) return
    lastRun.finishedAt = new Date()
    store().finishRun()
  }

  function stop() {
    if (!current) return
    current.isStopped = true
    current.sendIds.forEach((sendId) => backend.cancel(sendId))
    current = null
    store().finishRun()
  }

  const describeRun = () => lastRun && { ...lastRun, finishedAt: lastRun.finishedAt || new Date() }

  return { start, stop, describeRun }
}
