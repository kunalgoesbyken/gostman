import { textToBase64 } from './base64'
import { createCaptureActions } from './captureSession'
import { generateAllSnippets } from './codeGenerator'
import { countActiveRequests, sanitizeImport, withoutActiveRequests } from './importExport'
import { pluralize } from './dataUtils'
import { createExampleActions } from './exampleActions'
import { createImporterClient } from './importerClient'
import { RESTRICTED, applyExtractors, createExecutor } from './execution'
import { introspectionRequest, readSchema } from './graphqlSchema'
import { clearToken, obtainToken } from './oauth'
import { isGrpcRequest, serializeProtoFiles } from './grpc'
import { isMcpRequest } from './mcp'
import { createMockActions } from './mockServer'
import { normalizeRequest } from './request'
import { isRequestDirty } from './requestChanges'
import { bodyBase64, downloadName, mimeType } from './response'
import { keepingOwnVariables } from './shareContent'
import { clientUrl } from './sharedLink'
import { createRunner } from './runner'
import { buildReportPage } from './runReport'
import { createSocketActions, isSocketAddress } from './socketSessions'
import { createSpecActions } from './specActions'
import { createStorageActions } from './storageActions'
import { selectActiveTab, selectActiveVariables, useAppStore } from '../store/appStore'

const UNRECORDED_ERRORS = ['config', 'cancelled']
const RESET_PROMPT = "Delete every request, folder, environment and history entry? This can't be undone."
const EXPORT_TAB = 'export'
const SHARE_TAB = 'share'
const ACTIVE_CONTENT_PROMPT = 'in this file include scripts or OAuth 2.0 settings. These run when a request is sent and can read your variables, so only import them from a source you trust. Cancel imports everything else without them.'
const DESTRUCTIVE = 'destructive'
const NO_GRPC_CODE = 'Code generation covers HTTP requests. A gRPC call has no equivalent snippet yet.'
const NO_MCP_CODE = 'Code generation covers HTTP requests. An MCP tool call has no equivalent snippet yet.'

const store = () => useAppStore.getState()
const activeTab = () => selectActiveTab(store())
const tabById = (tabId) => store().tabs.find((candidate) => candidate.id === tabId)
const activeVariables = () => selectActiveVariables(store())
const messageOf = (error) => error?.message || String(error)
const warn = (title, error) => store().showAlert(title, messageOf(error), 'OK', 'warning')
const quoted = (name) => `"${name}"`
const idsOf = (items) => items.map((item) => item.id)

const attempt = (failureTitle, run) => async (...args) => {
  try {
    await run(...args)
  } catch (error) {
    warn(failureTitle, error)
  }
}

function promptForName(title, message, currentName, onName) {
  store().showPrompt(title, message, currentName, '', (name) => {
    const trimmed = name?.trim()
    if (trimmed && trimmed !== currentName) onName(trimmed)
  })
}

function describeFolderContents(folder) {
  const { requests, folders } = store()
  const requestCount = requests.filter((request) => request.folderId === folder.id).length
  const subfolderCount = folders.filter((candidate) => candidate.parentId === folder.id).length
  if (requestCount + subfolderCount === 0) return 'It is empty.'
  const parent = folders.find((candidate) => candidate.id === folder.parentId)
  const destination = parent ? quoted(parent.name) : 'the top level'
  return `Its ${pluralize(requestCount, 'request')} and ${pluralize(subfolderCount, 'subfolder')} move to ${destination}.`
}

const RUN_REPORT_FILE = 'gostman-report.html'
const RUN_REPORT_TYPE = 'text/html'

let sendSequence = 0

