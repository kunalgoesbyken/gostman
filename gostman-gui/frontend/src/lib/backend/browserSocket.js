import { REALTIME_TEXT } from '../realtimeText'

const PROTOCOL_HEADER = 'sec-websocket-protocol'
const PROTOCOL_SEPARATOR = ','

const isProtocolHeader = ([name]) => name.trim().toLowerCase() === PROTOCOL_HEADER

const subprotocols = (headers) => headers
  .filter(isProtocolHeader)
  .flatMap(([, value]) => value.split(PROTOCOL_SEPARATOR))
  .map((protocol) => protocol.trim())
  .filter(Boolean)

const toFrame = (data) => (typeof data === 'string' ? { text: data } : { bytes: new Uint8Array(data) })

const describeClose = (event, wasOpen) => REALTIME_TEXT.browser.describeClose(event.code, event.reason, wasOpen)

export const unsentBrowserHeaders = (headers) => headers
  .filter((header) => !isProtocolHeader(header))
  .map(([name]) => name)

export async function openBrowserSocket(url, headers, handlers) {
  const socket = new WebSocket(url, subprotocols(headers))
  let wasOpen = false
  socket.binaryType = 'arraybuffer'
  socket.onopen = () => {
    wasOpen = true
    handlers.onOpen()
  }
  socket.onmessage = (event) => handlers.onMessage(toFrame(event.data))
  socket.onclose = (event) => handlers.onClose(describeClose(event, wasOpen))
  return {
    send: (text) => socket.send(text),
    sendBytes: (bytes) => socket.send(bytes),
    close: () => socket.close(),
  }
}
