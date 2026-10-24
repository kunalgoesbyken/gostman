import { textToBase64 } from './base64'
import { createAiActions } from './ai/session'
import {
  TASK_DOCS, TASK_EXPLAIN, TASK_REQUEST, TASK_SCHEMA, TASK_SCRIPT, TASK_SEARCH, TASK_TESTS,
} from './ai/tasks'
import { createCaptureActions } from './captureSession'
import { createLoadTestActions } from './loadTestSession'
import { generateAllSnippets } from './codeGenerator'
import { countActiveRequests, sanitizeImport, withoutActiveRequests } from './importExport'
import { pluralize } from './dataUtils'
import { createExampleActions } from './exampleActions'
import { createImporterClient } from './importerClient'
import { createScanClient } from './scanClient'
import { RESTRICTED, applyExtractors, createExecutor } from './execution'
import { introspectionRequest, readSchema } from './graphqlSchema'
import { clearToken, obtainToken } from './oauth'
import { isGrpcRequest, serializeProtoFiles } from './grpc'
import { withInheritance } from './inheritance'
import { askToRun, needsApproval } from './localCommands'
import { isLocalCommand, isMcpRequest } from './mcp'
import { createMockActions } from './mockServer'
import { STEP_CHECK, STEP_RUN, STEP_SAVE, STEP_SEND, STEP_VARIABLE } from './onboarding'
import { getPreferences } from './preferences'
import { normalizeRequest } from './request'
import { promptInstall } from './pwa'
import { SAMPLE_REQUEST } from './welcome'
import { isRequestDirty } from './requestChanges'
import { bodyBase64, downloadName, mimeType } from './response'
import { keepingOwnVariables } from './shareContent'
import { clientUrl } from './sharedLink'
import { createRunner } from './runner'
import { buildReportPage } from './runReport'
import { createSocketActions, isSocketAddress } from './socketSessions'
import { createSpecActions } from './specActions'
import { createStorageActions } from './storageActions'
import { createTabActions } from './tabActions'
import { createTreeActions } from './treeActions'
import { ROW_REQUEST } from './collectionTree'
import { describeCounts } from './importCounts'
import { DATA_TEXT } from './dataText'
import { countImported } from './importSummary'
import { selectActiveTab, selectActiveVariables, useAppStore } from '../store/appStore'

const UNRECORDED_ERRORS = ['config', 'cancelled']
const EXPORT_TAB = 'export'
const SHARE_TAB = 'share'
const ACTIVE_CONTENT_PROMPT = 'in this file include scripts, OAuth 2.0 settings, local MCP commands or {{$file(...)}} placeholders that send files from this computer. These run when a request is sent and can read your variables, so only import them from a source you trust. Cancel imports everything else without them.'
const DESTRUCTIVE = 'destructive'
const SAVE_FAILURE = 'Could not save the request'
const NO_GRPC_CODE = 'Code generation covers HTTP requests. A gRPC call has no equivalent snippet yet.'
const NO_MCP_CODE = 'Code generation covers HTTP requests. An MCP tool call has no equivalent snippet yet.'

