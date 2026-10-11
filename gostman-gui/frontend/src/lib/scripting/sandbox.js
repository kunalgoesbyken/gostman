import SandboxWorker from './sandbox.worker.js?worker'
import { TIMED_OUT, TIMEOUT_MS } from './limits'

export { applyRequestEdits, requestSubject, responseSubject } from './subjects'

const NOT_STARTED = 'The script could not be started.'

const failure = (error) => ({ tests: [], logs: [], error })

export function runInSandbox(job) {
  return new Promise((resolve) => {
    const worker = new SandboxWorker()
    let timer = 0
    const finish = (result) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(result)
    }
    timer = setTimeout(() => finish(failure(TIMED_OUT)), TIMEOUT_MS)
    worker.onmessage = (event) => finish(event.data)
    worker.onerror = (event) => finish(failure(event.message || NOT_STARTED))
    worker.postMessage(job)
  })
}
