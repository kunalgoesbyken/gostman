import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { addConsoleGroup } from '../lib/consoleLog'
import { mergeCookies, withoutCookie } from '../lib/cookies'
import { isPlainObject, parseJSON } from '../lib/dataUtils'
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/network'
import { ROOT_SETTINGS_ID, isBlankScope, normalizeFolder, normalizeScopeSettings, updatedScope } from '../lib/inheritance'
import { normalizeRequest } from '../lib/request'
import { isBlankRequest } from '../lib/requestChanges'
import { reconcileTabs } from '../lib/tabReconcile'
import { promptLayer, resolveLayers, scopeLayers, variableText } from '../lib/variableScopes'
import { NO_WORKSPACE, enterWorkspace, leaveWorkspace, persistableSessions, restoreSessions } from './workspaceSessions'

const HISTORY_LIMIT = 50
const HISTORY_IDENTITY_FIELDS = ['method', 'url', 'body', 'bodyType', 'graphqlQuery', 'graphqlVariables', 'grpcMethod', 'grpcMessage', 'mcpTool', 'mcpArguments']
const IMPORT_TAB = 'import'
export const DEFAULT_REQUEST_PANEL = 'params'
const EMPTY_VARIABLES = '{}'
const DEFAULT_ENVIRONMENT_NAME = 'Default'
const TAB_ID_PREFIX = 'tab-'
const SAVE_FAILURE_TITLE = 'Changes could not be saved'

const CLOSED_ALERT = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default' }
const CLOSED_CONFIRM = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default', onConfirm: null, onCancel: null }
const CLOSED_RUNNER = { isOpen: false, folderId: '', isRunning: false, results: [] }
const CLOSED_VARIABLE_PROMPT = { isOpen: false, names: [], defaults: {}, resolve: null }
const CLOSED_PROMPT = { isOpen: false, title: '', message: '', placeholder: '', defaultValue: '', confirmText: 'OK', onConfirm: null, onCancel: null }

const MAX_CLOSED_TABS = 10

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

export const createEnvironment = (name, variables = EMPTY_VARIABLES) => ({
  id: createId('env'), name, variables, color: '', extends: '', meta: EMPTY_VARIABLES,
})

const ENVIRONMENT_LISTS = {
  collection: { list: 'environments', active: 'activeEnvironmentId' },
  global: { list: 'globalEnvironments', active: 'activeGlobalEnvironmentId' },
}

const isUsableEnvironment = (environment) => Boolean(environment?.id)

const withoutExtending = (environments, id) => environments.map((environment) => (
  environment.extends === id ? { ...environment, extends: '' } : environment
))

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

const environmentExtras = ({ color, meta }) => ({
  color: typeof color === 'string' ? color : '',
  meta: typeof meta === 'string' ? meta : EMPTY_VARIABLES,
})

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

const movedOutOf = (folderId, parentId) => (request) => (
  request.folderId === folderId ? { ...request, folderId: parentId } : request
)

const withoutRequestId = (id) => (request) => (request.id === id ? { ...request, id: '' } : request)

const isSameCall = (first, second) => HISTORY_IDENTITY_FIELDS.every((field) => first[field] === second[field])

let reportStorageFailure = () => {}

const WRITE_DELAY_MS = 400
const pendingWrites = new Map()
let writeTimer = 0

function flushWrites() {
  clearTimeout(writeTimer)
  for (const [name, value] of pendingWrites) {
    try {
      localStorage.setItem(name, value)
    } catch (error) {
      reportStorageFailure(error.message)
    }
  }
  pendingWrites.clear()
}

window.addEventListener('pagehide', flushWrites)

