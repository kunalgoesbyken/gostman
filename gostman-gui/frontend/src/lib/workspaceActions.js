import { textToBase64 } from './base64'
import { createAiActions } from './ai/session'
import {
  TASK_DOCS, TASK_EXPLAIN, TASK_REQUEST, TASK_SCHEMA, TASK_SCRIPT, TASK_SEARCH, TASK_TESTS,
} from './ai/tasks'
import { createCaptureActions } from './captureSession'
import { createLoadTestActions } from './loadTestSession'
import { generateAllSnippets } from './codeGenerator'
import { activeKindsOf, countActiveRequests, sanitizeImport, withoutActiveRequests } from './importExport'
import { asSentence, pluralize } from './dataUtils'
import { createExampleActions } from './exampleActions'
import { createImporterClient } from './importerClient'
import { createScanClient } from './scanClient'
import { RESTRICTED, applyExtractors, createExecutor } from './execution'
import { introspectionRequest, readSchema } from './graphqlSchema'
import { cancelSignIn, clearToken, discoverIssuer, obtainToken } from './oauth'
import { OAUTH_TEXT } from './oauthText'
import { DIALOG_TEXT } from './dialogText'
import { isGrpcRequest, serializeProtoFiles } from './grpc'
import { collectionSettingsTarget, withInheritance } from './inheritance'
import { askToRun, needsApproval } from './localCommands'
import { isLocalCommand, isMcpRequest } from './mcp'
import { retryStep, signInToMcp } from './mcpAuth'
import { compareTools, rememberTools } from './mcpChecks'
import { createMockActions } from './mockServer'
import { withoutPassphrases } from './network'
import { STEP_CHECK, STEP_RUN, STEP_SAVE, STEP_SEND, STEP_VARIABLE } from './onboarding'
import { getPreferences } from './preferences'
import { AUTH_OAUTH2, normalizeRequest } from './request'
import { promptInstall } from './pwa'
import { SAMPLE_REQUEST } from './welcome'
import { isRequestDirty } from './requestChanges'
import { bodyBase64, downloadName, httpStatusOf, mimeType } from './response'
import { keepingOwnVariables } from './shareContent'
import { clientUrl } from './sharedLink'
import { createRunner } from './runner'
import { buildReportPage } from './runReport'
import { createSocketActions, isSocketAddress } from './socketSessions'
import { TESTS_PANEL } from './requestSections'
import { createSpecActions } from './specActions'
import { createStorageActions } from './storageActions'
import { createBackupActions } from './backupActions'
import { createTabActions } from './tabActions'
import { createTreeActions } from './treeActions'
import { focusAddressSoon } from './panes'
import { ROW_REQUEST } from './collectionTree'
import { describeCounts } from './importCounts'
import { DATA_TEXT } from './dataText'
import { markDataDeleted } from './storage'
import { ACTIVE_IMPORT_TEXT, IMPORT_RESULT_TEXT } from './importText'
import { countImported } from './importSummary'
import { SCOPE_GLOBAL } from './variableScopes'
import { environmentForFolder, findActiveEnvironment, selectActiveTab, selectActiveVariables, useAppStore } from '../store/appStore'
import { scopedFolderNames, scopedImport } from './environmentScope'

const UNRECORDED_ERRORS = ['config', 'script', 'cancelled']
const EXPORT_TAB = 'export'
const SHARE_TAB = 'share'
const DESTRUCTIVE = 'destructive'
const SAVE_FAILURE = 'Could not save the request'
const NO_GRPC_CODE = 'Code generation covers HTTP requests. A gRPC call has no equivalent snippet yet.'
const NO_MCP_CODE = 'Code generation covers HTTP requests. An MCP tool call has no equivalent snippet yet.'

const store = () => useAppStore.getState()
const activeTab = () => selectActiveTab(store())
const tabById = (tabId) => store().tabs.find((candidate) => candidate.id === tabId)
const activeVariables = () => selectActiveVariables(store())
const activeEnvironmentId = () => findActiveEnvironment(store())?.id || ''
const messageOf = (error) => error?.message || String(error)
const failureOf = (error) => asSentence(messageOf(error))
const warn = (title, error) => store().showAlert(title, failureOf(error), 'OK', 'warning')
const quoted = (name) => `"${name}"`
const idsOf = (items) => items.map((item) => item.id)

const attempt = (failureTitle, run) => async (...args) => {
  try {
    return await run(...args)
  } catch (error) {
    warn(failureTitle, error)
  }
}

