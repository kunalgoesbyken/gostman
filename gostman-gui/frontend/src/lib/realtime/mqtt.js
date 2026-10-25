import { REALTIME_TEXT } from '../realtimeText'

const SUBPROTOCOL = 'mqtt'
const TEXT = REALTIME_TEXT.mqtt
const PROTOCOL_NAME = 'MQTT'
const PROTOCOL_LEVEL = 4
const KEEP_ALIVE_SECONDS = 60
const PING_INTERVAL_MS = (KEEP_ALIVE_SECONDS / 2) * 1000
const CLIENT_PREFIX = 'gostman-'
const CLIENT_SUFFIX_BYTES = 4
const MAX_PACKET_ID = 0xffff
const MAX_LENGTH_BYTES = 4

const CONNECT = 1
const CONNACK = 2
const PUBLISH = 3
const PUBACK = 4
const SUBSCRIBE = 8
const SUBACK = 9
const PINGREQ = 12
const PINGRESP = 13

const FLAG_CLEAN_SESSION = 0x02
const FLAG_PASSWORD = 0x40
const FLAG_USERNAME = 0x80
const SUBSCRIBE_FLAGS = 0x02
const SUBACK_FAILURE = 0x80
const AUTH_BASIC = 'basic'


const encoder = new TextEncoder()
const strictDecoder = new TextDecoder('utf-8', { fatal: true })

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function remainingLength(length) {
  const bytes = []
  let rest = length
  do {
    const digit = rest % 128
    rest = Math.floor(rest / 128)
    bytes.push(rest > 0 ? digit | 0x80 : digit)
  } while (rest > 0)
  return Uint8Array.from(bytes)
}

const uint16 = (value) => Uint8Array.of(value >> 8, value & 0xff)

function utf8Field(text) {
  const bytes = encoder.encode(text)
  return concat(uint16(bytes.length), bytes)
}

const packet = (type, flags, body = new Uint8Array(0)) => concat(Uint8Array.of((type << 4) | flags), remainingLength(body.length), body)

function connectPacket({ clientId, username, password }) {
  let flags = FLAG_CLEAN_SESSION
  const credentials = []
  if (username) {
    flags |= FLAG_USERNAME
    credentials.push(utf8Field(username))
    if (password) {
      flags |= FLAG_PASSWORD
      credentials.push(utf8Field(password))
    }
  }
  const header = concat(utf8Field(PROTOCOL_NAME), Uint8Array.of(PROTOCOL_LEVEL, flags), uint16(KEEP_ALIVE_SECONDS))
  return packet(CONNECT, 0, concat(header, utf8Field(clientId), ...credentials))
}

const publishPacket = (topic, payload) => packet(PUBLISH, 0, concat(utf8Field(topic), encoder.encode(payload)))
const subscribePacket = (id, filter) => packet(SUBSCRIBE, SUBSCRIBE_FLAGS, concat(uint16(id), utf8Field(filter), Uint8Array.of(0)))
const pubackPacket = (id) => packet(PUBACK, 0, uint16(id))

function readLength(bytes, start) {
  let length = 0
  let multiplier = 1
  for (let index = start; index < bytes.length && index < start + MAX_LENGTH_BYTES; index += 1) {
    length += (bytes[index] & 0x7f) * multiplier
    if ((bytes[index] & 0x80) === 0) return { length, end: index + 1 }
    multiplier *= 128
  }
  return null
}

function splitPackets(bytes) {
  const packets = []
  let offset = 0
  while (offset < bytes.length) {
    const size = readLength(bytes, offset + 1)
    if (!size || size.end + size.length > bytes.length) break
    packets.push({ type: bytes[offset] >> 4, flags: bytes[offset] & 0x0f, body: bytes.subarray(size.end, size.end + size.length) })
    offset = size.end + size.length
  }
  return { packets, rest: bytes.slice(offset) }
}

const readUint16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1]

function payloadText(bytes) {
  try {
    return strictDecoder.decode(bytes)
  } catch {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ')
  }
}

function clientId() {
  const suffix = crypto.getRandomValues(new Uint8Array(CLIENT_SUFFIX_BYTES))
  return CLIENT_PREFIX + Array.from(suffix, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function credentialsOf(request, substitute) {
  if (request.auth?.type !== AUTH_BASIC) return {}
  return { username: substitute(request.auth.username || ''), password: substitute(request.auth.password || '') }
}

function createSession(channel, { request, substitute }) {
  const pending = new Map()
  let buffer = new Uint8Array(0)
  let lastId = 0
  let pingTimer = null

  const nextId = () => {
    lastId = lastId >= MAX_PACKET_ID ? 1 : lastId + 1
    return lastId
  }

  function receivePublish({ flags, body }) {
    const topicLength = readUint16(body, 0)
    const topic = payloadText(body.subarray(2, 2 + topicLength))
    const qos = (flags >> 1) & 0x03
    const idOffset = 2 + topicLength
    const payloadOffset = qos > 0 ? idOffset + 2 : idOffset
    channel.received(payloadText(body.subarray(payloadOffset)), topic)
    if (qos > 0) channel.sendBytes(pubackPacket(readUint16(body, idOffset)))
  }

  function receiveSuback({ body }) {
    const id = readUint16(body, 0)
    const filter = pending.get(id) || ''
    pending.delete(id)
    if (body[2] === SUBACK_FAILURE) channel.error(TEXT.subscribeRefused(filter))
    else channel.info(TEXT.subscribed(filter))
  }

  const handlers = {
    [CONNACK]: ({ body }) => (body[1] === 0 ? channel.info(TEXT.connected) : channel.error(TEXT.refused(body[1]))),
    [PUBLISH]: receivePublish,
    [SUBACK]: receiveSuback,
    [PINGRESP]: () => {},
  }

  return {
    onOpen() {
      channel.sendBytes(connectPacket({ clientId: clientId(), ...credentialsOf(request, substitute) }))
      pingTimer = setInterval(() => channel.sendBytes(packet(PINGREQ, 0)), PING_INTERVAL_MS)
    },
    onFrame(frame) {
      if (!frame.bytes) {
        channel.error(TEXT.notBinary)
        return
      }
      const { packets, rest } = splitPackets(concat(buffer, frame.bytes))
      buffer = rest
      packets.forEach((received) => handlers[received.type]?.(received))
    },
    compose({ body, target }) {
      const topic = target.trim()
      if (!topic) throw new Error(TEXT.noTopic)
      channel.sendBytes(publishPacket(topic, body))
      return { text: body, label: topic }
    },
    subscribe(filter) {
      const topic = filter.trim()
      if (!topic) throw new Error(TEXT.noFilter)
      const id = nextId()
      pending.set(id, topic)
      channel.sendBytes(subscribePacket(id, topic))
    },
    stop: () => clearInterval(pingTimer),
  }
}

export const mqttProtocol = {
  label: 'MQTT',
  get targetLabel() {
    return REALTIME_TEXT.targets.topic
  },
  subprotocol: SUBPROTOCOL,
  canSubscribe: true,
  createSession,
}
