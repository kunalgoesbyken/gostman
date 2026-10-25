import { isPlainObject } from '../dataUtils'
import { jsonOrText, parseJSON, pretty } from './format'
import { REALTIME_TEXT } from '../realtimeText'
import { SOCKET_TEXT } from '../socketText'

const TEXT = REALTIME_TEXT.socketIo
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


const isDigit = (character) => character >= '0' && character <= '9'

function enginePathOf(request, substitute) {
  const path = substitute(request?.options?.socketIoPath || '').trim()
  if (!path) return ENGINE_PATH
  const rooted = path.startsWith(PATH_SEPARATOR) ? path : PATH_SEPARATOR + path
  return rooted.endsWith(PATH_SEPARATOR) ? rooted : rooted + PATH_SEPARATOR
}

function authPayload(request, substitute) {
  const text = substitute(request?.options?.socketIoAuth || '').trim()
  if (!text) return ''
  const parsed = parseJSON(text)
  if (!parsed || !isPlainObject(parsed.value)) throw new Error(SOCKET_TEXT.invalidAuth)
  return JSON.stringify(parsed.value)
}

function namespaceOf(url, enginePath) {
  const { pathname } = new URL(url)
  if (pathname.startsWith(enginePath)) return DEFAULT_NAMESPACE
  const trimmed = pathname.split(PATH_SEPARATOR).filter(Boolean).join(PATH_SEPARATOR)
  return trimmed ? PATH_SEPARATOR + trimmed : DEFAULT_NAMESPACE
}

function address(url, request, substitute) {
  const target = new URL(url)
  const enginePath = enginePathOf(request, substitute)
  if (!target.pathname.startsWith(enginePath)) target.pathname = enginePath
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

function createSession(channel, { url, request, substitute }) {
  const namespace = namespaceOf(url, enginePathOf(request, substitute))
  const prefix = namespace === DEFAULT_NAMESPACE ? '' : namespace + NAMESPACE_END
  const auth = authPayload(request, substitute)

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
    [ENGINE_OPEN]: () => channel.sendText(ENGINE_MESSAGE + PACKET_CONNECT + prefix + auth),
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
  get targetLabel() {
    return REALTIME_TEXT.targets.event
  },
  hasHandshake: true,
  address,
  createSession,
}
