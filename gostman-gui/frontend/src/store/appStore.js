import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { mergeCookies, withoutCookie } from '../lib/cookies'
import { isPlainObject, parseJSON } from '../lib/dataUtils'
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/network'
import { normalizeRequest } from '../lib/request'
import { isBlankRequest } from '../lib/requestChanges'
import { reconcileTabs } from '../lib/tabReconcile'

const HISTORY_LIMIT = 50
const HISTORY_IDENTITY_FIELDS = ['method', 'url', 'body', 'bodyType', 'graphqlQuery', 'graphqlVariables', 'grpcMethod', 'grpcMessage']
const IMPORT_TAB = 'import'
const DEFAULT_REQUEST_PANEL = 'params'
const EMPTY_VARIABLES = '{}'
const DEFAULT_ENVIRONMENT_NAME = 'Default'
const TAB_ID_PREFIX = 'tab-'
const SAVE_FAILURE_TITLE = 'Changes could not be saved'

const CLOSED_ALERT = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default' }
const CLOSED_CONFIRM = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default', onConfirm: null, onCancel: null }
const CLOSED_RUNNER = { isOpen: false, folderId: '', isRunning: false, results: [] }
const CLOSED_PROMPT = { isOpen: false, title: '', message: '', placeholder: '', defaultValue: '', confirmText: 'OK', onConfirm: null, onCancel: null }

const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const asArray = (value) => (Array.isArray(value) ? value : [])

const createTab = (id, request) => ({ id, request: normalizeRequest(request), pendingId: null, response: null, bodyDrafts: {} })

const FIRST_TAB = createTab(`${TAB_ID_PREFIX}1`)

const persistableTab = ({ id, request }) => ({ id, request: { ...request, examples: '' } })

const restoreTabs = (tabs) => {
  const restorable = asArray(tabs).filter((tab) => tab?.id && tab.request)
  return restorable.length > 0 ? restorable.map((tab) => createTab(tab.id, tab.request)) : [FIRST_TAB]
}

const nextIdAfter = (tabs) => 1 + tabs.reduce((highest, tab) => {
  const number = Number(String(tab.id).replace(TAB_ID_PREFIX, ''))
  return Number.isInteger(number) && number > highest ? number : highest
}, 0)

const mapTab = (state, tabId, update) => ({
  tabs: state.tabs.map((tab) => (tab.id === tabId ? update(tab) : tab)),
})

const mapTabRequests = (tabs, update) => tabs.map((tab) => ({ ...tab, request: update(tab.request) }))

const withSavedExamples = (tabs, requests) => {
  const examplesOf = new Map(requests.map((request) => [request.id, request.examples]))
  return mapTabRequests(tabs, (request) => (
    request.id && examplesOf.has(request.id) ? { ...request, examples: examplesOf.get(request.id) } : request
  ))
}

const appendTab = (state, request) => {
  const tab = createTab(`${TAB_ID_PREFIX}${state.nextTabId}`, request)
  return { tabs: [...state.tabs, tab], activeTabId: tab.id, nextTabId: state.nextTabId + 1 }
}

const createEnvironment = (name, variables = EMPTY_VARIABLES) => ({ id: createId('env'), name, variables })

const restoreEnvironments = (data) => {
  const environments = asArray(data.environments).filter((environment) => environment?.id)
  return environments.length > 0
    ? environments
    : [createEnvironment(DEFAULT_ENVIRONMENT_NAME, data.variables || EMPTY_VARIABLES)]
}

const findActiveEnvironment = (state) => (
  state.environments.find((environment) => environment.id === state.activeEnvironmentId) || state.environments[0]
)

const mapEnvironment = (state, id, update) => ({
  environments: state.environments.map((environment) => (environment.id === id ? update(environment) : environment)),
})

const isEnvironment = (value) => (
  isPlainObject(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.variables === 'string'
)

const parseVariables = (text) => (text.trim() === '' ? {} : parseJSON(text, null))

const mergeVariables = (existing, incoming) => {
  const current = parseVariables(existing)
  if (!isPlainObject(current)) return null
  if (Object.keys(current).length === 0) return incoming
  const additions = parseVariables(incoming)
  return isPlainObject(additions) ? JSON.stringify({ ...current, ...additions }, null, 2) : null
}

const withUnusedId = (environment, environments) => {
  const isUnused = environment.id !== '' && environments.every((existing) => existing.id !== environment.id)
  return isUnused ? environment : { ...environment, id: createId('env') }
}

const toFolder = ({ id, name, isOpen, parentId }) => ({ id, name, isOpen: Boolean(isOpen), parentId: parentId || '' })

const movedOutOf = (folderId, parentId) => (request) => (
  request.folderId === folderId ? { ...request, folderId: parentId } : request
)

const withoutRequestId = (id) => (request) => (request.id === id ? { ...request, id: '' } : request)

const isSameCall = (first, second) => HISTORY_IDENTITY_FIELDS.every((field) => first[field] === second[field])

let reportStorageFailure = () => {}

const guardedStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (error) {
      reportStorageFailure(error.message)
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch (error) {
      reportStorageFailure(error.message)
    }
  },
}))

