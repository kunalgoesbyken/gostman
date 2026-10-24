import { GRAPHQL_METHOD } from './graphqlSchema'
import { isWebSocketURL } from './socketUrl'

export const SOCKET_METHOD = 'WS'

export const shownMethod = (request, isSocket = isWebSocketURL(request.url)) => (
  isSocket && request.method !== GRAPHQL_METHOD ? SOCKET_METHOD : request.method
)
