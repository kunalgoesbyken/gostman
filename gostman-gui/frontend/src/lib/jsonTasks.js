import JsonWorker from './json.worker.js?worker'
import { filterAllowance } from './scripting/limits'

let worker = null
let nextId = 0
const waiting = new Map()

function take(id) {
  const entry = waiting.get(id)
  waiting.delete(id)
  clearTimeout(entry?.timer)
  return entry
}

function connect() {
  if (worker) return worker
  worker = new JsonWorker()
  worker.onmessage = ({ data }) => {
    const entry = take(data.id)
    if (!entry) return
    if (data.failure) entry.reject(new Error(data.failure))
    else entry.resolve(data)
  }
  worker.onerror = (event) => {
    event.preventDefault()
    const failure = new Error(event.message)
    ;[...waiting.keys()].forEach((id) => take(id).reject(failure))
    worker.terminate()
    worker = null
  }
  return worker
}

function restart() {
  worker.terminate()
  worker = null
  waiting.forEach((entry) => connect().postMessage(entry.message))
}

function expire(id, outcome) {
  take(id).resolve(outcome)
  restart()
}

function run(task, payload, deadline) {
  const id = ++nextId
  const message = { id, task, ...payload }
  connect().postMessage(message)
  return new Promise((resolve, reject) => {
    const timer = deadline ? setTimeout(() => expire(id, deadline.outcome), deadline.limit) : 0
    waiting.set(id, { message, resolve, reject, timer })
  })
}

export const formatJsonText = (text) => run('format', { text }).then((result) => result.text)

export function filterJsonText(text, path, withValue) {
  const { limit, message } = filterAllowance()
  return run('filter', { text, path, withValue }, { limit, outcome: { active: true, error: message } })
}
