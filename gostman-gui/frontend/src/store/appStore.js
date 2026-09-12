import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { parseRequest } from '../lib/dataUtils'

const DEFAULT_REQUEST = {
  id: '', name: 'New Request', method: 'GET', url: '',
  headers: '{}', body: '', queryParams: '{}',
  graphqlQuery: '', graphqlVariables: '{}', response: ''
}

const createTab = (id, request = DEFAULT_REQUEST) => ({
  id,
  request: { ...request },
  status: '',
  loading: false,
  responseTime: null,
  responseHeaders: null,
  responseCookies: null,
  responseSize: null
})

const FIRST_TAB = createTab('tab-1')

// Tabs are persisted so unsent drafts survive a reload, but response payloads
// are not: a handful of large bodies would exhaust the ~5MB localStorage quota
// and cost every later write.
const persistableTab = (tab) => ({
  ...createTab(tab.id, tab.request),
  request: { ...tab.request, response: '' }
})

const restoreTabs = (tabs) => (
  Array.isArray(tabs) && tabs.length > 0 && tabs.every(t => t?.id && t.request)
    ? tabs.map(persistableTab)
    : [FIRST_TAB]
)

// zustand writes on every set() and does not guard the call, so an exhausted
// quota (or a browser with storage disabled) would otherwise throw out of a
// store action mid-render. Losing persistence beats losing the session.
const resilientStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch (e) {
      console.warn('Could not read persisted state:', e)
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch (e) {
      console.warn('Could not persist state:', e)
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch (e) {
      console.warn('Could not clear persisted state:', e)
    }
  }
}))

// Keeps generated ids unique even if the stored counter is stale or missing.
const nextIdAfter = (tabs) => 1 + tabs.reduce((max, t) => {
  const n = Number(String(t.id).replace('tab-', ''))
  return Number.isInteger(n) && n > max ? n : max
}, 0)

