import { isPlainObject } from '../dataUtils'
import { jsonOrText, parseJSON, pretty } from './format'
import { REALTIME_TEXT } from '../realtimeText'
import { toHttpURL } from '../socketUrl'

const TEXT = REALTIME_TEXT.signalR
const RECORD_SEPARATOR = '\u001e'
const NEGOTIATE_SEGMENT = 'negotiate'
const NEGOTIATE_VERSION = '1'
const CONNECTION_PARAMETER = 'id'
const HANDSHAKE = { protocol: 'json', version: 1 }
const KEEP_ALIVE_MS = 15000
const OK_STATUS = 200

const MESSAGE_INVOCATION = 1
const MESSAGE_STREAM_ITEM = 2
const MESSAGE_COMPLETION = 3
const MESSAGE_PING = 6
const MESSAGE_CLOSE = 7

const frame = (message) => JSON.stringify(message) + RECORD_SEPARATOR

const messagesOf = (text) => text.split(RECORD_SEPARATOR).filter(Boolean)

const argumentsText = (args) => pretty(args.length === 1 ? args[0] : args)

function negotiateAddress(url) {
  const address = new URL(toHttpURL(url))
  address.pathname = `${address.pathname.replace(/\/+$/, '')}/${NEGOTIATE_SEGMENT}`
  address.searchParams.set('negotiateVersion', NEGOTIATE_VERSION)
  return address.href
}

function connectionOf(body) {
  const info = parseJSON(body)?.value
  if (!isPlainObject(info)) throw new Error(TEXT.badNegotiate)
  const token = info.connectionToken || info.connectionId
  if (!token) throw new Error(TEXT.badNegotiate)
  return token
}

async function resolveAddress(url, { request, variables, send }) {
  const target = new URL(url)
  if (target.searchParams.has(CONNECTION_PARAMETER)) return url
  const response = await send('signalr-negotiate', { ...request, method: 'POST', url: negotiateAddress(url), body: '', bodyType: 'none' }, variables)
  if (response.error || response.statusCode !== OK_STATUS) throw new Error(TEXT.negotiateFailed(response.error || response.status))
  target.searchParams.set(CONNECTION_PARAMETER, connectionOf(response.body))
  return target.href
}

function createSession(channel) {
  let timer = null
  let invocations = 0

  const handlers = {
    [MESSAGE_INVOCATION]: (message) => channel.received(argumentsText(message.arguments || []), message.target),
    [MESSAGE_STREAM_ITEM]: (message) => channel.received(pretty(message.item), TEXT.streamItem(message.invocationId)),
    [MESSAGE_COMPLETION]: (message) => {
      if (message.error) channel.error(message.error)
      else channel.received(pretty(message.result ?? null), TEXT.completion(message.invocationId))
    },
    [MESSAGE_PING]: () => {},
    [MESSAGE_CLOSE]: (message) => channel.info(message.error ? TEXT.closedWith(message.error) : TEXT.closed),
  }

  let handshaken = false

  const onHandshake = (text) => {
    const message = parseJSON(text)?.value
    handshaken = true
    if (message?.error) channel.error(TEXT.handshakeRefused(message.error))
    else channel.info(TEXT.handshake)
  }

  const onMessage = (text) => {
    const message = parseJSON(text)?.value
    handlers[message?.type]?.(message)
  }

  return {
    onOpen() {
      channel.sendText(frame(HANDSHAKE))
      timer = setInterval(() => channel.sendText(frame({ type: MESSAGE_PING })), KEEP_ALIVE_MS)
    },
    onFrame(received) {
      if (received.text === undefined) {
        channel.frame(received)
        return
      }
      messagesOf(received.text).forEach((text) => (handshaken ? onMessage(text) : onHandshake(text)))
    },
    compose({ body, target }) {
      const method = target.trim()
      if (!method) throw new Error(TEXT.noTarget)
      const value = body.trim() === '' ? [] : jsonOrText(body)
      invocations += 1
      const invocationId = String(invocations)
      channel.sendText(frame({ type: MESSAGE_INVOCATION, invocationId, target: method, arguments: Array.isArray(value) ? value : [value] }))
      return { text: body, label: method }
    },
    stop() {
      clearInterval(timer)
    },
  }
}

export const signalRProtocol = {
  label: 'SignalR',
  get targetLabel() {
    return REALTIME_TEXT.targets.method
  },
  resolveAddress,
  createSession,
}
