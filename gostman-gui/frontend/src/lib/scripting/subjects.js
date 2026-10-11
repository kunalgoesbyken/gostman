import { BODY_JSON, BODY_NONE } from '../body'
import { isPlainObject, parseJSON } from '../dataUtils'
import { parseJsonBody, textBody } from '../response'
import { isSentRow, parseRows, serializeRows } from '../rows'

const sentHeaders = (request) => (
  Object.fromEntries(parseRows(request.headers).filter(isSentRow).map((row) => [row.key, row.value]))
)

const scriptBody = (request) => (request.bodyType === BODY_JSON ? parseJSON(request.body, request.body) : request.body)

export function requestSubject(request) {
  return { method: request.method, url: request.url, headers: sentHeaders(request), body: scriptBody(request) }
}

const lowerCased = (headers) => Object.fromEntries((headers || []).map((header) => [header.key.toLowerCase(), header.value]))

export function responseSubject(response) {
  const text = textBody(response)
  return {
    status: response.statusCode,
    statusText: response.status,
    headers: lowerCased(response.headers),
    body: parseJsonBody(text) ?? text,
    responseTime: response.durationMs,
    size: response.size,
    url: response.url,
  }
}

const isSame = (first, second) => JSON.stringify(first) === JSON.stringify(second)

function editedHeaders(request, headers) {
  const unsent = parseRows(request.headers).filter((row) => !isSentRow(row))
  const sent = Object.entries(headers).map(([key, value]) => ({ key, value: String(value), enabled: true }))
  return serializeRows([...sent, ...unsent])
}

function editedBody(request, body) {
  if (typeof body === 'string') return { body }
  const bodyType = request.bodyType === BODY_NONE ? BODY_JSON : request.bodyType
  return { body: JSON.stringify(body, null, 2), bodyType }
}

export function applyRequestEdits(request, edited) {
  const original = requestSubject(request)
  if (!isPlainObject(edited) || isSame(original, edited)) return request
  return {
    ...request,
    method: String(edited.method),
    url: String(edited.url),
    ...(isSame(original.headers, edited.headers) ? {} : { headers: editedHeaders(request, edited.headers || {}) }),
    ...(isSame(original.body, edited.body) ? {} : editedBody(request, edited.body ?? '')),
  }
}