const store = () => useAppStore.getState()
const activeTab = () => selectActiveTab(store())
const TESTS_PANEL = 'tests'
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
  const loadTest = createLoadTestActions(backend)

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
    const response = await backend.send(`${tab.id}-schema-${sendSequence}`, introspectionRequest(withInheritance(store(), tab.request)), activeVariables())
    store().patchTab(tab.id, { schema: readSchema(response) })
  }

  async function loadGrpcSchema() {
    const tab = activeTab()
    store().patchTab(tab.id, { grpcSchema: { loading: true } })
    try {
      store().patchTab(tab.id, { grpcSchema: await backend.describeGrpc(withInheritance(store(), tab.request), activeVariables()) })
    } catch (error) {
      store().patchTab(tab.id, { grpcSchema: { error: messageOf(error) } })
    }
  }

  async function mayRunCommand(request) {
    if (!needsApproval(backend, request, activeVariables())) return true
    return askToRun(store().showConfirm, request, activeVariables())
  }

  async function loadMcpCatalog() {
    const tab = activeTab()
    if (store().isRestricted && isLocalCommand(tab.request)) {
      store().patchTab(tab.id, { mcpCatalog: { error: RESTRICTED } })
      return
    }
    if (!(await mayRunCommand(tab.request))) return
    store().patchTab(tab.id, { mcpCatalog: { loading: true } })
    try {
      store().patchTab(tab.id, { mcpCatalog: await backend.describeMcp(withInheritance(store(), tab.request), activeVariables()) })
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
    if (!store().isRestricted && !(await mayRunCommand(tab.request))) return
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

  async function saveTab(tabId) {
    const saved = await backend.saveRequest(normalizeRequest(tabById(tabId).request))
    store().upsertRequest(saved)
    store().updateTabRequest(tabId, { id: saved.id })
    store().showNotice(`${quoted(saved.name)} was saved.`)
  }

  const save = attempt(SAVE_FAILURE, () => saveTab(activeTab().id))

  async function updateSavedRequest(request, changes) {
    const saved = await backend.saveRequest(normalizeRequest({ ...request, ...changes }))
    store().upsertRequest(saved)
    store().patchOpenRequest(saved.id, changes)
  }

  const duplicateRequest = attempt('Could not duplicate the request', async (request) => {
    const copy = { ...request, id: '', timestamp: '', sortOrder: 0, name: `${request.name} copy` }
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
    const prepared = await backend.prepare(withInheritance(store(), activeTab().request), activeVariables())
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
    store().adoptCollectionSettings(data.settings)
    const skippedEnvironments = store().mergeEnvironments(data.environments)
    const variablesMerged = store().mergeActiveVariables(data.variables)
    const notes = [
      ...(variablesMerged ? [] : ['Variables were skipped because the active environment is not valid JSON.']),
      ...skippedEnvironments.map((name) => `Environment ${quoted(name)} was skipped because its variables are not valid JSON.`),
      ...data.warnings,
    ]
    const counts = countImported(data)
    const merged = { ...counts, environments: counts.environments - skippedEnvironments.length, variables: variablesMerged ? counts.variables : 0 }
    const summary = `Imported ${describeCounts(merged)}.`
    store().showAlert('Import complete', [summary, ...notes].join('\n'), 'OK', notes.length > 0 ? 'warning' : 'success')
  })

  const importData = attempt('Import failed', (imported) => {
    const existing = { requestIds: idsOf(store().requests), folderIds: idsOf(store().folders) }
    const data = sanitizeImport(imported, existing)
    const activeCount = countActiveRequests(data)
    if (activeCount === 0) return addImported(data)
    return store().showConfirm(
      'Import scripts and sign-in settings?',
      `${pluralize(activeCount, 'item')} ${ACTIVE_CONTENT_PROMPT}`,
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

  const deleteAllData = attempt(DATA_TEXT.failed, async () => {
    store().suspendPersistence()
    await ai.forgetEverything()
    await backend.reset()
    useAppStore.persist.clearStorage()
    window.location.reload()
  })

  const confirmDeleteAllData = () => store().showDeleteData(deleteAllData)

  const openExport = () => {
    store().closePreferencesDialog()
    store().openImportDialog(EXPORT_TAB)
  }

  function createFolder(parentId = '') {
    const title = parentId ? 'New subfolder' : 'New folder'
    promptForName(title, 'Folder name', '', (name) => store().addFolder(name, parentId))
  }

  function renameFolder(folder) {
    promptForName('Rename folder', 'Folder name', folder.name, (name) => store().renameFolder(folder.id, name))
  }

  const setRequestTags = attempt('Could not save the tags', (request, tags) => updateSavedRequest(request, { tags }))

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
    if (!getPreferences().confirmCloseTab || !isRequestDirty(tab.request, saved)) {
      close()
      return
    }
    const saveAndClose = attempt(SAVE_FAILURE, async () => {
      await saveTab(tabId)
      close()
    })
    store().showConfirm(
      'Close tab',
      `${quoted(tab.request.name)} has unsaved changes. Save them before closing?`,
      close,
      null,
      DESTRUCTIVE,
      "Don't save",
      { text: 'Save', run: saveAndClose },
    )
  }

  const ai = createAiActions(backend, { importData })
  ai.load()
  const storageActions = createStorageActions(backend)
  const tree = createTreeActions(backend, attempt)
  const tabActions = createTabActions(backend, attempt, cancelTab)

  const activeSavedSource = () => {
    const { id } = activeTab().request
    return id && store().requests.some((request) => request.id === id) ? { kind: ROW_REQUEST, id } : null
  }

  const sendSample = () => {
    store().openRequestTab(normalizeRequest(SAMPLE_REQUEST))
    return send()
  }

  const openHistoryEntry = (entry) => store().openRequestTab({ ...entry, id: '', timestamp: '' })

  function saveLatestRequest() {
    const [latest] = store().requestHistory
    if (!activeTab().request.url && latest) openHistoryEntry(latest)
    return save()
  }

  function openTests() {
    const { requests } = store()
    const isSaved = requests.some((request) => request.id === activeTab().request.id)
    if (!isSaved && requests.length > 0) store().openRequestTab(requests[requests.length - 1])
    store().setRequestPanel(TESTS_PANEL)
  }

  const onboardingSteps = {
    [STEP_SEND]: sendSample,
    [STEP_SAVE]: saveLatestRequest,
    [STEP_VARIABLE]: () => store().openEnvironmentDialog(),
    [STEP_CHECK]: openTests,
    [STEP_RUN]: () => store().openRunner(),
  }

  const commands = {
    newRequest: () => store().newTab(),
    saveRequest: save,
    sendRequest: send,
    generateCode,
    duplicateRequest: () => duplicateRequest(activeTab().request),
    closeTab: () => closeTab(store().activeTabId),
    openRequest: (request) => store().openRequestTab(request),
    closeOtherTabs: () => tabActions.closeOthers(store().activeTabId),
    closeSavedTabs: tabActions.closeSaved,
    keepTab: tabActions.pinActive,
    copyRequest: () => {
      const source = activeSavedSource()
      if (source) tree.copyItem(source)
    },
    pasteRequest: () => tree.pasteItem(activeSavedSource()),
    openHistory: openHistoryEntry,
    reopenTab: () => store().reopenClosedTab(),
    toggleSidebar: () => store().toggleSidebar(),
    shortcuts: () => store().openShortcutsDialog(),
    findRequest: () => store().openCommandPalette('requests'),
    newFolder: () => createFolder(),
    collapseFolders: () => store().collapseFolders(),
    clearHistory,
    showWelcome: () => store().showWelcome(),
    about: () => store().openAbout(),
    installApp: promptInstall,
    switchEnvironment: (environmentId) => store().setActiveEnvironment(environmentId),
    workspaceSwitcher: () => storageActions?.openSwitcher(),
    openFolder: () => storageActions?.openFolder(),
    switchWorkspace: (path) => storageActions?.reopen(path),
    export: openExport,
    share: () => store().openImportDialog(SHARE_TAB),
    runCollection: () => store().openRunner(),
    cookies: () => store().openCookiesDialog(),
    scanSecrets: () => store().openScanDialog(),
    examples: examples.open,
    mockServer: mock.open,
    captureTraffic: capture.open,
    loadTest: loadTest.open,
    settings: () => store().openSettingsDialog(),
    preferences: () => store().openPreferencesDialog(),
    import: () => store().openImportDialog(),
    lintSpec: openapi.lintLatest,
    reset: confirmDeleteAllData,
    aiRequest: () => ai.start(TASK_REQUEST),
    aiTests: () => ai.start(TASK_TESTS),
    aiScript: () => ai.start(TASK_SCRIPT),
    aiExplain: () => ai.start(TASK_EXPLAIN),
    aiDocs: () => ai.start(TASK_DOCS),
    aiSearch: () => ai.start(TASK_SEARCH),
    aiSchema: () => ai.start(TASK_SCHEMA),
    aiSettings: ai.openSettings,
  }

  return {
    ai,
    send,
    sockets,
    examples,
    mock,
    capture,
    loadTest,
    secrets: backend.secrets,
    storage: storageActions,
    runExtractors,
    getToken,
    forgetToken,
    cancelToken: () => backend.cancelAuthorization(),
    oauthCallback: backend.oauthCallback,
    canConfigureNetwork: Boolean(backend.network),
    saveSettings,
    pickFile: (title) => backend.network.pickFile(title),
    openRunner: (folderId) => store().openRunner(folderId),
    openFolderSettings: (folderId) => store().openFolderSettings(folderId),
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
    scan: createScanClient(backend),
    goToRequest: (requestId) => {
      const request = store().requests.find((candidate) => candidate.id === requestId)
      if (request) store().openRequestTab(request)
    },
    shareFolder: (folderId) => store().openImportDialog(SHARE_TAB, folderId),
    shareLinkBase: clientUrl(backend.webAppUrl),
    download,
    saveTextFile,
    saveBase64File,
    createFolder,
    renameFolder,
    deleteFolder,
    renameRequest,
    setRequestTags,
    duplicateRequest,
    moveRequest: (request, folderId) => tree.moveToFolder({ kind: ROW_REQUEST, id: request.id }, folderId),
    deleteRequest,
    clearHistory,
    closeTab,
    tree,
    tabs: tabActions,
    cancel: () => cancelTab(activeTab()),
    openImport: () => store().openImportDialog(),
    beginOnboardingStep: (id) => onboardingSteps[id](),
    runCommand: (action, payload) => commands[action]?.(payload),
    newRequest: (folderId) => store().newTab(folderId),
    openRequest: (request) => store().openRequestTab(request),
    previewRequest: (request) => store().openRequestTab(request, { preview: true }),
    openHistoryEntry,
  }
}
