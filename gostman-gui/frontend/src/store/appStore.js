import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { isPlainObject, parseJSON } from '../lib/dataUtils'
import { normalizeRequest } from '../lib/request'

const HISTORY_LIMIT = 50
const EMPTY_VARIABLES = '{}'
const DEFAULT_ENVIRONMENT_NAME = 'Default'
const TAB_ID_PREFIX = 'tab-'
const STORAGE_FAILURE_TITLE = 'Storage is full'

const CLOSED_ALERT = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default' }
const CLOSED_CONFIRM = { isOpen: false, title: '', message: '', confirmText: 'Confirm', variant: 'default', onConfirm: null, onCancel: null }
const CLOSED_PROMPT = { isOpen: false, title: '', message: '', placeholder: '', defaultValue: '', confirmText: 'OK', onConfirm: null, onCancel: null }

const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const asArray = (value) => (Array.isArray(value) ? value : [])

const createTab = (id, request) => ({ id, request: normalizeRequest(request), pendingId: null, response: null })

const FIRST_TAB = createTab(`${TAB_ID_PREFIX}1`)

const persistableTab = ({ id, request }) => ({ id, request })

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

const withoutFolder = (folderId) => (request) => (
  request.folderId === folderId ? { ...request, folderId: '' } : request
)

const withoutRequestId = (id) => (request) => (request.id === id ? { ...request, id: '' } : request)

const isSameCall = (first, second) => first.method === second.method && first.url === second.url

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
        requests: [],
        folders: [],
        requestHistory: [],
        environments: [],
        activeEnvironmentId: '',
        tabs: [FIRST_TAB],
        activeTabId: FIRST_TAB.id,
        nextTabId: 2,
        codeDialogOpen: false,
        codeSnippets: null,
        importDialogOpen: false,
        commandPaletteOpen: false,
        persistenceFailureReported: false,
        alertDialog: CLOSED_ALERT,
        confirmDialog: CLOSED_CONFIRM,
        promptDialog: CLOSED_PROMPT,

        hydrate: (data) => set(() => {
          const environments = restoreEnvironments(data)
          const hasActive = environments.some((environment) => environment.id === data.activeEnvironmentId)
          return {
            requests: asArray(data.requests).map(normalizeRequest),
            folders: asArray(data.folders),
            requestHistory: asArray(data.history).map(normalizeRequest),
            environments,
            activeEnvironmentId: hasActive ? data.activeEnvironmentId : environments[0].id,
          }
        }),

        upsertRequest: (request) => set((state) => {
          const saved = normalizeRequest(request)
          const exists = state.requests.some((existing) => existing.id === saved.id)
          return {
            requests: exists
              ? state.requests.map((existing) => (existing.id === saved.id ? saved : existing))
              : [...state.requests, saved],
          }
        }),
        removeRequest: (id) => set((state) => ({
          requests: state.requests.filter((request) => request.id !== id),
          tabs: mapTabRequests(state.tabs, withoutRequestId(id)),
        })),

        addFolder: (name) => set((state) => ({
          folders: [...state.folders, { id: createId('folder'), name, isOpen: true, parentId: '' }],
        })),
        mergeFolders: (folders) => set((state) => {
          const byId = new Map(state.folders.map((folder) => [folder.id, folder]))
          folders.forEach((folder) => byId.set(folder.id, folder))
          return { folders: Array.from(byId.values()) }
        }),
        deleteFolder: (folderId) => set((state) => ({
          folders: state.folders.filter((folder) => folder.id !== folderId),
          requests: state.requests.map(withoutFolder(folderId)),
          tabs: mapTabRequests(state.tabs, withoutFolder(folderId)),
        })),
        toggleFolder: (folderId) => set((state) => ({
          folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder)),
        })),

        addToHistory: (request) => set((state) => {
          const entry = { ...normalizeRequest(request), id: createId('hist'), timestamp: new Date().toISOString() }
          const others = state.requestHistory.filter((existing) => !isSameCall(existing, entry))
          return { requestHistory: [entry, ...others].slice(0, HISTORY_LIMIT) }
        }),
        deleteHistoryItem: (id) => set((state) => ({
          requestHistory: state.requestHistory.filter((entry) => entry.id !== id),
        })),
        clearHistory: () => set({ requestHistory: [] }),

        setActiveTab: (tabId) => set({ activeTabId: tabId }),
        newTab: (folderId = '') => set((state) => {
          const tab = createTab(`${TAB_ID_PREFIX}${state.nextTabId}`, { folderId })
          return { tabs: [...state.tabs, tab], activeTabId: tab.id, nextTabId: state.nextTabId + 1 }
        }),
        closeTab: (tabId) => set((state) => {
          if (state.tabs.length === 1) return state
          const remaining = state.tabs.filter((tab) => tab.id !== tabId)
          if (state.activeTabId !== tabId) return { tabs: remaining }
          const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
          return { tabs: remaining, activeTabId: remaining[Math.max(0, closedIndex - 1)].id }
        }),
        updateTabRequest: (tabId, updates) => set((state) => (
          mapTab(state, tabId, (tab) => ({ ...tab, request: { ...tab.request, ...updates } }))
        )),
        updateActiveRequest: (updates) => get().updateTabRequest(get().activeTabId, updates),
        openInActiveTab: (request) => set((state) => (
          mapTab(state, state.activeTabId, (tab) => createTab(tab.id, request))
        )),
        startTabRequest: (tabId, pendingId) => set((state) => (
          mapTab(state, tabId, (tab) => ({ ...tab, pendingId }))
        )),
        finishTabRequest: (tabId, pendingId, response) => set((state) => (
          mapTab(state, tabId, (tab) => (tab.pendingId === pendingId ? { ...tab, pendingId: null, response } : tab))
        )),

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
          const existing = parseJSON(selectActiveVariables(get()), {})
          if (!isPlainObject(existing)) return false
          get().setActiveVariables(JSON.stringify({ ...existing, ...additions }, null, 2))
          return true
        },

        openCodeDialog: (snippets) => set({ codeDialogOpen: true, codeSnippets: snippets }),
        closeCodeDialog: () => set({ codeDialogOpen: false, codeSnippets: null }),
        openImportDialog: () => set({ importDialogOpen: true }),
        closeImportDialog: () => set({ importDialogOpen: false }),
        openCommandPalette: () => set({ commandPaletteOpen: true }),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),

        showAlert: (title, message, confirmText = 'OK', variant = 'default') => set({
          alertDialog: { isOpen: true, title, message, confirmText, variant },
        }),
        closeAlert: () => set({ alertDialog: CLOSED_ALERT }),
        showConfirm: (title, message, onConfirm, onCancel = null, variant = 'default') => set({
          confirmDialog: {
            isOpen: true,
            title,
            message,
            confirmText: variant === 'destructive' ? 'Delete' : 'Confirm',
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
            STORAGE_FAILURE_TITLE,
            `Your latest changes could not be saved and will be lost when the app closes. Export your data or remove old requests to free space. (${reason})`,
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

export const useActiveTab = () => useAppStore(selectActiveTab)
