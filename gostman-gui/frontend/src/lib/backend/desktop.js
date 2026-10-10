import {
  CancelRequest,
  DeleteRequest,
  LoadData,
  ParseCurl,
  PrepareRequest,
  ResetData,
  SaveEnvironments,
  SaveFile,
  SaveFolders,
  SaveHistory,
  SaveRequest,
  SendRequest,
} from '../../../wailsjs/go/main/App'
import { toEngineRequest } from '../request'
import { failureResponse } from '../response'

async function send(id, request, variables) {
  try {
    return await SendRequest(id, toEngineRequest(request, variables))
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
  saveRequest: (request) => SaveRequest(request),
  deleteRequest: (id) => DeleteRequest(id),
  saveFolders: (folders) => SaveFolders(folders),
  saveHistory: (history) => SaveHistory(history),
  saveEnvironments: (environments, activeId) => SaveEnvironments(environments, activeId),
  reset: () => ResetData(),
  saveFile: (name, base64) => SaveFile(name, base64),
}
