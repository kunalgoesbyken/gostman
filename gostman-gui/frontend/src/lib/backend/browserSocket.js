const PROTOCOL_HEADER = 'sec-websocket-protocol'
const PROTOCOL_SEPARATOR = ','

const isProtocolHeader = ([name]) => name.trim().toLowerCase() === PROTOCOL_HEADER

const subprotocols = (headers) => headers
  .filter(isProtocolHeader)
  .flatMap(([, value]) => value.split(PROTOCOL_SEPARATOR))
  .map((protocol) => protocol.trim())
  .filter(Boolean)

const toFrame = (data) => (typeof data === 'string' ? { text: data } : { bytes: new Uint8Array(data) })

function describeClose(event, wasOpen) {
  const outcome = wasOpen ? 'Connection closed' : 'Could not connect'
  const reason = event.reason ? `: ${event.reason}` : ''
  return `${outcome} (code ${event.code}${reason})`
}

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
    close: () => socket.close(),
  }
}
