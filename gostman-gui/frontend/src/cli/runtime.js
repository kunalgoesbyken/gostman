import { extractVariables, parseExtractors } from '../lib/chaining'
import { buildCollectionTree, collectRequests, listFolders } from '../lib/collectionTree'

export { mergeCookies } from '../lib/cookies'
export { toGrpcCall } from '../lib/grpc'
export { normalizeRequest, toEngineRequest } from '../lib/request'
export { countActiveAssertions } from '../lib/scripting/assertions'
export { runJob } from '../lib/scripting/job'
export { TIMED_OUT, TIMEOUT_MS } from '../lib/scripting/limits'
export { applyRequestEdits, requestSubject, responseSubject } from '../lib/scripting/subjects'
export { isSocketAddress } from '../lib/socketUrl'

export const requestsInFolder = (folders, requests, folderId) => (
  collectRequests(buildCollectionTree(folders, requests), folderId)
)

export const folderPaths = (folders) => (
  listFolders(buildCollectionTree(folders, [])).map(({ folder, path }) => ({ id: folder.id, path }))
)

export const extract = (request, response) => extractVariables(parseExtractors(request.extractors), response)