export const useAppStore = create(
  devtools(
    persist(
      (set, get) => ({
        hydrated: false,
        requests: [],
        folders: [],
        requestHistory: [],
        cookies: [],
        settings: DEFAULT_SETTINGS,
        environments: [],
        activeEnvironmentId: '',
        tabs: [FIRST_TAB],
        activeTabId: FIRST_TAB.id,
        nextTabId: 2,
        requestPanel: DEFAULT_REQUEST_PANEL,
        codeDialogOpen: false,
        codeSnippets: null,
        importDialogOpen: false,
        importDialogTab: IMPORT_TAB,
        commandPaletteOpen: false,
        cookiesDialogOpen: false,
        settingsDialogOpen: false,
        examplesDialogOpen: false,
        mockDialogOpen: false,
        runner: CLOSED_RUNNER,
        persistenceFailureReported: false,
        alertDialog: CLOSED_ALERT,
        confirmDialog: CLOSED_CONFIRM,
        promptDialog: CLOSED_PROMPT,

        hydrate: (data) => set((state) => {
          const environments = restoreEnvironments(data)
          const requests = asArray(data.requests).map(normalizeRequest)
          const hasActive = environments.some((environment) => environment.id === data.activeEnvironmentId)
          const folders = asArray(data.folders)
          return {
            hydrated: true,
            requests,
            folders,
            tabs: withSavedExamples(reconcileTabs(state.tabs, state.requests, requests, folders), requests),
            requestHistory: asArray(data.history).map(normalizeRequest),
            cookies: mergeCookies(asArray(data.cookies), []),
            settings: normalizeSettings(data.settings),
            environments,
            activeEnvironmentId: hasActive ? data.activeEnvironmentId : environments[0].id,
          }
        }),

        suspendPersistence: () => set({ hydrated: false }),

        upsertRequests: (requests) => set((state) => {
          const byId = new Map(state.requests.map((request) => [request.id, request]))
          requests.forEach((request) => byId.set(request.id, normalizeRequest(request)))
          return { requests: Array.from(byId.values()) }
        }),
        upsertRequest: (request) => get().upsertRequests([request]),
        removeRequest: (id) => set((state) => ({
          requests: state.requests.filter((request) => request.id !== id),
          tabs: mapTabRequests(state.tabs, withoutRequestId(id)),
        })),
        patchOpenRequest: (id, changes) => set((state) => ({
          tabs: mapTabRequests(state.tabs, (request) => (request.id === id ? { ...request, ...changes } : request)),
        })),

        addFolder: (name, parentId = '') => set((state) => ({
          folders: [
            ...state.folders.map((folder) => (folder.id === parentId ? { ...folder, isOpen: true } : folder)),
            { id: createId('folder'), name, isOpen: true, parentId },
          ],
        })),
        renameFolder: (folderId, name) => set((state) => ({
          folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, name } : folder)),
        })),
        mergeFolders: (folders) => set((state) => {
          const byId = new Map(state.folders.map((folder) => [folder.id, folder]))
          folders.forEach((folder) => byId.set(folder.id, toFolder(folder)))
          return { folders: Array.from(byId.values()) }
        }),
        deleteFolder: (folderId) => set((state) => {
          const parentId = state.folders.find((folder) => folder.id === folderId)?.parentId || ''
          const moveToParent = movedOutOf(folderId, parentId)
          return {
            folders: state.folders
              .filter((folder) => folder.id !== folderId)
              .map((folder) => (folder.parentId === folderId ? { ...folder, parentId } : folder)),
            requests: state.requests.map(moveToParent),
            tabs: mapTabRequests(state.tabs, moveToParent),
          }
        }),
        toggleFolder: (folderId) => set((state) => ({
          folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder)),
        })),

        addToHistory: (request) => set((state) => {
          const entry = { ...normalizeRequest(request), examples: '', id: createId('hist'), timestamp: new Date().toISOString() }
          const others = state.requestHistory.filter((existing) => !isSameCall(existing, entry))
          return { requestHistory: [entry, ...others].slice(0, HISTORY_LIMIT) }
        }),
        deleteHistoryItem: (id) => set((state) => ({
          requestHistory: state.requestHistory.filter((entry) => entry.id !== id),
        })),
        clearHistory: () => set({ requestHistory: [] }),

        storeCookies: (received) => set((state) => (
          received.length > 0 ? { cookies: mergeCookies(state.cookies, received) } : state
        )),
        removeCookie: (cookie) => set((state) => ({ cookies: withoutCookie(state.cookies, cookie) })),
        clearCookies: () => set({ cookies: [] }),
        setSettings: (settings) => set({ settings }),

        setActiveTab: (tabId) => set({ activeTabId: tabId }),
        newTab: (folderId = '') => set((state) => appendTab(state, { folderId })),
        openRequestTab: (request) => set((state) => {
          const holder = request.id ? state.tabs.find((tab) => tab.request.id === request.id) : null
          if (holder) return { activeTabId: holder.id }
          const active = selectActiveTab(state)
          const isReusable = isBlankRequest(active.request) && active.pendingId === null
          return isReusable ? mapTab(state, active.id, (tab) => createTab(tab.id, request)) : appendTab(state, request)
        }),
        closeTab: (tabId) => set((state) => {
          const remaining = state.tabs.filter((tab) => tab.id !== tabId)
          if (remaining.length === 0) return appendTab({ ...state, tabs: remaining })
          if (state.activeTabId !== tabId) return { tabs: remaining }
          const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
          return { tabs: remaining, activeTabId: remaining[Math.max(0, closedIndex - 1)].id }
        }),
        updateTabRequest: (tabId, updates) => set((state) => (
          mapTab(state, tabId, (tab) => ({ ...tab, request: { ...tab.request, ...updates } }))
        )),
        updateActiveRequest: (updates) => get().updateTabRequest(get().activeTabId, updates),
        setActiveBodyDrafts: (bodyDrafts) => set((state) => (
          mapTab(state, state.activeTabId, (tab) => ({ ...tab, bodyDrafts }))
        )),
        startTabRequest: (tabId, pendingId) => set((state) => (
          mapTab(state, tabId, (tab) => ({ ...tab, pendingId }))
        )),
        finishTabRequest: (tabId, pendingId, response, outcome = {}) => set((state) => (
          mapTab(state, tabId, (tab) => (tab.pendingId === pendingId ? { ...tab, ...outcome, pendingId: null, response } : tab))
        )),
        patchTab: (tabId, patch) => set((state) => mapTab(state, tabId, (tab) => ({ ...tab, ...patch }))),
        setRequestPanel: (requestPanel) => set({ requestPanel }),

        setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),
        addEnvironment: (name) => set((state) => {
          const environment = createEnvironment(name)
          return { environments: [...state.environments, environment], activeEnvironmentId: environment.id }
        }),
        renameEnvironment: (id, name) => set((state) => (
          mapEnvironment(state, id, (environment) => ({ ...environment, name }))
        )),
        deleteEnvironment: (id) => set((state) => {
          if (state.environments.length === 1) return state
          const environments = state.environments.filter((environment) => environment.id !== id)
          const activeEnvironmentId = state.activeEnvironmentId === id ? environments[0].id : state.activeEnvironmentId
          return { environments, activeEnvironmentId }
        }),
        setActiveVariables: (variables) => set((state) => (
          mapEnvironment(state, findActiveEnvironment(state)?.id, (environment) => ({ ...environment, variables }))
        )),
        mergeActiveVariables: (additions) => {
          if (!isPlainObject(additions) || Object.keys(additions).length === 0) return true
          const existing = parseVariables(selectActiveVariables(get()))
          if (!isPlainObject(existing)) return false
          get().setActiveVariables(JSON.stringify({ ...existing, ...additions }, null, 2))
          return true
        },
        mergeEnvironments: (incoming) => {
          const environments = [...get().environments]
          const skippedNames = []
          for (const { id, name, variables } of asArray(incoming).filter(isEnvironment)) {
            const index = environments.findIndex((environment) => environment.name === name)
            const merged = index === -1 ? variables : mergeVariables(environments[index].variables, variables)
            if (merged === null) skippedNames.push(name)
            else if (index === -1) environments.push(withUnusedId({ id, name, variables }, environments))
            else environments[index] = { ...environments[index], variables: merged }
          }
          set({ environments })
          return skippedNames
        },

        openCodeDialog: (snippets) => set({ codeDialogOpen: true, codeSnippets: snippets }),
        closeCodeDialog: () => set({ codeDialogOpen: false, codeSnippets: null }),
        openImportDialog: (tab = IMPORT_TAB) => set({ importDialogOpen: true, importDialogTab: tab }),
        closeImportDialog: () => set({ importDialogOpen: false }),
        openCommandPalette: () => set({ commandPaletteOpen: true }),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),
        openCookiesDialog: () => set({ cookiesDialogOpen: true }),
        closeCookiesDialog: () => set({ cookiesDialogOpen: false }),
        openSettingsDialog: () => set({ settingsDialogOpen: true }),
        closeSettingsDialog: () => set({ settingsDialogOpen: false }),
        openExamplesDialog: () => set({ examplesDialogOpen: true }),
        closeExamplesDialog: () => set({ examplesDialogOpen: false }),
        openMockDialog: () => set({ mockDialogOpen: true }),
        closeMockDialog: () => set({ mockDialogOpen: false }),

        openRunner: (folderId = '') => set({ runner: { ...CLOSED_RUNNER, isOpen: true, folderId } }),
        closeRunner: () => set({ runner: CLOSED_RUNNER }),
        startRun: () => set((state) => ({ runner: { ...state.runner, isRunning: true, results: [] } })),
        addRunResult: (result) => set((state) => ({
          runner: { ...state.runner, results: [...state.runner.results, result] },
        })),
        finishRun: () => set((state) => ({ runner: { ...state.runner, isRunning: false } })),

        showAlert: (title, message, confirmText = 'OK', variant = 'default') => set({
          alertDialog: { isOpen: true, title, message, confirmText, variant },
        }),
        closeAlert: () => set({ alertDialog: CLOSED_ALERT }),
        showConfirm: (title, message, onConfirm, onCancel = null, variant = 'default', confirmText = '') => set({
          confirmDialog: {
            isOpen: true,
            title,
            message,
            confirmText: confirmText || (variant === 'destructive' ? 'Delete' : 'OK'),
            variant,
            onConfirm,
            onCancel,
          },
        }),
        closeConfirm: () => set({ confirmDialog: CLOSED_CONFIRM }),
        showPrompt: (title, message, defaultValue = '', placeholder = '', onConfirm, onCancel = null) => set({
          promptDialog: { ...CLOSED_PROMPT, isOpen: true, title, message, placeholder, defaultValue, onConfirm, onCancel },
        }),
        closePrompt: () => set({ promptDialog: CLOSED_PROMPT }),

        reportPersistenceFailure: (reason) => {
          if (get().persistenceFailureReported) return
          set({ persistenceFailureReported: true })
          get().showAlert(
            SAVE_FAILURE_TITLE,
            `Your latest changes were not saved and will be lost when the app closes. Export your data to keep a copy. (${reason})`,
            'OK',
            'warning',
          )
        },
      }),
      {
        name: 'gostman-storage',
        storage: guardedStorage,
        partialize: (state) => ({
          tabs: state.tabs.map(persistableTab),
          activeTabId: state.activeTabId,
          nextTabId: state.nextTabId,
        }),
        merge: (persisted, current) => {
          const tabs = restoreTabs(persisted?.tabs)
          const hasActive = tabs.some((tab) => tab.id === persisted?.activeTabId)
          return {
            ...current,
            tabs,
            activeTabId: hasActive ? persisted.activeTabId : tabs[0].id,
            nextTabId: Math.max(persisted?.nextTabId || 0, nextIdAfter(tabs)),
          }
        },
      }
    ),
    { name: 'gostman-store', enabled: import.meta.env.DEV }
  )
)

reportStorageFailure = (reason) => useAppStore.getState().reportPersistenceFailure(reason)

export const selectActiveTab = (state) => state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0]

export const selectActiveVariables = (state) => findActiveEnvironment(state)?.variables ?? EMPTY_VARIABLES

export const selectIsDialogOpen = (state) => (
  state.codeDialogOpen
  || state.importDialogOpen
  || state.commandPaletteOpen
  || state.cookiesDialogOpen
  || state.settingsDialogOpen
  || state.examplesDialogOpen
  || state.mockDialogOpen
  || state.runner.isOpen
  || state.alertDialog.isOpen
  || state.confirmDialog.isOpen
  || state.promptDialog.isOpen
)

export const useActiveTab = () => useAppStore(selectActiveTab)
