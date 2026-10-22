import { jsonOrText, parseJSON, pretty } from './format'

const ENGINE_PATH = '/socket.io/'
const ENGINE_QUERY = [['EIO', '4'], ['transport', 'websocket']]
const DEFAULT_NAMESPACE = '/'
const NAMESPACE_END = ','
const PATH_SEPARATOR = '/'

const ENGINE_OPEN = '0'
const ENGINE_CLOSE = '1'
const ENGINE_PING = '2'
const ENGINE_PONG = '3'
const ENGINE_MESSAGE = '4'

const PACKET_CONNECT = '0'
const PACKET_DISCONNECT = '1'
const PACKET_EVENT = '2'
const PACKET_ACK = '3'
const PACKET_CONNECT_ERROR = '4'

const TEXT = {
  joined: (namespace) => `Joined the namespace ${namespace}`,
  left: 'The server left the namespace',
  closed: 'The server closed the Socket.IO session',
  refused: 'The server refused the connection',
  binary: 'Binary Socket.IO packets are not decoded.',
  noEvent: 'Enter an event name to emit.',
  ack: (id) => `ack ${id}`,
}

const isDigit = (character) => character >= '0' && character <= '9'

function namespaceOf(url) {
  const { pathname } = new URL(url)
  if (pathname.startsWith(ENGINE_PATH)) return DEFAULT_NAMESPACE
  const trimmed = pathname.split(PATH_SEPARATOR).filter(Boolean).join(PATH_SEPARATOR)
  return trimmed ? PATH_SEPARATOR + trimmed : DEFAULT_NAMESPACE
}

function address(url) {
  const target = new URL(url)
  if (!target.pathname.startsWith(ENGINE_PATH)) target.pathname = ENGINE_PATH
  ENGINE_QUERY.forEach(([name, value]) => target.searchParams.set(name, value))
  return target.href
}

function parsePacket(text) {
  let index = 1
  let namespace = DEFAULT_NAMESPACE
  if (text[index] === PATH_SEPARATOR) {
    const end = text.indexOf(NAMESPACE_END, index)
    const stop = end < 0 ? text.length : end
    namespace = text.slice(index, stop)
    index = end < 0 ? stop : stop + 1
  }
  const ackStart = index
  while (isDigit(text[index] || '')) index += 1
  return { type: text[0], namespace, ackId: text.slice(ackStart, index), data: parseJSON(text.slice(index))?.value }
}

const argumentsText = (args) => pretty(args.length === 1 ? args[0] : args)

function createSession(channel, { url }) {
  const namespace = namespaceOf(url)
  const prefix = namespace === DEFAULT_NAMESPACE ? '' : namespace + NAMESPACE_END

  const packetHandlers = {
    [PACKET_CONNECT]: () => channel.info(TEXT.joined(namespace)),
    [PACKET_DISCONNECT]: () => channel.info(TEXT.left),
    [PACKET_EVENT]: ({ data }) => {
      const [event, ...args] = Array.isArray(data) ? data : [String(data)]
      channel.received(argumentsText(args), event)
    },
    [PACKET_ACK]: ({ data, ackId }) => channel.received(argumentsText(Array.isArray(data) ? data : [data]), TEXT.ack(ackId)),
    [PACKET_CONNECT_ERROR]: ({ data }) => channel.error(data?.message || TEXT.refused),
  }

  const engineHandlers = {
    [ENGINE_OPEN]: () => channel.sendText(ENGINE_MESSAGE + PACKET_CONNECT + prefix),
    [ENGINE_PING]: () => channel.sendText(ENGINE_PONG),
    [ENGINE_CLOSE]: () => channel.info(TEXT.closed),
    [ENGINE_MESSAGE]: (payload) => {
      const packet = parsePacket(payload)
      if (packet.namespace !== namespace) return
      const handle = packetHandlers[packet.type]
      if (handle) handle(packet)
      else channel.info(TEXT.binary)
    },
  }

  return {
    onFrame(frame) {
      if (frame.bytes) {
        channel.info(TEXT.binary)
        return
      }
      engineHandlers[frame.text[0]]?.(frame.text.slice(1))
    },
    compose({ body, target }) {
      const event = target.trim()
      if (!event) throw new Error(TEXT.noEvent)
      const args = body.trim() === '' ? [] : [jsonOrText(body)]
      channel.sendText(ENGINE_MESSAGE + PACKET_EVENT + prefix + JSON.stringify([event, ...args]))
      return { text: body, label: event }
    },
  }
}

export const socketIoProtocol = {
  label: 'Socket.IO',
  targetLabel: 'Event',
  address,
  createSession,
}
