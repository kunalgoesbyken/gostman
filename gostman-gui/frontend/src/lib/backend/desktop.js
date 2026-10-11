import {
  CancelRequest,
  DeleteRequest,
  DescribeGrpc,
  InvokeGrpc,
  LoadData,
  ParseCurl,
  PrepareRequest,
  ResetData,
  SaveEnvironments,
  SaveFile,
  SaveFolders,
  SaveHistory,
  SaveRequests,
  SendRequest,
} from '../../../wailsjs/go/main/App'
import { openDesktopSocket } from './desktopSocket'
import { toGrpcCall, toGrpcTarget } from '../grpc'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'

async function saveRequest(request) {
  const [saved] = await SaveRequests([request])
  return saved
}

const answering = (run) => async (...args) => {
  try {
    return await run(...args)
  } catch (error) {
    return failureResponse('network', error?.message || String(error))
  }
}

const send = answering((id, request, variables) => SendRequest(id, toEngineRequest(request, variables)))

const invokeGrpc = answering((id, request, variables) => InvokeGrpc(id, toGrpcCall(request, variables)))

export const desktopBackend = {
  send,
  cancel: (id) => CancelRequest(id),
  prepare: (request, variables) => PrepareRequest(toEngineRequest(request, variables)),
  parseCurl: (command) => ParseCurl(command),
  describeGrpc: (request, variables) => DescribeGrpc(toGrpcTarget(request, variables)),
  invokeGrpc,
  load: () => LoadData(),
  saveRequest,
  saveRequests: (requests) => SaveRequests(requests),
  deleteRequest: (id) => DeleteRequest(id),
  saveFolders: (folders) => SaveFolders(folders),
  saveHistory: (history) => SaveHistory(history),
  saveEnvironments: (environments, activeId) => SaveEnvironments(environments, activeId),
  reset: () => ResetData(),
  saveFile: (name, base64) => SaveFile(name, base64),
  openSocket: openDesktopSocket,
  unsentSocketHeaders: () => [],
}
