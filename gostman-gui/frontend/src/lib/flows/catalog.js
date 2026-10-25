import { folderChain } from '../variableScopes'
import { STEP_REQUEST, mapSteps } from './model'
import { resolveRequest } from './validate'

const PATH_SEPARATOR = '/'

let lastInputs = null
let lastCatalog = []

function buildCatalog(requests, folders) {
  return requests.filter((request) => request.id).map((request) => ({
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    path: [...folderChain(folders, request.folderId).map((folder) => folder.name), request.name].join(PATH_SEPARATOR),
  }))
}

export function requestCatalog(requests, folders) {
  if (lastInputs && lastInputs[0] === requests && lastInputs[1] === folders) return lastCatalog
  lastInputs = [requests, folders]
  lastCatalog = buildCatalog(requests, folders)
  return lastCatalog
}

export function withRequestPaths(flow, catalog) {
  const named = (step) => {
    if (step.kind !== STEP_REQUEST) return step
    const request = resolveRequest(step, catalog)
    return request ? { ...step, request: request.path, requestId: request.id } : step
  }
  return { ...flow, steps: mapSteps(flow.steps, named) }
}
