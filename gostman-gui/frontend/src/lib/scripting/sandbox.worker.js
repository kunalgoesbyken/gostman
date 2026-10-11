import { runJob } from './job'

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

self.onmessage = async (event) => {
  self.postMessage(await runJob(event.data))
}
