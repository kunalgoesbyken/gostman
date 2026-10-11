import {
  Authorize,
  CancelAuthorization,
  CancelRequest,
  CloseWorkspace,
  DeleteRequest,
  FetchToken,
  DescribeGrpc,
  InvokeGrpc,
  LoadData,
  OpenWorkspace,
  ParseCurl,
  PickFile,
  PickWorkspaceFolder,
  PrepareRequest,
  ReloadWorkspace,
  ResetData,
  SaveCollectionToFolder,
  SaveCookies,
  SaveEnvironments,
  SaveFile,
  SaveFolders,
  SaveHistory,
  SaveRequests,
  SaveSettings,
  SendRequest,
  WorkspaceStatus,
} from '../../../wailsjs/go/main/App'
import { openDesktopSocket } from './desktopSocket'
import { toGrpcCall, toGrpcTarget } from '../grpc'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'

async function saveRequest(request) {
  const [saved] = await SaveRequests([request])
  return saved
}

const OAUTH_CALLBACK = { url: 'http://localhost:9876/callback', isFixed: false }

const answering = (run) => async (...args) => {
  try {
    return await run(...args)
  } catch (error) {
    return failureResponse('network', error?.message || String(error))
  }
}

const send = answering((id, request, variables, cookies) => SendRequest(id, toEngineRequest(request, variables, cookies)))

const invokeGrpc = answering((id, request, variables) => InvokeGrpc(id, toGrpcCall(request, variables)))

let storageChange = Promise.resolve()

function duringStorageChange(change) {
  const result = change()
  storageChange = result.then(() => {}, () => {})
  return result
}

async function load() {
  await storageChange
  return LoadData()
}

export const desktopBackend = {
  send,
  cancel: (id) => CancelRequest(id),
  prepare: (request, variables) => PrepareRequest(toEngineRequest(request, variables)),
  parseCurl: (command) => ParseCurl(command),
  describeGrpc: (request, variables) => DescribeGrpc(toGrpcTarget(request, variables)),
  invokeGrpc,
  load,
  saveRequest,
  saveRequests: (requests) => SaveRequests(requests),
  deleteRequest: (id) => DeleteRequest(id),
  saveFolders: (folders) => SaveFolders(folders),
  saveHistory: (history) => SaveHistory(history),
  saveEnvironments: (environments, activeId) => SaveEnvironments(environments, activeId),
  saveCookies: (cookies) => SaveCookies(cookies),
  network: {
    saveSettings: (settings) => SaveSettings(settings),
    pickFile: (title) => PickFile(title),
  },
  storage: {
    status: () => WorkspaceStatus(),
    pickFolder: () => PickWorkspaceFolder(),
    openFolder: (path) => OpenWorkspace(path),
    saveToFolder: (path) => SaveCollectionToFolder(path),
    reload: () => ReloadWorkspace(),
    close: () => CloseWorkspace(),
    change: duringStorageChange,
  },
  oauthCallback: OAUTH_CALLBACK,
  authorize: (config, variables) => Authorize(config, variables),
  cancelAuthorization: () => CancelAuthorization(),
  fetchToken: (exchange) => FetchToken(exchange),
  reset: () => ResetData(),
  saveFile: (name, base64) => SaveFile(name, base64),
  openSocket: openDesktopSocket,
  unsentSocketHeaders: () => [],
}
