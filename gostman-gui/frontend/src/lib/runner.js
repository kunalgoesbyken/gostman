import { buildCollectionTree, collectRequests } from './collectionTree'
import { isSocketAddress } from './socketSessions'
import { selectActiveVariables, useAppStore } from '../store/appStore'

const SKIPPED_SOCKET = 'WebSocket requests are not part of a run.'

const store = () => useAppStore.getState()
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const identify = ({ id, name, method, url }) => ({ id, name, method, url })

const skipped = (request, reason) => ({ ...identify(request), skipped: reason, tests: [], hasFailed: false })

function summarize(request, { response, tests }) {
  const failures = tests.results.filter((result) => !result.passed)
  return {
    ...identify(request),
    status: response.status,
    statusCode: response.statusCode,
    error: response.error ? response.body : tests.error,
    durationMs: response.durationMs,
    tests: tests.results,
    hasFailed: Boolean(response.error) || tests.error !== '' || failures.length > 0,
  }
}

export function requestsInScope(folderId) {
  const { folders, requests } = store()
  return collectRequests(buildCollectionTree(folders, requests), folderId)
}

export function createRunner(backend, execute) {
  let current = null
  let sequence = 0

  async function runOne(run, request) {
    if (isSocketAddress(request.url, selectActiveVariables(store()))) return skipped(request, SKIPPED_SOCKET)
    sequence += 1
    run.sendId = `run-${sequence}`
    return summarize(request, await execute(request, run.sendId))
  }

  async function start({ folderId, delayMs, stopOnFailure }) {
    const run = { isStopped: false, sendId: '' }
    current = run
    store().startRun()
    for (const request of requestsInScope(folderId)) {
      const result = await runOne(run, request)
      if (run.isStopped) break
      store().addRunResult(result)
      if (stopOnFailure && result.hasFailed) break
      if (delayMs > 0) await pause(delayMs)
      if (run.isStopped) break
    }
    if (current === run) store().finishRun()
  }

  function stop() {
    if (!current) return
    current.isStopped = true
    backend.cancel(current.sendId)
    current = null
    store().finishRun()
  }

  return { start, stop }
}