function promptForName(title, message, currentName, onName, confirmText = DIALOG_TEXT.rename) {
  store().showPrompt(title, message, currentName, '', (name) => {
    const trimmed = name?.trim()
    if (trimmed && trimmed !== currentName) onName(trimmed)
  }, confirmText)
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

  async function runExtractors(tabId) {
    const tab = tabById(tabId)
    const extraction = tab && await applyExtractors(tab.request, tab.response)
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
    const onDevice = (device) => store().patchTab(tab.id, { tokenRequest: { isPending: true, error: '', device } })
    try {
      setToken(tab.id, await obtainToken(backend, auth.oauth2, activeVariables(), options, { environmentId: activeEnvironmentId(), onDevice }))
      store().patchTab(tab.id, { tokenRequest: null })
    } catch (error) {
      store().patchTab(tab.id, { tokenRequest: { isPending: false, error: failureOf(error) } })
    }
  }

  async function discoverEndpoints() {
    const tab = activeTab()
    const { auth, options } = tab.request
    store().patchTab(tab.id, { tokenRequest: { isPending: true, isDiscovering: true, error: '' } })
    try {
      const oauth2 = await discoverIssuer(backend, auth.oauth2, activeVariables(), options)
      setToken(tab.id, oauth2)
      store().patchTab(tab.id, { tokenRequest: { isPending: false, error: '', notice: OAUTH_TEXT.discovered(oauth2.issuer) } })
    } catch (error) {
      store().patchTab(tab.id, { tokenRequest: { isPending: false, error: failureOf(error) } })
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
      store().patchTab(tab.id, { grpcSchema: { error: failureOf(error) } })
    }
  }

  async function mayRunCommand(request) {
    if (!needsApproval(backend, request, activeVariables())) return true
    return askToRun(store().showConfirm, request, activeVariables())
  }

  async function describeMcpServer(tabId) {
    const { request } = tabById(tabId)
    try {
      const catalog = await backend.describeMcp(withInheritance(store(), request), activeVariables())
      const changes = compareTools(catalog)
      if (!changes || changes.firstSeen) rememberTools(catalog)
      return { ...catalog, changes }
    } catch (error) {
      return { error: failureOf(error) }
    }
  }

  async function loadMcpCatalog() {
    const tab = activeTab()
    if (store().isRestricted && isLocalCommand(tab.request)) {
      store().patchTab(tab.id, { mcpCatalog: { error: RESTRICTED } })
      return
    }
    if (!(await mayRunCommand(tab.request))) return
    store().patchTab(tab.id, { mcpCatalog: { loading: true } })
    store().patchTab(tab.id, { mcpCatalog: await describeMcpServer(tab.id) })
  }

  function acceptMcpTools() {
    const tab = activeTab()
    rememberTools(tab.mcpCatalog)
    store().patchTab(tab.id, { mcpCatalog: { ...tab.mcpCatalog, changes: null } })
  }

  async function signInToMcpServer() {
    const tabId = activeTab().id
    const showSteps = (steps, running = true) => {
      if (tabById(tabId)) store().patchTab(tabId, { mcpAuth: { steps, running } })
    }
    if (store().isRestricted) {
      showSteps([{ step: 'probe', outcome: 'failed', detail: RESTRICTED }], false)
      return
    }
    showSteps([])
    try {
      const request = withInheritance(store(), tabById(tabId).request)
      const oauth2 = await signInToMcp(backend, request, activeVariables(), showSteps)
      const steps = tabById(tabId)?.mcpAuth?.steps ?? []
      if (!oauth2 || !tabById(tabId)) {
        showSteps(steps, false)
        return
      }
      store().updateTabRequest(tabId, { auth: { ...tabById(tabId).request.auth, type: AUTH_OAUTH2, oauth2: { ...oauth2, tokenEnvironment: activeEnvironmentId() } } })
      const catalog = await describeMcpServer(tabId)
      store().patchTab(tabId, { mcpCatalog: catalog })
      showSteps([...steps, retryStep(catalog)], false)
    } catch (error) {
      showSteps([...(tabById(tabId)?.mcpAuth?.steps ?? []), { step: 'probe', outcome: 'failed', detail: messageOf(error) }], false)
    }
  }

  const closeMcpSignIn = () => store().patchTab(activeTab().id, { mcpAuth: null })

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
    if (!UNRECORDED_ERRORS.includes(response.error)) store().addToHistory(tab.request, httpStatusOf(response))
  }

  const saveSettings = async (settings) => {
    await backend.network.saveSettings(settings)
    store().setSettings(withoutPassphrases(settings))
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

  const scopedNote = (data) => {
    const names = scopedFolderNames(data)
    return [
      ...(names.environments.length > 0 ? [IMPORT_RESULT_TEXT.scopedEnvironments(names.environments)] : []),
      ...(names.variables.length > 0 ? [IMPORT_RESULT_TEXT.scopedVariables(names.variables)] : []),
    ]
  }

  const addImported = attempt('Import failed', async (imported) => {
    await tree.shareOrder()
    const data = scopedImport(imported, store().workspaceStatus.path)
    const { requests, folders } = data
    if (requests.length > 0) store().upsertRequests(await backend.saveRequests(requests))
    store().mergeFolders(folders)
    store().adoptCollectionSettings(data.settings)
    const environments = store().mergeEnvironments(data.environments)
    const globals = store().mergeEnvironments(data.globals, SCOPE_GLOBAL)
    const skippedEnvironments = environments.skipped
    const skippedGlobals = globals.skipped
    const variablesMerged = store().mergeCollectionVariables(data.variables, data.variablesMeta)
    const warnings = [
      ...(variablesMerged ? [] : ['Collection variables were skipped because the existing collection variables are not valid JSON.']),
      ...[...skippedEnvironments, ...skippedGlobals].map((name) => `Environment ${quoted(name)} was skipped because its variables are not valid JSON.`),
      ...[...environments.joined, ...globals.joined].map(IMPORT_RESULT_TEXT.joinedEnvironment),
      ...data.warnings,
    ]
    const counts = countImported(imported)
    const merged = {
      ...counts,
      environments: counts.environments - skippedEnvironments.length,
      globals: counts.globals - skippedGlobals.length,
      variables: variablesMerged ? counts.variables : 0,
    }
    const summary = `Imported ${describeCounts(merged)}.`
    store().showAlert('Import complete', [summary, ...scopedNote(data), ...data.notes, ...warnings].join('\n'), 'OK', warnings.length > 0 ? 'warning' : 'success')
  })

  const leavingOutActive = (data, kinds) => ({ ...withoutActiveRequests(data), notes: [...data.notes, ACTIVE_IMPORT_TEXT.leftOut(kinds)] })

  const askAboutActive = (data) => new Promise((resolve) => {
    const kinds = activeKindsOf(data)
    const proceed = (chosen) => () => {
      resolve(true)
      return addImported(chosen)
    }
    store().showConfirm(
      ACTIVE_IMPORT_TEXT.title(kinds),
      ACTIVE_IMPORT_TEXT.message(countActiveRequests(data), kinds),
      proceed(data),
      () => resolve(false),
      'outline',
      ACTIVE_IMPORT_TEXT.withThem(kinds),
      { text: ACTIVE_IMPORT_TEXT.withoutThem(kinds), run: proceed(leavingOutActive(data, kinds)) },
    )
  })

  const importData = attempt('Import failed', async (imported) => {
    const existing = { requestIds: idsOf(store().requests), folderIds: idsOf(store().folders) }
    const data = sanitizeImport(imported, existing)
    if (countActiveRequests(data) > 0) return askAboutActive(data)
    await addImported(data)
    return true
  })

  const importShared = (imported) => importData(keepingOwnVariables(imported, store().environments, store().folders))

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
    const { runner: state } = store()
    const environment = environmentForFolder(store(), state.folderId)?.name || ''
    return saveTextFile(RUN_REPORT_FILE, buildReportPage(state.results, run, environment), RUN_REPORT_TYPE)
  }

  const deleteAllData = attempt(DATA_TEXT.failed, async () => {
    store().suspendPersistence()
    await ai.forgetEverything()
    await backend.reset()
    useAppStore.persist.clearStorage()
    markDataDeleted()
    window.location.reload()
  })

  const confirmDeleteAllData = () => store().showDeleteData(deleteAllData)

  const openExport = () => {
    store().closePreferencesDialog()
    store().openImportDialog(EXPORT_TAB)
  }

  function createFolder(parentId = '') {
    const title = parentId ? 'New subfolder' : 'New folder'
    promptForName(title, 'Folder name', '', (name) => store().addFolder(name, parentId), DIALOG_TEXT.create)
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

  const ai = createAiActions(backend, { importData, openapi })
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

  const openHistoryEntry = ({ statusCode, ...entry }) => store().openRequestTab({ ...entry, id: '', timestamp: '' })

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

  const openNewRequest = (folderId) => {
    store().newTab(folderId)
    focusAddressSoon()
  }

  const commands = {
    newRequest: () => openNewRequest(),
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
    collectionSettings: () => store().openFolderSettings(collectionSettingsTarget(store(), activeTab().request.folderId)),
    allCollectionsSettings: () => store().openFolderSettings(),
    cookies: () => store().openCookiesDialog(),
    environments: () => store().openEnvironmentDialog(),
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
    backups: createBackupActions(backend),
    runExtractors,
    getToken,
    forgetToken,
    discoverEndpoints,
    cancelToken: () => cancelSignIn(backend),
    oauthCallback: backend.oauthCallback,
    canConfigureNetwork: Boolean(backend.network),
    saveSettings,
    pickFile: (title) => backend.network.pickFile(title),
    collectionNetwork: () => backend.network.collection(),
    saveCollectionPassphrase: (host, certFile, passphrase) => backend.network.saveCollectionPassphrase(host, certFile, passphrase),
    openRunner: (folderId) => store().openRunner(folderId),
    openFolderSettings: (folderId) => store().openFolderSettings(folderId),
    closeRunner,
    startRun: runner.start,
    stopRun: runner.stop,
    downloadRunReport,
    loadSchema,
    loadGrpcSchema,
    loadMcpCatalog,
    acceptMcpTools,
    signInToMcpServer,
    closeMcpSignIn,
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
    shareRequest: (requestId) => store().openImportDialog(SHARE_TAB, requestId),
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
    newRequest: openNewRequest,
    openRequest: (request) => store().openRequestTab(request),
    previewRequest: (request) => store().openRequestTab(request, { preview: true }),
    openHistoryEntry,
  }
}
