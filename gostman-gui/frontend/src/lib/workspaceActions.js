import { textToBase64 } from './base64'
import { extractVariables, isUsableResponse, parseExtractors } from './chaining'
import { generateAllSnippets } from './codeGenerator'
import { pluralize } from './dataUtils'
import { introspectionRequest, readSchema } from './graphqlSchema'
import { normalizeRequest } from './request'
import { isRequestDirty } from './requestChanges'
import { bodyBase64, downloadName, mimeType } from './response'
import { createSocketActions, isSocketAddress } from './socketSessions'
import { selectActiveTab, selectActiveVariables, useAppStore } from '../store/appStore'

const UNRECORDED_ERRORS = ['config', 'cancelled']
const RESET_PROMPTS = {
  header: 'Clear all data?',
  command: 'Clear all data? This cannot be undone.',
}
const EXPORT_TAB = 'export'
const DESTRUCTIVE = 'destructive'

const store = () => useAppStore.getState()
const activeTab = () => selectActiveTab(store())
const activeVariables = () => selectActiveVariables(store())
const messageOf = (error) => error?.message || String(error)
const warn = (title, error) => store().showAlert(title, messageOf(error), 'OK', 'warning')
const quoted = (name) => `"${name}"`

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

let sendSequence = 0

export function createWorkspaceActions(backend) {
  const cancelTab = (tab) => {
    if (tab?.pendingId) backend.cancel(tab.pendingId)
  }

  const sockets = createSocketActions(backend)

  function runExtractors(tabId) {
    const tab = store().tabs.find((candidate) => candidate.id === tabId)
    const extractors = parseExtractors(tab?.request.extractors || '')
    if (extractors.length === 0 || !isUsableResponse(tab.response)) return
    const variables = extractVariables(extractors, tab.response)
    const saved = store().mergeActiveVariables(variables)
    store().patchTab(tabId, { extraction: { saved, names: Object.keys(variables) } })
  }

  async function loadSchema() {
    const tab = activeTab()
    sendSequence += 1
    store().patchTab(tab.id, { schema: { loading: true } })
    const response = await backend.send(`${tab.id}-schema-${sendSequence}`, introspectionRequest(tab.request), activeVariables())
    store().patchTab(tab.id, { schema: readSchema(response) })
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
    const response = await backend.send(pendingId, tab.request, activeVariables())
    store().finishTabRequest(tab.id, pendingId, response)
    runExtractors(tab.id)
    if (!UNRECORDED_ERRORS.includes(response.error)) store().addToHistory(tab.request)
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
    const contained = store().requests.filter((request) => request.folderId === folder.id)
    for (const request of contained) {
      await backend.saveRequest({ ...request, folderId: folder.parentId || '' })
    }
    store().deleteFolder(folder.id)
  })

  const generateCode = attempt('Cannot generate code', async () => {
    const prepared = await backend.prepare(activeTab().request, activeVariables())
    store().openCodeDialog(generateAllSnippets(prepared))
  })

  const pasteCurl = attempt('Could not read the curl command', async (command) => {
    const tab = activeTab()
    const parsed = await backend.parseCurl(command)
    const { id, name, folderId, extractors } = tab.request
    store().updateTabRequest(tab.id, { ...normalizeRequest(parsed), id, name, folderId, extractors })
  })

  async function saveImportedRequests(requests) {
    const saved = []
    try {
      for (const request of requests) {
        saved.push(await backend.saveRequest(normalizeRequest(request)))
      }
    } finally {
      store().upsertRequests(saved)
    }
  }

  const importData = attempt('Import failed', async (data) => {
    const requests = data.requests || []
    const folders = data.folders || []
    await saveImportedRequests(requests)
    store().mergeFolders(folders)
    const skippedEnvironments = store().mergeEnvironments(data.environments)
    const variablesMerged = store().mergeActiveVariables(data.variables)
    const notes = [
      ...(variablesMerged ? [] : ['Variables were skipped because the active environment is not valid JSON.']),
      ...skippedEnvironments.map((name) => `Environment ${quoted(name)} was skipped because its variables are not valid JSON.`),
      ...(data.warnings || []),
    ]
    const summary = `Imported ${pluralize(requests.length, 'request')} and ${pluralize(folders.length, 'folder')}.`
    store().showAlert('Import complete', [summary, ...notes].join('\n'), 'OK', notes.length > 0 ? 'warning' : 'success')
  })

  const download = attempt('Could not save the file', async () => {
    const { response } = activeTab()
    await backend.saveFile(downloadName(response), bodyBase64(response), mimeType(response))
  })

  const saveTextFile = attempt('Could not save the file', (name, text, mime) => (
    backend.saveFile(name, textToBase64(text), mime)
  ))

  const resetAll = attempt('Reset failed', async () => {
    await backend.reset()
    useAppStore.persist.clearStorage()
    window.location.reload()
  })

  const confirmReset = (message) => store().showConfirm('Reset App', message, resetAll, null, DESTRUCTIVE, 'Reset')

  function createFolder(parentId = '') {
    const title = parentId ? 'New Subfolder' : 'New Folder'
    promptForName(title, 'Folder name:', '', (name) => store().addFolder(name, parentId))
  }

  function renameFolder(folder) {
    promptForName('Rename Folder', 'Folder name:', folder.name, (name) => store().renameFolder(folder.id, name))
  }

  function renameRequest(request) {
    const rename = attempt('Could not rename the request', (name) => updateSavedRequest(request, { name }))
    promptForName('Rename Request', 'Request name:', request.name, rename)
  }

  function deleteRequest(request) {
    store().showConfirm(
      'Delete Request',
      `Delete ${quoted(request.name)}? This can't be undone.`,
      () => removeRequest(request.id),
      null,
      DESTRUCTIVE,
    )
  }

  function deleteFolder(folder) {
    store().showConfirm(
      'Delete Folder',
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
      'Clear History',
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
      'Close Tab',
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
    newFolder: () => createFolder(),
    clearHistory,
    switchEnvironment: (environmentId) => store().setActiveEnvironment(environmentId),
    export: () => store().openImportDialog(EXPORT_TAB),
    import: () => store().openImportDialog(),
    reset: () => confirmReset(RESET_PROMPTS.command),
  }

  return {
    send,
    sockets,
    runExtractors,
    loadSchema,
    save,
    generateCode,
    pasteCurl,
    importData,
    download,
    saveTextFile,
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
    reset: () => confirmReset(RESET_PROMPTS.header),
    openImport: () => store().openImportDialog(),
    runCommand: (action, payload) => commands[action]?.(payload),
    newRequest: (folderId) => store().newTab(folderId),
    openRequest: (request) => store().openRequestTab(request),
    openHistoryEntry: (entry) => store().openRequestTab({ ...entry, id: '', timestamp: '' }),
  }
}
