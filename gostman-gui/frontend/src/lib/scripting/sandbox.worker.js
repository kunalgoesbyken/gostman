import { evaluateExtractors } from '../chaining'
import { runJob } from './job'
import { MESSAGE_REPLY, MESSAGE_RESULT, MESSAGE_SEND } from './messages'

const BLOCKED_GLOBALS = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'WebTransport', 'EventSource', 'importScripts',
  'indexedDB', 'caches', 'BroadcastChannel', 'Worker', 'SharedWorker', 'RTCPeerConnection',
]

function removeGlobal(name) {
  for (let scope = self; scope; scope = Object.getPrototypeOf(scope)) {
    Reflect.deleteProperty(scope, name)
  }
}

BLOCKED_GLOBALS.forEach(removeGlobal)

const run = (job) => (job.extractors ? { outcomes: evaluateExtractors(job.extractors, job.response) } : runJob(job))

const pending = new Map()
let sequence = 0

self.hostSend = (target) => new Promise((resolve, reject) => {
  sequence += 1
  pending.set(sequence, { resolve, reject })
  self.postMessage({ type: MESSAGE_SEND, id: sequence, target })
})

function settle({ id, response, error }) {
  const { resolve, reject } = pending.get(id)
  pending.delete(id)
  if (error) reject(new Error(error))
  else resolve(response)
}

self.onmessage = async ({ data }) => {
  if (data.type === MESSAGE_REPLY) {
    settle(data)
    return
  }
  self.postMessage({ type: MESSAGE_RESULT, result: await run(data.job) })
}
