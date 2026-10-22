import { lookup } from '../dataUtils'
import { graphqlProtocol } from './graphqlSocket'
import { mqttProtocol } from './mqtt'
import { socketIoProtocol } from './socketIo'

const METHOD_GRAPHQL = 'GRAPHQL'

const websocketProtocol = {
  label: 'WebSocket',
  createSession: (channel) => ({
    onFrame: (frame) => channel.frame(frame),
    compose({ body }) {
      channel.sendText(body)
      return { text: body }
    },
  }),
}

const SELECTABLE = {
  '': websocketProtocol,
  socketio: socketIoProtocol,
  mqtt: mqttProtocol,
}

export const PROTOCOL_OPTIONS = Object.entries(SELECTABLE).map(([value, protocol]) => ({ value, label: protocol.label }))

export const usesGraphQL = (request) => request.method === METHOD_GRAPHQL

export function protocolOf(request) {
  if (usesGraphQL(request)) return graphqlProtocol
  return lookup(SELECTABLE, request.socketProtocol || '') || websocketProtocol
}