const guardedStorage = createJSONStorage(() => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    pendingWrites.set(name, value)
    clearTimeout(writeTimer)
    writeTimer = setTimeout(flushWrites, WRITE_DELAY_MS)
  },
  removeItem: (name) => {
    pendingWrites.delete(name)
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
        isRestricted: false,
        requests: [],
        folders: [],
        requestHistory: [],
        cookies: [],
        settings: DEFAULT_SETTINGS,
        environments: [],
        activeEnvironmentId: '',
        globalEnvironments: [],
        activeGlobalEnvironmentId: '',
        collectionVariables: EMPTY_VARIABLES,
        collectionSettings: normalizeScopeSettings(),
        folderSettings: null,
        dotEnv: {},
        environmentDialogOpen: false,
        variablePrompt: CLOSED_VARIABLE_PROMPT,
        tabs: [FIRST_TAB],
        activeTabId: FIRST_TAB.id,
        nextTabId: 2,
        workspaceStatus: NO_WORKSPACE,
        workspaceSessions: {},
        workspaceMenuOpen: false,
        requestPanel: DEFAULT_REQUEST_PANEL,
        codeDialogOpen: false,
        codeSnippets: null,
        importDialogOpen: false,
        importDialogTab: IMPORT_TAB,
        importDialogFolderId: '',
        commandPaletteOpen: false,
        commandPaletteMode: 'commands',
        shortcutsDialogOpen: false,
        preferencesDialogOpen: false,
        isSidebarOpen: true,
        closedTabs: [],
        cookiesDialogOpen: false,
        settingsDialogOpen: false,
        examplesDialogOpen: false,
        mockDialogOpen: false,
        specLinks: {},
        specDialog: null,
        runner: CLOSED_RUNNER,
        consoleGroups: [],
        persistenceFailureReported: false,
        alertDialog: CLOSED_ALERT,
        confirmDialog: CLOSED_CONFIRM,
        promptDialog: CLOSED_PROMPT,

        hydrate: (data) => set((state) => {
          const environments = restoreEnvironments(data)
          const requests = asArray(data.requests).map(normalizeRequest)
          const hasActive = environments.some((environment) => environment.id === data.activeEnvironmentId)
          const folders = asArray(data.folders).map(normalizeFolder)
          return {
            hydrated: true,
            isRestricted: Boolean(data.restricted),
            requests,
            folders,
            tabs: withSavedExamples(reconcileTabs(state.tabs, state.requests, requests, folders, state.isRestricted), requests),
            requestHistory: asArray(data.history).map(normalizeRequest),
            cookies: mergeCookies(asArray(data.cookies), []),
            settings: normalizeSettings(data.settings),
            environments,
            activeEnvironmentId: hasActive ? data.activeEnvironmentId : environments[0].id,
            globalEnvironments: asArray(data.globals).filter(isUsableEnvironment),
            activeGlobalEnvironmentId: data.activeGlobalId || '',
            collectionVariables: data.collectionVariables || EMPTY_VARIABLES,
            collectionSettings: normalizeScopeSettings(data.collectionSettings),
            dotEnv: isPlainObject(data.dotEnv) ? data.dotEnv : {},
          }
        }),

        suspendPersistence: () => set({ hydrated: false }),
        enterWorkspace: (status) => set((state) => enterWorkspace(state, status, () => ({
          tabs: [FIRST_TAB], activeTabId: FIRST_TAB.id, nextTabId: 2, requests: [],
        }))),
        adoptWorkspaceStatus: (status) => set({ workspaceStatus: status }),
        leaveWorkspace: (path) => set((state) => leaveWorkspace(state, path)),
        setWorkspaceMenuOpen: (workspaceMenuOpen) => set({ workspaceMenuOpen, commandPaletteOpen: false }),
        liftRestriction: () => set({ isRestricted: false }),

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
            normalizeFolder({ id: createId('folder'), name, isOpen: true, parentId }),
          ],
        })),
        renameFolder: (folderId, name) => set((state) => ({
          folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, name } : folder)),
        })),
        mergeFolders: (folders) => set((state) => {
          const byId = new Map(state.folders.map((folder) => [folder.id, folder]))
          folders.forEach((folder) => byId.set(folder.id, normalizeFolder(folder)))
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
          const closed = state.tabs.find((tab) => tab.id === tabId)
          const closedTabs = closed && !isBlankRequest(closed.request)
            ? [closed.request, ...state.closedTabs].slice(0, MAX_CLOSED_TABS)
            : state.closedTabs
          const remaining = state.tabs.filter((tab) => tab.id !== tabId)
          if (remaining.length === 0) return { ...appendTab({ ...state, tabs: remaining }), closedTabs }
          if (state.activeTabId !== tabId) return { tabs: remaining, closedTabs }
          const closedIndex = state.tabs.findIndex((tab) => tab.id === tabId)
          return { tabs: remaining, closedTabs, activeTabId: remaining[Math.max(0, closedIndex - 1)].id }
        }),
        reopenClosedTab: () => set((state) => {
          if (state.closedTabs.length === 0) return state
          const [request, ...closedTabs] = state.closedTabs
          const active = selectActiveTab(state)
          const isReusable = isBlankRequest(active.request) && active.pendingId === null
          const opened = isReusable ? { ...mapTab(state, active.id, (tab) => createTab(tab.id, request)) } : appendTab(state, request)
          return { ...opened, closedTabs }
        }),
        cycleTab: (step) => set((state) => {
          const index = state.tabs.findIndex((tab) => tab.id === state.activeTabId)
          const next = state.tabs[(index + step + state.tabs.length) % state.tabs.length]
          return { activeTabId: next.id }
        }),
        activateTabAt: (position) => set((state) => {
          const tab = position === 9 ? state.tabs[state.tabs.length - 1] : state.tabs[position - 1]
          return tab ? { activeTabId: tab.id } : state
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
        updateEnvironment: (scope, id, patch) => set((state) => {
          const { list } = ENVIRONMENT_LISTS[scope]
          return { [list]: state[list].map((environment) => (environment.id === id ? { ...environment, ...patch } : environment)) }
        }),
        addEnvironmentTo: (scope, environment) => set((state) => {
          const { list, active } = ENVIRONMENT_LISTS[scope]
          return { [list]: [...state[list], environment], [active]: environment.id }
        }),
        removeEnvironmentFrom: (scope, id) => set((state) => {
          const { list, active } = ENVIRONMENT_LISTS[scope]
          const remaining = withoutExtending(state[list].filter((environment) => environment.id !== id), id)
          return { [list]: remaining, [active]: state[active] === id ? remaining[0]?.id || '' : state[active] }
        }),
        setActiveEnvironmentIn: (scope, id) => set({ [ENVIRONMENT_LISTS[scope].active]: id }),
        setCollectionVariables: (collectionVariables) => set({ collectionVariables }),
        updateScopeSettings: (folderId, patch) => set((state) => updatedScope(state, folderId, patch)),
        openFolderSettings: (folderId = ROOT_SETTINGS_ID) => set({ folderSettings: { folderId } }),
        closeFolderSettings: () => set({ folderSettings: null }),
        adoptCollectionSettings: (incoming) => set((state) => (isBlankScope(state.collectionSettings) ? { collectionSettings: normalizeScopeSettings(incoming) } : state)),
        openEnvironmentDialog: () => set({ environmentDialogOpen: true }),
        closeEnvironmentDialog: () => set({ environmentDialogOpen: false }),
        askVariables: (names, defaults) => new Promise((resolve) => set({
          variablePrompt: { isOpen: true, names, defaults, resolve },
        })),
        answerVariables: (answers) => {
          get().variablePrompt.resolve?.(answers)
          set({ variablePrompt: CLOSED_VARIABLE_PROMPT })
        },
        setActiveVariables: (variables) => set((state) => (
          mapEnvironment(state, findActiveEnvironment(state)?.id, (environment) => ({ ...environment, variables }))
        )),
        mergeActiveVariables: (additions) => {
          if (!isPlainObject(additions) || Object.keys(additions).length === 0) return true
          const existing = parseVariables(findActiveEnvironment(get())?.variables ?? EMPTY_VARIABLES)
          if (!isPlainObject(existing)) return false
          const merged = Object.entries({ ...existing, ...additions }).filter(([, value]) => value !== null)
          get().setActiveVariables(JSON.stringify(Object.fromEntries(merged), null, 2))
          return true
        },
        mergeEnvironments: (incoming) => {
          const environments = [...get().environments]
          const skippedNames = []
          for (const { id, name, variables, color, meta } of asArray(incoming).filter(isEnvironment)) {
            const index = environments.findIndex((environment) => environment.name === name)
            const merged = index === -1 ? variables : mergeVariables(environments[index].variables, variables)
            if (merged === null) skippedNames.push(name)
            else if (index === -1) environments.push(withUnusedId({ ...createEnvironment(name, variables), id, ...environmentExtras({ color, meta }) }, environments))
            else environments[index] = { ...environments[index], variables: merged }
          }
          set({ environments })
          return skippedNames
        },

        openCodeDialog: (snippets) => set({ codeDialogOpen: true, codeSnippets: snippets }),
        closeCodeDialog: () => set({ codeDialogOpen: false, codeSnippets: null }),
        openImportDialog: (tab = IMPORT_TAB, folderId = '') => set({ importDialogOpen: true, importDialogTab: tab, importDialogFolderId: folderId }),
        closeImportDialog: () => set({ importDialogOpen: false }),
        openCommandPalette: (mode) => set({ commandPaletteOpen: true, commandPaletteMode: mode === 'requests' ? 'requests' : 'commands' }),
        openShortcutsDialog: () => set({ shortcutsDialogOpen: true, commandPaletteOpen: false }),
        closeShortcutsDialog: () => set({ shortcutsDialogOpen: false }),
        openPreferencesDialog: () => set({ preferencesDialogOpen: true, commandPaletteOpen: false }),
        closePreferencesDialog: () => set({ preferencesDialogOpen: false }),
        toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),
        openCookiesDialog: () => set({ cookiesDialogOpen: true }),
        closeCookiesDialog: () => set({ cookiesDialogOpen: false }),
        openSettingsDialog: () => set({ settingsDialogOpen: true }),
        closeSettingsDialog: () => set({ settingsDialogOpen: false }),
        openExamplesDialog: () => set({ examplesDialogOpen: true }),
        closeExamplesDialog: () => set({ examplesDialogOpen: false }),
        openMockDialog: () => set({ mockDialogOpen: true }),
        closeMockDialog: () => set({ mockDialogOpen: false }),
        setSpecLink: (folderId, link) => set((state) => ({ specLinks: { ...state.specLinks, [folderId]: link } })),
        openSpecDialog: (specDialog) => set({ specDialog }),
        closeSpecDialog: () => set({ specDialog: null }),

        openRunner: (folderId = '') => set({ runner: { ...CLOSED_RUNNER, isOpen: true, folderId } }),
        closeRunner: () => set({ runner: CLOSED_RUNNER }),
        startRun: () => set((state) => ({ runner: { ...state.runner, isRunning: true, results: [] } })),
        addRunResult: (result) => set((state) => ({
          runner: { ...state.runner, results: [...state.runner.results, result] },
        })),
        finishRun: () => set((state) => ({ runner: { ...state.runner, isRunning: false } })),
        appendConsole: (group) => set((state) => ({ consoleGroups: addConsoleGroup(state.consoleGroups, group) })),
        clearConsole: () => set({ consoleGroups: [] }),

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
          isRestricted: state.isRestricted,
          specLinks: state.specLinks,
          activeTabId: state.activeTabId,
          nextTabId: state.nextTabId,
          workspaceSessions: persistableSessions(state.workspaceSessions, persistableTab),
        }),
        merge: (persisted, current) => {
          const tabs = restoreTabs(persisted?.tabs)
          const hasActive = tabs.some((tab) => tab.id === persisted?.activeTabId)
          return {
            ...current,
            tabs,
            isRestricted: Boolean(persisted?.isRestricted),
            specLinks: isPlainObject(persisted?.specLinks) ? persisted.specLinks : {},
            workspaceSessions: restoreSessions(persisted?.workspaceSessions, restoreTabs, nextIdAfter),
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

const sameInputs = (first, second) => first !== null && first.every((input, index) => Object.is(input, second[index]))

let lastInputs = null
let lastResolved = null

export function selectResolvedVariables(state) {
  const request = selectActiveTab(state)?.request
  const inputs = [
    state.globalEnvironments, state.activeGlobalEnvironmentId, state.collectionVariables, state.environments,
    state.activeEnvironmentId, state.folders, state.dotEnv, request?.folderId, request?.vars,
  ]
  if (sameInputs(lastInputs, inputs)) return lastResolved
  lastInputs = inputs
  lastResolved = resolveLayers(scopeLayers(state, request))
  return lastResolved
}

export const variableTextFor = (state, request, answers = {}, referenced = {}) => (
  variableText(resolveLayers([...scopeLayers(state, request, referenced), promptLayer(answers)]))
)

export const selectActiveVariables = (state) => variableText(selectResolvedVariables(state))

export const selectIsDialogOpen = (state) => (
  state.codeDialogOpen
  || state.importDialogOpen
  || state.commandPaletteOpen
  || state.workspaceMenuOpen
  || state.shortcutsDialogOpen
  || state.preferencesDialogOpen
  || state.cookiesDialogOpen
  || state.settingsDialogOpen
  || state.examplesDialogOpen
  || state.mockDialogOpen
  || state.environmentDialogOpen
  || state.folderSettings !== null
  || state.variablePrompt.isOpen
  || state.specDialog !== null
  || state.runner.isOpen
  || state.alertDialog.isOpen
  || state.confirmDialog.isOpen
  || state.promptDialog.isOpen
)

export const useActiveTab = () => useAppStore(selectActiveTab)