export function createWorkspaceActions(backend) {
  const cancelTab = (tab) => {
    if (tab?.pendingId) backend.cancel(tab.pendingId)
  }

  const sockets = createSocketActions(backend)
  const execute = createExecutor(backend)
  const runner = createRunner(backend, execute)
  const examples = createExampleActions(backend)
  const mock = createMockActions(backend)
  const capture = createCaptureActions(backend)

  function runExtractors(tabId) {
    const tab = tabById(tabId)
    const extraction = tab && applyExtractors(tab.request, tab.response)
    if (extraction) store().patchTab(tabId, { extraction })
  }

  function setToken(tabId, oauth2) {
    const tab = tabById(tabId)
    if (tab) store().updateTabRequest(tabId, { auth: { ...tab.request.auth, oauth2 } })
  }

  async function getToken() {
    const tab = activeTab()
    const { auth, options } = tab.request
    if (store().isRestricted) {
      store().patchTab(tab.id, { tokenRequest: { isPending: false, error: RESTRICTED } })
      return
    }
    store().patchTab(tab.id, { tokenRequest: { isPending: true, error: '' } })
    try {
      setToken(tab.id, await obtainToken(backend, auth.oauth2, activeVariables(), options))
      store().patchTab(tab.id, { tokenRequest: null })
    } catch (error) {
      store().patchTab(tab.id, { tokenRequest: { isPending: false, error: messageOf(error) } })
    }
  }

  function forgetToken() {
    const tab = activeTab()
    setToken(tab.id, clearToken(tab.request.auth.oauth2))
  }

  async function loadSchema() {
    const tab = activeTab()
    sendSequence += 1
    store().patchTab(tab.id, { schema: { loading: true } })
    const response = await backend.send(`${tab.id}-schema-${sendSequence}`, introspectionRequest(tab.request), activeVariables())
    store().patchTab(tab.id, { schema: readSchema(response) })
  }

  async function loadGrpcSchema() {
    const tab = activeTab()
    store().patchTab(tab.id, { grpcSchema: { loading: true } })
    try {
      store().patchTab(tab.id, { grpcSchema: await backend.describeGrpc(tab.request, activeVariables()) })
    } catch (error) {
      store().patchTab(tab.id, { grpcSchema: { error: messageOf(error) } })
    }
  }

  async function loadMcpCatalog() {
    const tab = activeTab()
    store().patchTab(tab.id, { mcpCatalog: { loading: true } })
    try {
      store().patchTab(tab.id, { mcpCatalog: await backend.describeMcp(tab.request, activeVariables()) })
    } catch (error) {
      store().patchTab(tab.id, { mcpCatalog: { error: messageOf(error) } })
    }
  }

  async function setGrpcProtos(files) {
    const tab = activeTab()
    store().updateTabRequest(tab.id, { grpcProtos: serializeProtoFiles(files) })
    if (files.length > 0) {
      await loadGrpcSchema()
      return
    }
    store().patchTab(tab.id, { grpcSchema: null })
  }

  async function send() {
    const tab = activeTab()
    if (isSocketAddress(tab.request.url, activeVariables())) {
      sockets.openFromAddressBar(tab.id)
      return
    }
    if (tab.pendingId) return
    sendSequence += 1
    const pendingId = `${tab.id}-${sendSequence}`
    store().startTabRequest(tab.id, pendingId)
    const { auth, response, tests, extraction } = await execute(tab.request, pendingId)
    store().finishTabRequest(tab.id, pendingId, response, { tests, extraction })
    if (auth.oauth2 !== tab.request.auth.oauth2) setToken(tab.id, auth.oauth2)
    if (!UNRECORDED_ERRORS.includes(response.error)) store().addToHistory(tab.request)
  }

  const saveSettings = async (settings) => {
    await backend.network.saveSettings(settings)
    store().setSettings(settings)
  }

  function closeRunner() {
    runner.stop()
    store().closeRunner()
  }

  const save = attempt('Could not save the request', async () => {
    const tab = activeTab()
    const saved = await backend.saveRequest(normalizeRequest(tab.request))
    store().upsertRequest(saved)
    store().updateTabRequest(tab.id, { id: saved.id })
    store().showAlert('Saved', `${quoted(saved.name)} was saved.`, 'OK', 'success')
  })

  async function updateSavedRequest(request, changes) {
    const saved = await backend.saveRequest(normalizeRequest({ ...request, ...changes }))
    store().upsertRequest(saved)
    store().patchOpenRequest(saved.id, changes)
  }

  const moveRequest = attempt('Could not move the request', (request, folderId) => (
    updateSavedRequest(request, { folderId })
  ))

  const duplicateRequest = attempt('Could not duplicate the request', async (request) => {
    const copy = { ...request, id: '', timestamp: '', name: `${request.name} copy` }
    store().upsertRequest(await backend.saveRequest(normalizeRequest(copy)))
  })

  const removeRequest = attempt('Could not delete the request', async (id) => {
    await backend.deleteRequest(id)
    store().removeRequest(id)
  })

  const removeFolder = attempt('Could not delete the folder', async (folder) => {
    const moved = store().requests
      .filter((request) => request.folderId === folder.id)
      .map((request) => ({ ...request, folderId: folder.parentId || '' }))
    if (moved.length > 0) await backend.saveRequests(moved)
    store().deleteFolder(folder.id)
  })

  const generateCode = attempt('Cannot generate code', async () => {
    if (isGrpcRequest(activeTab().request)) throw new Error(NO_GRPC_CODE)
    if (isMcpRequest(activeTab().request)) throw new Error(NO_MCP_CODE)
    const prepared = await backend.prepare(activeTab().request, activeVariables())
    store().openCodeDialog(generateAllSnippets(prepared))
  })

  const pasteCurl = attempt('Could not read the curl command', async (command) => {
    const tab = activeTab()
    const parsed = await backend.parseCurl(command)
    const { id, name, folderId, extractors, examples: kept } = tab.request
    store().updateTabRequest(tab.id, { ...normalizeRequest(parsed), id, name, folderId, extractors, examples: kept })
  })

  const addImported = attempt('Import failed', async (data) => {
    const { requests, folders } = data
    if (requests.length > 0) store().upsertRequests(await backend.saveRequests(requests))
    store().mergeFolders(folders)
    const skippedEnvironments = store().mergeEnvironments(data.environments)
    const variablesMerged = store().mergeActiveVariables(data.variables)
    const notes = [
      ...(variablesMerged ? [] : ['Variables were skipped because the active environment is not valid JSON.']),
      ...skippedEnvironments.map((name) => `Environment ${quoted(name)} was skipped because its variables are not valid JSON.`),
      ...data.warnings,
    ]
    const summary = `Imported ${pluralize(requests.length, 'request')} and ${pluralize(folders.length, 'folder')}.`
    store().showAlert('Import complete', [summary, ...notes].join('\n'), 'OK', notes.length > 0 ? 'warning' : 'success')
  })

  const importData = attempt('Import failed', (imported) => {
    const existing = { requestIds: idsOf(store().requests), folderIds: idsOf(store().folders) }
    const data = sanitizeImport(imported, existing)
    const activeCount = countActiveRequests(data)
    if (activeCount === 0) return addImported(data)
    return store().showConfirm(
      'Import scripts and sign-in settings?',
      `${pluralize(activeCount, 'request')} ${ACTIVE_CONTENT_PROMPT}`,
      () => addImported(data),
      () => addImported(withoutActiveRequests(data)),
      'default',
      'Import them',
    )
  })

  const importShared = (imported) => importData(keepingOwnVariables(imported, store().environments))

  const openapi = createSpecActions({ backend, attempt, addImported })

  const importer = createImporterClient(backend)

  const download = attempt('Could not save the file', async () => {
    const { response } = activeTab()
    await backend.saveFile(downloadName(response), bodyBase64(response), mimeType(response))
  })

  const saveBase64File = attempt('Could not save the file', (name, base64, mime) => backend.saveFile(name, base64, mime))

  const saveTextFile = attempt('Could not save the file', (name, text, mime) => (
    backend.saveFile(name, textToBase64(text), mime)
  ))

  const downloadRunReport = () => {
    const run = runner.describeRun()
    if (!run) return undefined
    const { environments, activeEnvironmentId, runner: state } = store()
    const environment = (environments.find((candidate) => candidate.id === activeEnvironmentId) || environments[0])?.name || ''
    return saveTextFile(RUN_REPORT_FILE, buildReportPage(state.results, run, environment), RUN_REPORT_TYPE)
  }

  const resetAll = attempt('Reset failed', async () => {
    store().suspendPersistence()
    await backend.reset()
    useAppStore.persist.clearStorage()
    window.location.reload()
  })

  const confirmReset = () => store().showConfirm('Reset app', RESET_PROMPT, resetAll, null, DESTRUCTIVE, 'Reset')

  function createFolder(parentId = '') {
    const title = parentId ? 'New subfolder' : 'New folder'
    promptForName(title, 'Folder name', '', (name) => store().addFolder(name, parentId))
  }

  function renameFolder(folder) {
    promptForName('Rename folder', 'Folder name', folder.name, (name) => store().renameFolder(folder.id, name))
  }

  function renameRequest(request) {
    const rename = attempt('Could not rename the request', (name) => updateSavedRequest(request, { name }))
    promptForName('Rename request', 'Request name', request.name, rename)
  }

  function deleteRequest(request) {
    store().showConfirm(
      'Delete request',
      `Delete ${quoted(request.name)}? This can't be undone.`,
      () => removeRequest(request.id),
      null,
      DESTRUCTIVE,
    )
  }

  function deleteFolder(folder) {
    store().showConfirm(
      'Delete folder',
      `Delete folder ${quoted(folder.name)}? ${describeFolderContents(folder)}`,
      () => removeFolder(folder),
      null,
      DESTRUCTIVE,
    )
  }

  function clearHistory() {
    const entryCount = store().requestHistory.length
    if (entryCount === 0) return
    const subject = entryCount === 1 ? 'the only history entry' : `all ${entryCount} history entries`
    store().showConfirm(
      'Clear history',
      `Delete ${subject}? This can't be undone.`,
      () => store().clearHistory(),
      null,
      DESTRUCTIVE,
      'Clear',
    )
  }

  function closeTab(tabId) {
    const { tabs, requests } = store()
    const tab = tabs.find((candidate) => candidate.id === tabId)
    if (!tab) return
    const close = () => {
      cancelTab(tab)
      store().closeTab(tabId)
    }
    const saved = requests.find((request) => request.id === tab.request.id)
    if (!isRequestDirty(tab.request, saved)) {
      close()
      return
    }
    store().showConfirm(
      'Close tab',
      `${quoted(tab.request.name)} has unsaved changes. Close it and discard them?`,
      close,
      null,
      DESTRUCTIVE,
      'Discard',
    )
  }

  const commands = {
    newRequest: () => store().newTab(),
    saveRequest: save,
    sendRequest: send,
    generateCode,
    duplicateRequest: () => duplicateRequest(activeTab().request),
    closeTab: () => closeTab(store().activeTabId),
    openRequest: (request) => store().openRequestTab(request),
    openHistory: (entry) => store().openRequestTab({ ...entry, id: '', timestamp: '' }),
    reopenTab: () => store().reopenClosedTab(),
    toggleSidebar: () => store().toggleSidebar(),
    shortcuts: () => store().openShortcutsDialog(),
    findRequest: () => store().openCommandPalette('requests'),
    newFolder: () => createFolder(),
    clearHistory,
    switchEnvironment: (environmentId) => store().setActiveEnvironment(environmentId),
    export: () => store().openImportDialog(EXPORT_TAB),
    share: () => store().openImportDialog(SHARE_TAB),
    runCollection: () => store().openRunner(),
    cookies: () => store().openCookiesDialog(),
    examples: examples.open,
    mockServer: mock.open,
    captureTraffic: capture.open,
    settings: () => store().openSettingsDialog(),
    import: () => store().openImportDialog(),
    reset: confirmReset,
  }

  return {
    send,
    sockets,
    examples,
    mock,
    capture,
    storage: createStorageActions(backend),
    runExtractors,
    getToken,
    forgetToken,
    cancelToken: () => backend.cancelAuthorization(),
    oauthCallback: backend.oauthCallback,
    canConfigureNetwork: Boolean(backend.network),
    saveSettings,
    pickFile: (title) => backend.network.pickFile(title),
    openRunner: (folderId) => store().openRunner(folderId),
    closeRunner,
    startRun: runner.start,
    stopRun: runner.stop,
    downloadRunReport,
    loadSchema,
    loadGrpcSchema,
    loadMcpCatalog,
    setGrpcProtos,
    save,
    generateCode,
    pasteCurl,
    importData,
    importShared,
    openapi,
    importer,
    shareFolder: (folderId) => store().openImportDialog(SHARE_TAB, folderId),
    shareLinkBase: clientUrl(backend.webAppUrl),
    download,
    saveTextFile,
    saveBase64File,
    createFolder,
    renameFolder,
    deleteFolder,
    renameRequest,
    duplicateRequest,
    moveRequest,
    deleteRequest,
    clearHistory,
    closeTab,
    cancel: () => cancelTab(activeTab()),
    reset: confirmReset,
    openImport: () => store().openImportDialog(),
    runCommand: (action, payload) => commands[action]?.(payload),
    newRequest: (folderId) => store().newTab(folderId),
    openRequest: (request) => store().openRequestTab(request),
    openHistoryEntry: (entry) => store().openRequestTab({ ...entry, id: '', timestamp: '' }),
  }
}
