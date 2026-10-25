import {
  AttachmentSize,
  Authorize,
  CancelAuthorization,
  CancelRequest,
  CloseWorkspace,
  CollectionNetwork,
  DeleteRequests,
  FetchLink,
  FetchToken,
  ForgetWorkspace,
  InstalledFonts,
  DescribeGrpc,
  DescribeMcp,
  DiscoverIssuer,
  DiscoverMcpAuthorization,
  ExpandTexts,
  Import,
  InvokeGrpc,
  InvokeMcp,
  LoadData,
  LintSpec,
  OpenAPI,
  OpenWorkspace,
  ParseCurl,
  PickFile,
  PickWorkspaceFolder,
  PinWorkspace,
  PrepareRequest,
  ReloadWorkspace,
  RenameWorkspace,
  ResetData,
  RevealWorkspace,
  SaveCollectionPassphrase,
  SaveCollectionSettings,
  SaveCollectionToFolder,
  SaveCookies,
  SaveEnvironments,
  SaveFile,
  SaveFlows,
  SaveFolders,
  SaveHistory,
  SaveRequests,
  SaveScopes,
  SaveSettings,
  ShareSiblingOrder,
  ScanSecrets,
  ScriptModules,
  SendRequest,
  StartDeviceAuthorization,
  TrustWorkspace,
  WorkspaceStatus,
} from '../../../wailsjs/go/main/App'
import { EventsOn } from '../../../wailsjs/runtime/runtime'
import { WEB_APP_URL } from '../constants'
import { desktopAi } from './desktopAi'
import { createDesktopBackups, desktopUpdates } from './desktopBackups'
import { desktopCapture } from './desktopCapture'
import { desktopGit } from './desktopGit'
import { desktopLoadTest } from './desktopLoadTest'
import { desktopMock } from './desktopMock'
import { desktopSecrets } from './desktopSecrets'
import { openDesktopSocket } from './desktopSocket'
import { openDesktopStream } from './desktopStream'
import { desktopWindowFrame } from './desktopWindowFrame'
import { allowDiskAttachments } from '../attachments'
import { toGrpcCall, toGrpcTarget } from '../grpc'
import { toMcpCall, toMcpTarget } from '../mcp'
import { withPreferredTimeout } from '../preferences'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'
import { createStorageGate } from './storageGate'
import { localRecords } from '../storage'

const DISK_CHANGED_EVENT = 'workspace:changed'

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

const send = answering((id, request, variables, cookies) => SendRequest(id, toEngineRequest(withPreferredTimeout(request), variables, cookies)))

const invokeGrpc = answering((id, request, variables) => InvokeGrpc(id, toGrpcCall(request, variables)))

const invokeMcp = answering((id, request, variables) => InvokeMcp(id, toMcpCall(request, variables)))

const storageGate = createStorageGate()

allowDiskAttachments({ pick: PickFile, measure: AttachmentSize })

async function load() {
  await storageGate.settled()
  return LoadData()
}

export const desktopBackend = {
  send,
  cancel: (id) => CancelRequest(id),
  prepare: (request, variables) => PrepareRequest(toEngineRequest(request, variables)),
  expand: (texts, variables) => ExpandTexts(texts, variables),
  parseCurl: (command) => ParseCurl(command),
  openapi: (query) => OpenAPI(query),
  lint: (query) => LintSpec(query),
  importer: (query) => Import(query),
  scan: (query) => ScanSecrets(query),
  fetchLink: (address) => FetchLink(address),
  openapiPageSize: 0,
  describeGrpc: (request, variables) => DescribeGrpc(toGrpcTarget(request, variables)),
  invokeGrpc,
  describeMcp: (request, variables) => DescribeMcp(toMcpTarget(request, variables)),
  discoverMcpAuthorization: (query) => DiscoverMcpAuthorization({ ...query, native: true }),
  runsLocalCommands: true,
  invokeMcp,
  openStream: openDesktopStream,
  streamCapSeconds: 0,
  load,
  saveRequest,
  saveRequests: (requests) => SaveRequests(requests),
  deleteRequests: (ids) => DeleteRequests(ids),
  saveFolders: (folders) => SaveFolders(folders),
  saveFlows: (flows) => SaveFlows(flows),
  saveHistory: (history) => SaveHistory(history),
  saveEnvironments: (environments, activeId) => SaveEnvironments(environments, activeId),
  saveScopes: (globals, activeGlobalId, collectionVariables, collectionVariablesMeta) => SaveScopes(globals, activeGlobalId, collectionVariables, collectionVariablesMeta),
  saveCollectionSettings: (settings) => SaveCollectionSettings(settings),
  shareOrder: () => ShareSiblingOrder(),
  saveCookies: (cookies) => SaveCookies(cookies),
  tabDrafts: localRecords(window.localStorage),
  network: {
    saveSettings: (settings) => SaveSettings(settings),
    pickFile: (title) => PickFile(title),
    collection: () => CollectionNetwork(),
    saveCollectionPassphrase: (host, certFile, passphrase) => SaveCollectionPassphrase(host, certFile, passphrase),
  },
  ai: desktopAi,
  mock: desktopMock,
  secrets: desktopSecrets,
  capture: desktopCapture,
  loadTest: desktopLoadTest,
  storage: {
    status: () => WorkspaceStatus(),
    pickFolder: () => PickWorkspaceFolder(),
    openFolder: (path) => OpenWorkspace(path),
    saveToFolder: (path) => SaveCollectionToFolder(path),
    reload: () => ReloadWorkspace(),
    close: () => CloseWorkspace(),
    pin: (path, pinned) => PinWorkspace(path, pinned),
    rename: (path, name) => RenameWorkspace(path, name),
    forget: (path) => ForgetWorkspace(path),
    reveal: (path) => RevealWorkspace(path),
    trust: () => TrustWorkspace(),
    scriptModules: () => ScriptModules(),
    change: storageGate.during,
    onDiskChange: (listener) => EventsOn(DISK_CHANGED_EVENT, listener),
    git: desktopGit,
  },
  backups: createDesktopBackups(storageGate),
  relay: null,
  updates: desktopUpdates,
  oauthCallback: OAUTH_CALLBACK,
  authorize: (config, variables) => Authorize(config, variables),
  cancelAuthorization: () => CancelAuthorization(),
  fetchToken: (exchange) => FetchToken(exchange),
  startDeviceAuthorization: (exchange) => StartDeviceAuthorization(exchange),
  discoverIssuer: (query) => DiscoverIssuer(query),
  reset: () => ResetData(),
  saveFile: (name, base64) => SaveFile(name, base64),
  listInstalledFonts: () => InstalledFonts(),
  windowFrame: desktopWindowFrame,
  webAppUrl: WEB_APP_URL,
  openSocket: openDesktopSocket,
  unsentSocketHeaders: () => [],
}
