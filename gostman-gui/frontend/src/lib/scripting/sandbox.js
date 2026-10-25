import SandboxWorker from './sandbox.worker.js?worker'
import { errorLine } from './console'
import { scriptAllowance } from './limits'
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

const refuseSend = () => Promise.reject(new Error(NO_SEND))

const hasScript = (job) => typeof job.script === 'string' && job.script.trim() !== ''

const IDLE_CHECK_WORKERS = 4
const MOST_SPARE_WORKERS = 4
const KEEP_WARM_MS = 30_000
const idleCheckWorkers = []
const spareWorkers = []
let wantedSpares = 2
let coolDown = 0

const terminateAll = (workers) => workers.splice(0).forEach((worker) => worker.terminate())

function coolOff() {
  terminateAll(spareWorkers)
  terminateAll(idleCheckWorkers)
  wantedSpares = 2
}

function keepWarm() {
  clearTimeout(coolDown)
  coolDown = setTimeout(coolOff, KEEP_WARM_MS)
}

function addSpare() {
  const worker = new SandboxWorker()
  worker.onerror = () => {
    const index = spareWorkers.indexOf(worker)
    if (index !== -1) spareWorkers.splice(index, 1)
    worker.terminate()
  }
  spareWorkers.push(worker)
}

function refillSpares() {
  setTimeout(() => {
    while (spareWorkers.length < wantedSpares) addSpare()
  })
}

export const sizeSandboxPool = (parallel) => {
  wantedSpares = Math.min(Math.max(parallel, 1) + 1, MOST_SPARE_WORKERS)
}

function scriptWorker() {
  const worker = spareWorkers.shift() || new SandboxWorker()
  refillSpares()
  return worker
}

const checkWorker = () => idleCheckWorkers.pop() || new SandboxWorker()

function release(worker, isReusable) {
  if (isReusable && idleCheckWorkers.length < IDLE_CHECK_WORKERS) idleCheckWorkers.push(worker)
  else worker.terminate()
}

function runInWorker(job, send, { limit, message }, isReusable) {
  keepWarm()
  return new Promise((resolve) => {
    const worker = isReusable ? checkWorker() : scriptWorker()
    let timer = 0
    const finish = (result, isHealthy) => {
      clearTimeout(timer)
      worker.onmessage = null
      worker.onerror = null
      release(worker, isReusable && isHealthy)
      keepWarm()
      resolve(result)
    }
    timer = setTimeout(() => finish(failure(message), false), limit)
    worker.onmessage = ({ data }) => {
      if (data.type === MESSAGE_RESULT) finish(data.result, true)
      if (data.type === MESSAGE_SEND) answer(worker, data, send)
    }
    worker.onerror = (event) => finish(failure(event.message || NOT_STARTED), false)
    worker.postMessage({ type: MESSAGE_START, job })
  })
}

export function runInSandbox(job, send = refuseSend, timeoutMs = 0) {
  const isReusable = !hasScript(job)
  return runInWorker(job, send, scriptAllowance(timeoutMs, !isReusable), isReusable)
}

export const extractInSandbox = (extractors, response, allowance) => runInWorker({ extractors, response }, refuseSend, allowance, true)

export const checkContractInSandbox = (contract, allowance) => runInWorker({ contract }, refuseSend, allowance, true)
