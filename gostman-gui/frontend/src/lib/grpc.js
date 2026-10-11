import { parseJSON } from './dataUtils'

export const GRPC_METHOD = 'GRPC'

export const isGrpcRequest = (request) => request.method === GRPC_METHOD
export const GRPC_PANEL = 'grpc'

const BLANK_MESSAGES = ['', '{}']

const isProtoFile = (file) => typeof file?.name === 'string' && typeof file?.content === 'string'

export function parseProtoFiles(json) {
  const files = parseJSON(json, [])
  return Array.isArray(files) ? files.filter(isProtoFile) : []
}

export const serializeProtoFiles = (files) => (files.length > 0 ? JSON.stringify(files) : '')

export async function readProtoFile(file) {
  return { name: file.name, content: await file.text() }
}

export function mergeProtoFiles(existing, added) {
  const replaced = new Set(added.map((file) => file.name))
  return [...existing.filter((file) => !replaced.has(file.name)), ...added]
}

export function toGrpcTarget(request, variables) {
  const { url, headers, auth, options, grpcProtos } = request
  return { address: url, headers, auth, options, variables, protos: parseProtoFiles(grpcProtos) }
}

export function toGrpcCall(request, variables) {
  return { target: toGrpcTarget(request, variables), method: request.grpcMethod, message: request.grpcMessage }
}

export function findMethod(services, fullName) {
  return services.flatMap((service) => service.methods).find((method) => method.fullName === fullName)
}

export function methodKind(method) {
  if (method.clientStreaming && method.serverStreaming) return 'Bidirectional streaming'
  if (method.clientStreaming) return 'Client streaming'
  if (method.serverStreaming) return 'Server streaming'
  return 'Unary'
}

export const isBlankMessage = (message) => BLANK_MESSAGES.includes(message.trim())
