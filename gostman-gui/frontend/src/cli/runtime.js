import { extractVariables, extractWrites as scopedExtraction, parseExtractors } from '../lib/chaining'
import { buildCollectionTree, collectRequests, listFolders } from '../lib/collectionTree'
import { SCOPE_SESSION } from '../lib/scripting/scopes'

export { contractChecks, operationKey } from '../lib/contract'
export { mergeCookies } from '../lib/cookies'
export { buildDocs } from '../lib/docs'
export { toGrpcCall } from '../lib/grpc'
export { toMcpCall } from '../lib/mcp'
export { exportToPostman } from '../lib/postmanExport'
export { normalizeRequest, toEngineRequest } from '../lib/request'
export { countActiveAssertions } from '../lib/scripting/assertions'
export { runJob } from '../lib/scripting/job'
export { collectionHosts } from '../lib/scripting/destinations'
export { acceptedCookies, scriptCookies } from '../lib/scripting/scriptCookies'
export { MAX_FLOW_STEPS, MAX_SENDS, SEND_TIMEOUT_MS, TIMEOUT_MS, extractAllowance, scriptAllowance } from '../lib/scripting/limits'
export { applyRequestEdits, requestSubject, responseSubject, scriptedRequest } from '../lib/scripting/subjects'
export { isSocketAddress } from '../lib/socketUrl'

export const requestsInFolder = (folders, requests, folderId, sharedOrder) => (
  collectRequests(buildCollectionTree(folders, requests, sharedOrder), folderId)
)

export const folderPaths = (folders) => (
  listFolders(buildCollectionTree(folders, [])).map(({ folder, path }) => ({ id: folder.id, path }))
)

export const extract = (request, response) => extractVariables(parseExtractors(request.extractors), response)

export const extractWrites = (request, response) => scopedExtraction(parseExtractors(request.extractors), response, SCOPE_SESSION)
