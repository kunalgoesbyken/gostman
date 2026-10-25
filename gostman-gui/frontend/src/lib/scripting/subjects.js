import { BODY_JSON, BODY_NONE } from '../body'
import { isPlainObject, parseJSON } from '../dataUtils'
import { normalizeRequest } from '../request'
import { parseJsonBody, textBody } from '../response'
import { isSentRow, parseRows, serializeRows } from '../rows'
import { bodyText } from './exchange'
import { SEND_TIMEOUT_MS } from './limits'

const headerName = (row) => row.key.trim().toLowerCase()

const overlaidRows = (base, rows) => {
  const named = new Set(rows.map(headerName))
  return [...base.filter((row) => !named.has(headerName(row))), ...rows.filter(isSentRow)]
}

const inheritedRows = (layers) => layers.map((layer) => parseRows(layer.headers)).reduce(overlaidRows, [])

const sentHeaders = (request, layers) => (
  Object.fromEntries(overlaidRows(inheritedRows(layers), parseRows(request.headers)).map((row) => [row.key, row.value]))
)

const scriptBody = (request) => (request.bodyType === BODY_JSON ? parseJSON(request.body, request.body) : request.body)

export function requestSubject(request, layers = []) {
  return {
    name: request.name,
    method: request.method,
    url: request.url,
    headers: sentHeaders(request, layers),
    body: scriptBody(request),
    rawBody: request.body,
    bodyType: request.bodyType,
    timeout: request.options?.timeoutMs ?? 0,
  }
}

const editable = ({ method, url, headers, body, timeout }) => ({ method, url, headers, body, timeout })

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

function editedHeaders(request, headers, layers = []) {
  const unsent = parseRows(request.headers).filter((row) => !isSentRow(row))
  const sent = Object.entries(headers).map(([key, value]) => ({ key, value: String(value), enabled: true }))
  const kept = new Set(sent.map(headerName))
  const removed = inheritedRows(layers).filter((row) => !kept.has(headerName(row))).map((row) => ({ key: row.key, value: '', enabled: false }))
  return serializeRows([...sent, ...unsent, ...removed])
}

function editedBody(request, body) {
  if (typeof body === 'string') return { body }
  const bodyType = request.bodyType === BODY_NONE ? BODY_JSON : request.bodyType
  return { body: bodyText(body), bodyType }
}

const milliseconds = (value) => Math.max(0, Math.trunc(Number(value)) || 0)

const editedOptions = (request, timeout) => ({ options: { ...request.options, timeoutMs: milliseconds(timeout) } })

export function applyRequestEdits(request, edited, layers = []) {
  const original = editable(requestSubject(request, layers))
  if (!isPlainObject(edited) || isSame(original, editable(edited))) return request
  return {
    ...request,
    method: String(edited.method),
    url: String(edited.url),
    ...(isSame(original.headers, edited.headers) ? {} : { headers: editedHeaders(request, edited.headers || {}, layers) }),
    ...(isSame(original.body, edited.body) ? {} : editedBody(request, edited.body ?? '')),
    ...(original.timeout === edited.timeout ? {} : editedOptions(request, edited.timeout)),
  }
}

const findSaved = (library, name) => library.find((saved) => saved.name === name || saved.id === name)

export function scriptedRequest(target, library) {
  if (typeof target === 'string') {
    const saved = findSaved(library, target)
    if (!saved) throw new Error(`No saved request is named "${target}".`)
    return normalizeRequest(saved)
  }
  if (!isPlainObject(target)) throw new Error('sendRequest needs a request object or the name of a saved request.')
  return normalizeRequest({
    method: String(target.method || 'GET').toUpperCase(),
    url: String(target.url ?? ''),
    headers: editedHeaders({ headers: '[]' }, target.headers || {}),
    ...editedBody({ bodyType: BODY_NONE }, target.body ?? ''),
    options: { timeoutMs: Math.min(milliseconds(target.timeout), SEND_TIMEOUT_MS) },
  })
}
