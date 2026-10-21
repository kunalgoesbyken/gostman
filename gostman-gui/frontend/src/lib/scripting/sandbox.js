import SandboxWorker from './sandbox.worker.js?worker'
import { errorLine } from './console'
import { TIMED_OUT, TIMEOUT_MS } from './limits'
import { MESSAGE_REPLY, MESSAGE_RESULT, MESSAGE_SEND, MESSAGE_START } from './messages'

export { applyRequestEdits, requestSubject, responseSubject } from './subjects'

const NOT_STARTED = 'The script could not be started.'
const NO_SEND = 'sendRequest is not available here.'

const failure = (error) => ({ tests: [], logs: [errorLine(error)], error })

async function answer(worker, { id, target }, send) {
  try {
    worker.postMessage({ type: MESSAGE_REPLY, id, response: await send(JSON.parse(target)) })
  } catch (error) {
    worker.postMessage({ type: MESSAGE_REPLY, id, error: error.message })
  }
}

export function runInSandbox(job, send = () => Promise.reject(new Error(NO_SEND))) {
  return new Promise((resolve) => {
    const worker = new SandboxWorker()
    let timer = 0
    const finish = (result) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(result)
    }
    timer = setTimeout(() => finish(failure(TIMED_OUT)), TIMEOUT_MS)
    worker.onmessage = ({ data }) => {
      if (data.type === MESSAGE_RESULT) finish(data.result)
      if (data.type === MESSAGE_SEND) answer(worker, data, send)
    }
    worker.onerror = (event) => finish(failure(event.message || NOT_STARTED))
    worker.postMessage({ type: MESSAGE_START, job })
  })
}
