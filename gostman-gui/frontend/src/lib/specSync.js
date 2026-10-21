import { normalizeRequest } from './request'

export const SPEC_FIELDS = ['name', 'description', 'method', 'url', 'headers', 'queryParams', 'body', 'bodyType']

const AUTH_FIELDS = ['type', 'token', 'username', 'password', 'key', 'value', 'in']
const HASH_BASE = 36
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

function hashText(text) {
  let hash = FNV_OFFSET
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME)
  }
  return (hash >>> 0).toString(HASH_BASE)
}

export function requestFingerprint(request) {
  const normalized = normalizeRequest(request)
  const fields = SPEC_FIELDS.map((field) => normalized[field])
  const auth = AUTH_FIELDS.map((field) => normalized.auth[field])
  return hashText(JSON.stringify([fields, auth]))
}

export const linkEntry = (requestId, specHash, request, operationId) => (
  [requestId, specHash, requestFingerprint(request), operationId]
)

const readEntry = ([requestId, specHash, localHash, operationId]) => ({ requestId, specHash, localHash, operationId })

export function createLink(source, hash, entries) {
  return { source, hash, syncedAt: new Date().toISOString(), ops: Object.fromEntries(entries) }
}

export function diffSpec(link, operations, requests) {
  const requestsById = new Map(requests.map((request) => [request.id, request]))
  const current = new Map(operations.map((operation) => [operation.key, operation]))
  const known = Object.entries(link.ops)
    .map(([key, entry]) => ({ key, ...readEntry(entry) }))
    .filter((entry) => requestsById.has(entry.requestId))
  const knownKeys = new Set(Object.keys(link.ops))

  const describe = (entry, newKey, operation) => ({
    key: entry.key,
    newKey,
    operation,
    requestId: entry.requestId,
    method: requestsById.get(entry.requestId).method,
    name: requestsById.get(entry.requestId).name,
    edited: requestFingerprint(requestsById.get(entry.requestId)) !== entry.localHash,
  })

  const changed = []
  const gone = []
  let unchanged = 0
  known.forEach((entry) => {
    const operation = current.get(entry.key)
    if (!operation) gone.push(entry)
    else if (operation.hash === entry.specHash) unchanged += 1
    else changed.push(describe(entry, entry.key, operation))
  })

  const fresh = operations.filter((operation) => !knownKeys.has(operation.key))
  const freshByOperationId = new Map(fresh.filter((operation) => operation.operationId).map((operation) => [operation.operationId, operation]))
  const moved = new Set()
  const removed = []
  gone.forEach((entry) => {
    const target = entry.operationId ? freshByOperationId.get(entry.operationId) : undefined
    if (!target || moved.has(target.key)) {
      removed.push(describe(entry, '', null))
      return
    }
    moved.add(target.key)
    changed.push(describe(entry, target.key, target))
  })

  return { added: fresh.filter((operation) => !moved.has(operation.key)), changed, removed, unchanged }
}

export const isEmptyPlan = (plan) => plan.added.length + plan.changed.length + plan.removed.length === 0

export function selectedChanges(plan, selected) {
  const picked = (item) => selected.has(item.key)
  return {
    added: plan.added.filter(picked),
    changed: plan.changed.filter(picked),
    removed: plan.removed.filter(picked),
  }
}

export const defaultSelection = (plan) => new Set([
  ...plan.added.map((item) => item.key),
  ...plan.changed.filter((item) => !item.edited).map((item) => item.key),
  ...plan.removed.filter((item) => !item.edited).map((item) => item.key),
])

export const specPatch = (request) => Object.fromEntries([
  ...SPEC_FIELDS.map((field) => [field, request[field]]),
  ['auth', request.auth],
])
