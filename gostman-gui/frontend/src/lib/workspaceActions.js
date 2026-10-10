import { generateAllSnippets } from './codeGenerator'
import { normalizeRequest } from './request'
import { bodyBase64, downloadName, mimeType } from './response'
import { selectActiveTab, selectActiveVariables, useAppStore } from '../store/appStore'

const UNRECORDED_ERRORS = ['config', 'cancelled']
const RESET_PROMPTS = {
  header: 'Clear all data?',
  command: 'Clear all data? This cannot be undone.',
}

const store = () => useAppStore.getState()
const activeTab = () => selectActiveTab(store())
const activeVariables = () => selectActiveVariables(store())
const messageOf = (error) => error?.message || String(error)
const warn = (title, error) => store().showAlert(title, messageOf(error), 'OK', 'warning')

const headersObject = (headers) => Object.fromEntries((headers || []).map(({ key, value }) => [key, value]))

let sendSequence = 0

export function createWorkspaceActions(backend) {
  const cancelTab = (tab) => {
    if (tab?.pendingId) backend.cancel(tab.pendingId)
  }

  async function send() {
    const tab = activeTab()
    if (tab.pendingId) return
    sendSequence += 1
    const pendingId = `${tab.id}-${sendSequence}`
    store().startTabRequest(tab.id, pendingId)
    const response = await backend.send(pendingId, tab.request, activeVariables())
    store().finishTabRequest(tab.id, pendingId, response)
    if (!UNRECORDED_ERRORS.includes(response.error)) store().addToHistory(tab.request)
  }

  async function save() {
    const tab = activeTab()
    try {
      const saved = await backend.saveRequest(normalizeRequest(tab.request))
      store().upsertRequest(saved)
      store().updateTabRequest(tab.id, { id: saved.id })
      store().showAlert('Saved', `"${saved.name}" was saved.`, 'OK', 'success')
    } catch (error) {
      warn('Could not save the request', error)
    }
  }

  async function removeRequest(id) {
    try {
      await backend.deleteRequest(id)
      store().removeRequest(id)
    } catch (error) {
      warn('Could not delete the request', error)
    }
  }

  async function removeFolder(folderId) {
    const contained = store().requests.filter((request) => request.folderId === folderId)
    try {
      for (const request of contained) {
        await backend.saveRequest({ ...request, folderId: '' })
      }
      store().deleteFolder(folderId)
    } catch (error) {
      warn('Could not delete the folder', error)
    }
  }

  async function generateCode() {
    try {
      const prepared = await backend.prepare(activeTab().request, activeVariables())
      const headers = JSON.stringify(headersObject(prepared.headers))
      store().openCodeDialog(generateAllSnippets(prepared.method, prepared.url, headers, prepared.body, '{}'))
    } catch (error) {
      warn('Cannot generate code', error)
    }
  }

  async function pasteCurl(command) {
    const tab = activeTab()
    try {
      const parsed = await backend.parseCurl(command)
      const { id, name, folderId, extractors } = tab.request
      store().updateTabRequest(tab.id, { ...normalizeRequest(parsed), id, name, folderId, extractors })
    } catch (error) {
      warn('Could not read the curl command', error)
    }
  }

  async function importData(data) {
    const requests = data.requests || []
    try {
      for (const request of requests) {
        store().upsertRequest(await backend.saveRequest(normalizeRequest(request)))
      }
      store().mergeFolders(data.folders || [])
      const variablesMerged = store().mergeActiveVariables(data.variables)
      const summary = `Imported ${requests.length} requests.`
      const note = variablesMerged ? '' : ' Variables were skipped because Env Vars is not valid JSON.'
      store().showAlert('Import complete', summary + note, 'OK', variablesMerged ? 'success' : 'warning')
    } catch (error) {
      warn('Import failed', error)
    }
  }

  async function download() {
    const { response } = activeTab()
    try {
      await backend.saveFile(downloadName(response), bodyBase64(response), mimeType(response))
    } catch (error) {
      warn('Could not save the file', error)
    }
  }

  async function resetAll() {
    try {
      await backend.reset()
      useAppStore.persist.clearStorage()
      window.location.reload()
    } catch (error) {
      warn('Reset failed', error)
    }
  }

  const confirmReset = (message) => store().showConfirm('Reset App', message, resetAll, null, 'destructive')

  const commands = {
    newRequest: () => store().newTab(),
    saveRequest: save,
    newFolder: createFolder,
    export: () => store().openImportDialog(),
    import: () => store().openImportDialog(),
    reset: () => confirmReset(RESET_PROMPTS.command),
  }

  function createFolder() {
    store().showPrompt('New Folder', 'Folder name:', '', 'My Folder', (name) => {
      const trimmed = name?.trim()
      if (trimmed) store().addFolder(trimmed)
    })
  }

  return {
    send,
    save,
    generateCode,
    pasteCurl,
    importData,
    download,
    createFolder,
    cancel: () => cancelTab(activeTab()),
    reset: () => confirmReset(RESET_PROMPTS.header),
    runCommand: (action) => commands[action]?.(),
    openRequest: (request) => {
      cancelTab(activeTab())
      store().openInActiveTab(request)
    },
    openHistoryEntry: (entry) => {
      cancelTab(activeTab())
      store().openInActiveTab({ ...entry, id: '', timestamp: '' })
    },
    closeTab: (tabId) => {
      if (store().tabs.length === 1) return
      cancelTab(store().tabs.find((tab) => tab.id === tabId))
      store().closeTab(tabId)
    },
    deleteRequest: (id) => store().showConfirm(
      'Delete Request',
      "Can't be undone.",
      () => removeRequest(id),
      null,
      'destructive',
    ),
    deleteFolder: (folderId) => store().showConfirm(
      'Delete Folder',
      'Move requests to root?',
      () => removeFolder(folderId),
    ),
    clearHistory: () => store().showConfirm('Clear History', 'Delete all history?', () => store().clearHistory()),
  }
}
