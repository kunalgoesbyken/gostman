import { base64ToBytes, textToBase64 } from './base64'
import { MCP_OK, MCP_PROTOCOL } from './mcp'

const ENCODING_BASE64 = 'base64'
const FALLBACK_MIME = 'application/octet-stream'
const FALLBACK_FILE_NAME = 'response'
const UNSAFE_FILE_NAME_CHARACTERS = /[\/:*?"<>|]/g
const JSON_START = /^\s*[[{]/
const GRPC_PROTOCOL = 'grpc'
const GRPC_OK = 0

const HTML_TYPES = ['text/html', 'application/xhtml+xml']

const FILE_EXTENSIONS = {
  'application/json': 'json',
  'application/pdf': 'pdf',
  'application/xml': 'xml',
  'application/zip': 'zip',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'text/css': 'css',
  'text/csv': 'csv',
  'text/html': 'html',
  'text/javascript': 'js',
  'text/plain': 'txt',
  'text/xml': 'xml',
}

export const ERROR_TITLES = {
  config: 'Invalid request',
  network: 'Network error',
  timeout: 'Request timed out',
  cancelled: 'Request cancelled',
  blocked: 'Address blocked',
}

export const BODY_KINDS = {
  EMPTY: 'empty',
  JSON: 'json',
  HTML: 'html',
  TEXT: 'text',
  IMAGE: 'image',
  PDF: 'pdf',
  AUDIO: 'audio',
  VIDEO: 'video',
  BINARY: 'binary',
}

export function failureResponse(kind, message) {
  return {
    status: 'Error',
    statusCode: 0,
    headers: [],
    cookies: [],
    body: message,
    bodyEncoding: 'utf8',
    contentType: '',
    size: 0,
    durationMs: 0,
    url: '',
    truncated: false,
    error: kind,
  }
}

const isBase64 = (response) => response.bodyEncoding === ENCODING_BASE64

export function textBody(response) {
  if (!response || response.error || isBase64(response)) return ''
  return response.body
}

export function parseJsonBody(text) {
  if (!JSON_START.test(text)) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function mediaKind(contentType) {
  if (contentType.startsWith('image/')) return BODY_KINDS.IMAGE
  if (contentType.startsWith('audio/')) return BODY_KINDS.AUDIO
  if (contentType.startsWith('video/')) return BODY_KINDS.VIDEO
  if (contentType === 'application/pdf') return BODY_KINDS.PDF
  return null
}

export function bodyKind(response) {
  if (!response.body) return BODY_KINDS.EMPTY
  const media = mediaKind(response.contentType)
  if (media) return media
  if (isBase64(response)) return BODY_KINDS.BINARY
  if (HTML_TYPES.includes(response.contentType)) return BODY_KINDS.HTML
  return BODY_KINDS.TEXT
}

export function bodyBytes(response) {
  return isBase64(response) ? base64ToBytes(response.body) : new TextEncoder().encode(response.body)
}

export function bodyBase64(response) {
  return isBase64(response) ? response.body : textToBase64(response.body)
}

export function mimeType(response) {
  return response.contentType || FALLBACK_MIME
}

function lastPathSegment(url) {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(segments.pop() || '')
  } catch {
    return ''
  }
}

export function downloadName(response) {
  const name = lastPathSegment(response.url).replace(UNSAFE_FILE_NAME_CHARACTERS, '_') || FALLBACK_FILE_NAME
  const extension = FILE_EXTENSIONS[response.contentType]
  if (!extension || name.toLowerCase().endsWith(`.${extension}`)) return name
  return `${name}.${extension}`
}

const grpcVariant = (statusCode) => (statusCode === GRPC_OK ? 'success' : 'clientError')
const mcpVariant = (status) => (status === MCP_OK ? 'success' : 'clientError')

export function statusVariant({ statusCode, status, protocol }) {
  if (protocol === GRPC_PROTOCOL) return grpcVariant(statusCode)
  if (protocol === MCP_PROTOCOL) return mcpVariant(status)
  if (statusCode >= 500) return 'serverError'
  if (statusCode >= 400) return 'clientError'
  if (statusCode >= 300) return 'redirect'
  if (statusCode >= 200) return 'success'
  return 'default'
}

export function findHeader(headers, name) {
  const wanted = name.toLowerCase()
  const match = (headers || []).find((header) => header.key.toLowerCase() === wanted)
  return match ? match.value : null
}
