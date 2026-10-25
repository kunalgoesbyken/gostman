import { lookup } from '../dataUtils'
import { REALTIME_TEXT as TEXT } from '../realtimeText'
import { parseJSON, pretty } from './format'

const SUBPROTOCOL = 'graphql-transport-ws'
const SUBSCRIPTION_ID = '1'
const CONTENT_TYPE = 'content-type'

const NEXT_LABEL = 'next'

const connectionPayload = (headers) => Object.fromEntries(
  headers
    .filter(({ key }) => key.toLowerCase() !== CONTENT_TYPE)
    .map(({ key, value }) => [key, value]),
)

function createSession(channel, { prepared }) {
  const operation = parseJSON(prepared.body)?.value || {}
  const send = (message) => channel.sendText(JSON.stringify(message))

  const handlers = {
    connection_ack: () => {
      channel.info(TEXT.graphql.subscribing)
      send({ id: SUBSCRIPTION_ID, type: 'subscribe', payload: operation })
    },
    ping: () => send({ type: 'pong' }),
    pong: () => {},
    next: (message) => channel.received(pretty(message.payload), NEXT_LABEL),
    error: (message) => channel.error(pretty(message.payload)),
    complete: () => channel.info(TEXT.graphql.complete),
  }

  return {
    onOpen: () => send({ type: 'connection_init', payload: connectionPayload(prepared.headers) }),
    onFrame(frame) {
      const message = frame.text === undefined ? null : parseJSON(frame.text)?.value
      const handle = lookup(handlers, message?.type)
      if (handle) handle(message)
      else channel.frame(frame)
    },
    compose({ body }) {
      channel.sendText(body)
      return { text: body }
    },
  }
}

export const graphqlProtocol = {
  label: 'GraphQL',
  subprotocol: SUBPROTOCOL,
  createSession,
}