export const useAppStore = create(
  devtools(
    persist(
      (set) => ({
        // State
        requests: [],
        folders: [],
        variables: '{}',
        requestHistory: [],
        tabs: [FIRST_TAB],
        activeTabId: FIRST_TAB.id,
        nextTabId: 2,
        activeRequestTab: 'body', // Active tab in RequestTabs ('body', 'graphql', 'websocket', etc.)
        codeDialogOpen: false,
        codeSnippets: null,
        importDialogOpen: false,
        commandPaletteOpen: false,

        // Dialog states (not persisted)
        alertDialog: { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default', onConfirm: null },
        confirmDialog: { isOpen: false, title: '', message: '', confirmText: 'Confirm', variant: 'default', onConfirm: null, onCancel: null },
        promptDialog: { isOpen: false, title: '', message: '', placeholder: '', defaultValue: '', confirmText: 'OK', onConfirm: null, onCancel: null },

        // Requests
        setRequests: (requests) => set({ requests: Array.isArray(requests) ? requests : [] }),
        addRequest: (request) => set((state) => ({ requests: [...state.requests, request] })),
        updateRequest: (id, updates) => set((state) => ({
          requests: state.requests.map(r => r.id === id ? { ...r, ...updates } : r)
        })),
        deleteRequest: (id) => set((state) => ({ requests: state.requests.filter(r => r.id !== id) })),

        // Folders
        // Accepts either an array or an updater fn (prev) => next, like React setState.
        setFolders: (foldersOrUpdater) => set((state) => {
          const next = typeof foldersOrUpdater === 'function'
            ? foldersOrUpdater(state.folders)
            : foldersOrUpdater
          return { folders: Array.isArray(next) ? next : [] }
        }),
        addFolder: (name) => {
          const id = `folder-${Date.now()}`
          set((state) => ({ folders: [...state.folders, { id, name, isOpen: true }] }))
          return id
        },
        deleteFolder: (folderId) => set((state) => ({ folders: state.folders.filter(f => f.id !== folderId) })),
        toggleFolder: (folderId) => set((state) => ({
          folders: state.folders.map(f => f.id === folderId ? { ...f, isOpen: !f.isOpen } : f)
        })),

        // History
        addToHistory: (request) => set((state) => {
          const item = { ...request, id: `hist-${Date.now()}`, timestamp: new Date().toISOString() }
          const filtered = state.requestHistory.filter(h => !(h.method === request.method && h.url === request.url))
          return { requestHistory: [item, ...filtered].slice(0, 50) }
        }),
        deleteHistoryItem: (id) => set((state) => ({ requestHistory: state.requestHistory.filter(h => h.id !== id) })),
        clearHistory: () => set({ requestHistory: [] }),
        setRequestHistory: (history) => set({ requestHistory: Array.isArray(history) ? history : [] }),

        // Tabs
        setActiveTab: (tabId) => set({ activeTabId: tabId }),
        // Doubles as a click handler, so anything that is not a folder id
        // (a DOM event, say) is treated as "no folder".
        newTab: (folderId = null) => set((state) => {
          const folder = typeof folderId === 'string' ? folderId : null
          const tab = createTab(`tab-${state.nextTabId}`, { ...DEFAULT_REQUEST, folderId: folder })
          return { tabs: [...state.tabs, tab], activeTabId: tab.id, nextTabId: state.nextTabId + 1 }
        }),
        closeTab: (tabId) => set((state) => {
          if (state.tabs.length === 1) return state
          const newTabs = state.tabs.filter(t => t.id !== tabId)
          let newActiveTabId = state.activeTabId
          if (state.activeTabId === tabId) {
            const idx = state.tabs.findIndex(t => t.id === tabId)
            newActiveTabId = newTabs[Math.max(0, idx - 1)]?.id || newTabs[0]?.id
          }
          return { tabs: newTabs, activeTabId: newActiveTabId }
        }),
        updateActiveTab: (updates) => set((state) => ({
          tabs: state.tabs.map(t => t.id === state.activeTabId ? { ...t, ...updates } : t)
        })),
        updateActiveRequest: (updates) => set((state) => ({
          tabs: state.tabs.map(t => t.id === state.activeTabId ? { ...t, request: { ...t.request, ...updates } } : t)
        })),
        loadRequestIntoTab: (request) => set((state) => ({
          tabs: state.tabs.map(t => t.id === state.activeTabId ? { ...t, request: parseRequest(request), status: '', responseTime: null, responseHeaders: null, responseCookies: null, responseSize: null } : t)
        })),
        loadHistoryIntoTab: (item) => set((state) => ({
          tabs: state.tabs.map(t => t.id === state.activeTabId ? { ...t, request: { ...parseRequest(item), response: '' }, status: '', responseTime: null, responseHeaders: null, responseCookies: null, responseSize: null } : t)
        })),

        // Variables
        setVariables: (variables) => set({ variables }),

        // UI State
        openCodeDialog: (snippets) => set({ codeDialogOpen: true, codeSnippets: snippets }),
        closeCodeDialog: () => set({ codeDialogOpen: false, codeSnippets: null }),
        openImportDialog: () => set({ importDialogOpen: true }),
        closeImportDialog: () => set({ importDialogOpen: false }),

        // Dialog actions (non-blocking alternatives to alert/confirm/prompt)
        showAlert: (title, message, confirmText = 'OK', variant = 'default') => set({
          alertDialog: { isOpen: true, title, message, confirmText, variant }
        }),
        closeAlert: () => set({ alertDialog: { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default' } }),

        showConfirm: (title, message, onConfirm, onCancel = null, variant = 'default') => set({
          confirmDialog: {
            isOpen: true,
            title,
            message,
            confirmText: variant === 'destructive' ? 'Delete' : 'Confirm',
            variant,
            onConfirm,
            onCancel
          }
        }),
        closeConfirm: () => set({ confirmDialog: { isOpen: false } }),

        showPrompt: (title, message, defaultValue = '', placeholder = '', onConfirm, onCancel = null) => set({
          promptDialog: { isOpen: true, title, message, placeholder, defaultValue, onConfirm, onCancel }
        }),
        closePrompt: () => set({ promptDialog: { isOpen: false } }),

        // Command palette
        openCommandPalette: () => set({ commandPaletteOpen: true }),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),

        setActiveRequestTab: (tab) => set({ activeRequestTab: tab }),
      }),
      {
        name: 'gostman-storage',
        storage: resilientStorage,
        partialize: (state) => ({
          requests: state.requests,
          folders: state.folders,
          variables: state.variables,
          requestHistory: state.requestHistory,
          tabs: state.tabs.map(persistableTab),
          activeTabId: state.activeTabId,
          nextTabId: state.nextTabId,
        }),
        merge: (persistedState, currentState) => {
          // Guards against corrupted or partial localStorage content.
          const tabs = restoreTabs(persistedState?.tabs)
          return {
            ...currentState,
            ...persistedState,
            requests: Array.isArray(persistedState?.requests) ? persistedState.requests : [],
            folders: Array.isArray(persistedState?.folders) ? persistedState.folders : [],
            requestHistory: Array.isArray(persistedState?.requestHistory) ? persistedState.requestHistory : [],
            tabs,
            activeTabId: tabs.some(t => t.id === persistedState?.activeTabId)
              ? persistedState.activeTabId
              : tabs[0].id,
            nextTabId: Math.max(persistedState?.nextTabId || 0, nextIdAfter(tabs)),
          }
        },
      }
    ),
    { name: 'gostman-store', enabled: import.meta.env.DEV }
  )
)

export const useActiveTab = () => useAppStore((s) => {
  if (!s.tabs || s.tabs.length === 0) return FIRST_TAB
  return s.tabs.find(t => t.id === s.activeTabId) || s.tabs[0]
})
export const useActiveRequest = () => useAppStore((s) => {
  const activeTab = s.tabs && s.tabs.length > 0
    ? (s.tabs.find(t => t.id === s.activeTabId) || s.tabs[0])
    : null
  return activeTab?.request || { ...DEFAULT_REQUEST }
})
