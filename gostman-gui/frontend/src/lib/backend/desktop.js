import {
  Authorize,
  CancelAuthorization,
  CancelRequest,
  DeleteRequest,
  FetchToken,
  LoadData,
  ParseCurl,
  PickFile,
  PrepareRequest,
  ResetData,
  SaveCookies,
  SaveEnvironments,
  SaveFile,
  SaveFolders,
  SaveHistory,
  SaveRequests,
  SaveSettings,
  SendRequest,
} from '../../../wailsjs/go/main/App'
import { openDesktopSocket } from './desktopSocket'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'

async function saveRequest(request) {
  const [saved] = await SaveRequests([request])
  return saved
}

const OAUTH_CALLBACK = { url: 'http://localhost:9876/callback', isFixed: false }

async function send(id, request, variables, cookies) {
  try {
    return await SendRequest(id, toEngineRequest(request, variables, cookies))
  } catch (error) {
    return failureResponse('network', error?.message || String(error))
  }
}

export const desktopBackend = {
  send,
  cancel: (id) => CancelRequest(id),
  prepare: (request, variables) => PrepareRequest(toEngineRequest(request, variables)),
  parseCurl: (command) => ParseCurl(command),
  load: () => LoadData(),
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
  oauthCallback: OAUTH_CALLBACK,
  authorize: (config, variables) => Authorize(config, variables),
  cancelAuthorization: () => CancelAuthorization(),
  fetchToken: (exchange) => FetchToken(exchange),
  reset: () => ResetData(),
  saveFile: (name, base64) => SaveFile(name, base64),
  openSocket: openDesktopSocket,
  unsentSocketHeaders: () => [],
}
