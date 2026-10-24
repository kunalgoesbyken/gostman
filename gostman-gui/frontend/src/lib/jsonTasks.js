import JsonWorker from './json.worker.js?worker'

let worker = null
let nextId = 0
const waiting = new Map()

function connect() {
  if (worker) return worker
  worker = new JsonWorker()
  worker.onmessage = ({ data }) => {
    const settle = waiting.get(data.id)
    waiting.delete(data.id)
    if (data.failure) settle.reject(new Error(data.failure))
    else settle.resolve(data)
  }
  worker.onerror = (event) => {
    event.preventDefault()
    const failure = new Error(event.message)
    waiting.forEach((settle) => settle.reject(failure))
    waiting.clear()
    worker.terminate()
    worker = null
  }
  return worker
}

function run(task, payload) {
  const id = ++nextId
  connect().postMessage({ id, task, ...payload })
  return new Promise((resolve, reject) => waiting.set(id, { resolve, reject }))
}

export const formatJsonText = (text) => run('format', { text }).then((result) => result.text)

export const filterJsonText = (text, path) => run('filter', { text, path })
