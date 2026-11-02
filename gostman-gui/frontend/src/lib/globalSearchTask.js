import SearchWorker from './globalSearch.worker.js?worker'
import { SEARCH_HARD_LIMIT_MS } from './globalSearchLimits'

export const TIMED_OUT = 'timedOut'

let running = null

function stop() {
  if (!running) return
  clearTimeout(running.timer)
  running.worker.terminate()
  running.cancel()
  running = null
}

export function searchInWorker(documents, query) {
  stop()
  return new Promise((resolve, reject) => {
    const worker = new SearchWorker()
    const finish = (settle, value) => {
      if (running?.worker !== worker) return
      clearTimeout(running.timer)
      worker.terminate()
      running = null
      settle(value)
    }
    const timer = setTimeout(() => finish(reject, new Error(TIMED_OUT)), SEARCH_HARD_LIMIT_MS)
    running = { worker, timer, cancel: () => resolve(null) }
    worker.onmessage = ({ data }) => (data.failure ? finish(reject, new Error(data.failure)) : finish(resolve, data))
    worker.onerror = (event) => {
      event.preventDefault()
      finish(reject, new Error(event.message))
    }
    worker.postMessage({ documents, query })
  })
}
