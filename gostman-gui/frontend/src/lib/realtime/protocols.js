import { lookup } from '../dataUtils'
import { graphqlProtocol } from './graphqlSocket'
import { mqttProtocol } from './mqtt'
import { signalRProtocol } from './signalr'
import { socketIoProtocol } from './socketIo'

const METHOD_GRAPHQL = 'GRAPHQL'

const websocketProtocol = {
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
  signalr: signalRProtocol,
}

export const usesGraphQL = (request) => request.method === METHOD_GRAPHQL

export function protocolOf(request) {
  if (usesGraphQL(request)) return graphqlProtocol
  return lookup(SELECTABLE, request.socketProtocol || '') || websocketProtocol
}
