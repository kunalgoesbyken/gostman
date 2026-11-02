import DecodeWorker from './decode.worker.js?worker'
import { DECODE_TIMEOUT_MS } from './limits'

export const TIMED_OUT = 'timedOut'

export function decodeInWorker(format, bytes) {
  return new Promise((resolve, reject) => {
    const worker = new DecodeWorker()
    const finish = (settle, value) => {
      clearTimeout(timer)
      worker.terminate()
      settle(value)
    }
    const timer = setTimeout(() => finish(reject, new Error(TIMED_OUT)), DECODE_TIMEOUT_MS)
    worker.onmessage = ({ data }) => (data.failure ? finish(reject, new Error(data.failure)) : finish(resolve, data.text))
    worker.onerror = (event) => {
      event.preventDefault()
      finish(reject, new Error(event.message))
    }
    worker.postMessage({ format, bytes: bytes.slice() })
  })
}
