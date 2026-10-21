import {
  Authorize,
  CancelAuthorization,
  CancelRequest,
  CloseWorkspace,
  DeleteRequest,
  FetchToken,
  DescribeGrpc,
  DescribeMcp,
  InvokeGrpc,
  InvokeMcp,
  LoadData,
  OpenAPI,
  OpenWorkspace,
  ParseCurl,
  PickFile,
  PickWorkspaceFolder,
  PrepareRequest,
  ReloadWorkspace,
  ResetData,
  SaveCollectionSettings,
  SaveCollectionToFolder,
  SaveCookies,
  SaveEnvironments,
  SaveFile,
  SaveFolders,
  SaveHistory,
  SaveRequests,
  SaveScopes,
  SaveSettings,
  SendRequest,
  TrustWorkspace,
  WorkspaceStatus,
} from '../../../wailsjs/go/main/App'
import { WEB_APP_URL } from '../constants'
import { desktopCapture } from './desktopCapture'
import { desktopGit } from './desktopGit'
import { desktopMock } from './desktopMock'
import { openDesktopSocket } from './desktopSocket'
import { openDesktopStream } from './desktopStream'
import { toGrpcCall, toGrpcTarget } from '../grpc'
import { toMcpCall, toMcpTarget } from '../mcp'
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

const invokeMcp = answering((id, request, variables) => InvokeMcp(id, toMcpCall(request, variables)))

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
  openapi: (query) => OpenAPI(query),
  openapiPageSize: 0,
  describeGrpc: (request, variables) => DescribeGrpc(toGrpcTarget(request, variables)),
  invokeGrpc,
  describeMcp: (request, variables) => DescribeMcp(toMcpTarget(request, variables)),
  invokeMcp,
  openStream: openDesktopStream,
  streamCapSeconds: 0,
  load,
  saveRequest,
  saveRequests: (requests) => SaveRequests(requests),
  deleteRequest: (id) => DeleteRequest(id),
  saveFolders: (folders) => SaveFolders(folders),
  saveHistory: (history) => SaveHistory(history),
  saveEnvironments: (environments, activeId) => SaveEnvironments(environments, activeId),
  saveScopes: (globals, activeGlobalId, collectionVariables) => SaveScopes(globals, activeGlobalId, collectionVariables),
  saveCollectionSettings: (settings) => SaveCollectionSettings(settings),
  saveCookies: (cookies) => SaveCookies(cookies),
  network: {
    saveSettings: (settings) => SaveSettings(settings),
    pickFile: (title) => PickFile(title),
  },
  mock: desktopMock,
  capture: desktopCapture,
  storage: {
    status: () => WorkspaceStatus(),
    pickFolder: () => PickWorkspaceFolder(),
    openFolder: (path) => OpenWorkspace(path),
    saveToFolder: (path) => SaveCollectionToFolder(path),
    reload: () => ReloadWorkspace(),
    close: () => CloseWorkspace(),
    trust: () => TrustWorkspace(),
    change: duringStorageChange,
    git: desktopGit,
  },
  oauthCallback: OAUTH_CALLBACK,
  authorize: (config, variables) => Authorize(config, variables),
  cancelAuthorization: () => CancelAuthorization(),
  fetchToken: (exchange) => FetchToken(exchange),
  reset: () => ResetData(),
  saveFile: (name, base64) => SaveFile(name, base64),
  webAppUrl: WEB_APP_URL,
  openSocket: openDesktopSocket,
  unsentSocketHeaders: () => [],
}
