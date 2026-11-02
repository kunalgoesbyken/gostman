import { BODY_SOAP } from './body'
import { HTTP_METHODS } from './constants'
import { GRAPHQL_METHOD } from './graphqlSchema'
import { GRPC_METHOD } from './grpc'
import { MCP_METHOD } from './mcp'
import { isStreamRequest } from './sse'
import { isWebSocketURL } from './socketUrl'

export const PROTOCOL_HTTP = 'http'
export const PROTOCOL_GRAPHQL = 'graphql'
export const PROTOCOL_GRPC = 'grpc'
export const PROTOCOL_WEBSOCKET = 'websocket'
export const PROTOCOL_SOCKET_IO = 'socketio'
export const PROTOCOL_MQTT = 'mqtt'
export const PROTOCOL_SSE = 'sse'
export const PROTOCOL_SOAP = 'soap'
export const PROTOCOL_MCP = 'mcp'

const SECURE_SOCKET = 'wss://'
const SOCKET_SCHEMES = { 'http://': 'ws://', 'https://': 'wss://' }
const HTTP_SCHEMES = { 'ws://': 'http://', 'wss://': 'https://' }

const PROTOCOL_METHODS = [GRAPHQL_METHOD, GRPC_METHOD, MCP_METHOD]

export const PLAIN_METHODS = HTTP_METHODS.filter((method) => !PROTOCOL_METHODS.includes(method))

const [DEFAULT_METHOD] = PLAIN_METHODS
const SOAP_METHOD = 'POST'

const swapScheme = (address, schemes) => {
  const scheme = Object.keys(schemes).find((candidate) => address.toLowerCase().startsWith(candidate))
  return scheme ? schemes[scheme] + address.slice(scheme.length) : address
}

const asSocketAddress = (address) => {
  if (isWebSocketURL(address)) return address
  const swapped = swapScheme(address, SOCKET_SCHEMES)
  return swapped === address ? SECURE_SOCKET + address.trim() : swapped
}

const plainMethod = (request) => (PLAIN_METHODS.includes(request.method) ? request.method : DEFAULT_METHOD)

const asHttp = (request) => ({
  method: plainMethod(request),
  url: swapScheme(request.url, HTTP_SCHEMES),
  socketProtocol: '',
  options: { ...request.options, stream: false },
  ...(request.bodyType === BODY_SOAP ? { bodyType: '' } : {}),
})

const socket = (socketProtocol) => (request) => ({
  method: plainMethod(request),
  url: asSocketAddress(request.url),
  socketProtocol,
  options: { ...request.options, stream: false },
})

const named = (method) => (request) => ({ ...asHttp(request), method })

export const REQUEST_PROTOCOLS = [
  { id: PROTOCOL_HTTP, apply: asHttp },
  { id: PROTOCOL_GRAPHQL, apply: named(GRAPHQL_METHOD) },
  { id: PROTOCOL_GRPC, apply: named(GRPC_METHOD) },
  { id: PROTOCOL_WEBSOCKET, apply: socket('') },
  { id: PROTOCOL_SSE, apply: (request) => ({ ...asHttp(request), method: 'GET', options: { ...request.options, stream: true } }) },
  { id: PROTOCOL_SOCKET_IO, apply: socket('socketio') },
  { id: PROTOCOL_MQTT, apply: socket('mqtt') },
  { id: PROTOCOL_SOAP, apply: (request) => ({ ...asHttp(request), method: SOAP_METHOD, bodyType: BODY_SOAP }) },
  { id: PROTOCOL_MCP, apply: named(MCP_METHOD) },
]

const BY_METHOD = { [GRAPHQL_METHOD]: PROTOCOL_GRAPHQL, [GRPC_METHOD]: PROTOCOL_GRPC, [MCP_METHOD]: PROTOCOL_MCP }
const BY_SOCKET_PROTOCOL = { socketio: PROTOCOL_SOCKET_IO, mqtt: PROTOCOL_MQTT }

export function protocolIdOf(request, isSocket) {
  if (BY_METHOD[request.method]) return BY_METHOD[request.method]
  if (isSocket) return BY_SOCKET_PROTOCOL[request.socketProtocol] ?? PROTOCOL_WEBSOCKET
  if (request.bodyType === BODY_SOAP) return PROTOCOL_SOAP
  if (isStreamRequest(request)) return PROTOCOL_SSE
  return PROTOCOL_HTTP
}

export const protocolUpdates = (id, request) => REQUEST_PROTOCOLS.find((protocol) => protocol.id === id).apply(request)

const METHOD_BEARING = [PROTOCOL_HTTP, PROTOCOL_SSE, PROTOCOL_SOAP]

export const hasMethodChoice = (id) => METHOD_BEARING.includes(id)
