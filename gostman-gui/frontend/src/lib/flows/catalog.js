import { folderChain } from '../variableScopes'
import { STEP_FLOW, STEP_REQUEST, mapSteps } from './model'
import { resolveFlow, resolveRequest } from './validate'

const PATH_SEPARATOR = '/'

let lastInputs = null
let lastCatalog = []

function catalogEntry(request, folders) {
  const chain = folderChain(folders, request.folderId)
  const names = [...chain.map((folder) => folder.name), request.name]
  return {
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    bodyType: request.bodyType,
    path: names.join(PATH_SEPARATOR),
    collectionId: chain[0]?.id || '',
    collection: chain[0]?.name || '',
    place: (chain.length > 0 ? names.slice(1) : names).join(PATH_SEPARATOR),
  }
}

function buildCatalog(requests, folders) {
  return requests.filter((request) => request.id).map((request) => catalogEntry(request, folders))
}

export function requestCatalog(requests, folders) {
  if (lastInputs && lastInputs[0] === requests && lastInputs[1] === folders) return lastCatalog
  lastInputs = [requests, folders]
  lastCatalog = buildCatalog(requests, folders)
  return lastCatalog
}

function namedRequest(step, catalog) {
  const request = resolveRequest(step, catalog)
  return request ? { ...step, request: request.path, requestId: request.id } : step
}

function namedFlow(step, flows) {
  const called = resolveFlow(step, flows)
  return called ? { ...step, flow: called.name, flowId: called.id } : step
}

export function withReferenceNames(flow, catalog, flows) {
  const named = (step) => {
    if (step.kind === STEP_REQUEST) return namedRequest(step, catalog)
    return step.kind === STEP_FLOW ? namedFlow(step, flows) : step
  }
  return { ...flow, steps: mapSteps(flow.steps, named) }
}
