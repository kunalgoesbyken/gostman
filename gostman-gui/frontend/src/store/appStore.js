import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { addConsoleGroup } from '../lib/consoleLog'
import { mergeCookies, withoutCookie } from '../lib/cookies'
import { isPlainObject, parseJSON } from '../lib/dataUtils'
import { DATA_TEXT } from '../lib/dataText'
import { TAB_DRAFTS_KEY, isStorageFull } from '../lib/storage'
import { ENVIRONMENT_TEXT } from '../lib/environmentText'
import { DEFAULT_SETTINGS, normalizeSettings } from '../lib/network'
import { ROOT_SETTINGS_ID, isBlankScope, normalizeFolder, normalizeScopeSettings, updatedScope } from '../lib/inheritance'
import { normalizeRequest } from '../lib/request'
import { normalizeFlow } from '../lib/flows/model'
import { isFlowDirty } from '../lib/flows/edit'
import { isBlankRequest, isRequestDirty } from '../lib/requestChanges'
import { rememberResponse } from '../lib/responseHistory'
import { reconcileTabs } from '../lib/tabReconcile'
import { isNarrowViewport, rememberSidebarOpen, rememberedSidebarOpen } from '../lib/layout'
import { reorderTabs, stepTab } from '../lib/tabOrder'
import { SCOPE_COLLECTION, SCOPE_ENVIRONMENT, SCOPE_GLOBAL, SCOPE_SESSION } from '../lib/scripting/scopes'
import { promptLayer, resolveLayers, scopeLayers, scriptLayers, variableText, withSecretMarks } from '../lib/variableScopes'
import { choiceFor, chosenEnvironment, isSameScope, isScoped, variableHolderFor } from '../lib/environmentScope'
import { isWelcomeDismissed, rememberWelcomeDismissed } from '../lib/welcome'
import { rememberSteps, rememberedSteps } from '../lib/onboarding'
import { NO_WORKSPACE, enterWorkspace, leaveWorkspace, persistableSessions, restoreSessions } from './workspaceSessions'

const HISTORY_LIMIT = 50
const HISTORY_IDENTITY_FIELDS = ['method', 'url', 'body', 'bodyType', 'graphqlQuery', 'graphqlVariables', 'grpcMethod', 'grpcMessage', 'mcpMethod', 'mcpTool', 'mcpArguments']
const IMPORT_TAB = 'import'
export const DEFAULT_REQUEST_PANEL = 'params'
const EMPTY_VARIABLES = '{}'
const DEFAULT_ENVIRONMENT_NAME = 'Default'
const TAB_ID_PREFIX = 'tab-'
const SAVE_FAILURE_TITLE = 'Changes could not be saved'

const persistenceFailureMessage = (error) => (isStorageFull(error)
  ? DATA_TEXT.tabsNotStored(error.room)
  : `Your latest changes were not saved and will be lost when the app closes. Export your data to keep a copy. (${error?.message || String(error)})`)

const CLOSED_ALERT = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default' }
const CLOSED_CONFIRM = { isOpen: false, title: '', message: '', confirmText: 'OK', variant: 'default', onConfirm: null, onCancel: null, alternative: null }
const CLOSED_RUNNER = { isOpen: false, folderId: '', isRunning: false, results: [] }
const CLOSED_VARIABLE_PROMPT = { isOpen: false, names: [], defaults: {}, isForRun: false, resolve: null }
const CLOSED_PROMPT = { isOpen: false, title: '', message: '', placeholder: '', defaultValue: '', confirmText: 'OK', onConfirm: null }
const CLOSED_DELETE_DATA = { isOpen: false, onDelete: null }

const MAX_CLOSED_TABS = 10

const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const asArray = (value) => (Array.isArray(value) ? value : [])

const createTab = (id, request, isPreview = false) => ({ id, request: normalizeRequest(request), isPreview, pendingId: null, response: null, responses: [], bodyDrafts: {} })

const createFlowTab = (id, flow) => ({ ...createTab(id), flowId: flow.id, flowDraft: normalizeFlow(flow) })

export const isFlowTab = (tab) => Boolean(tab?.flowId)

const isReusableTab = (tab) => !isFlowTab(tab) && isBlankRequest(tab.request) && tab.pendingId === null

const flowWithId = (flows, id) => flows.find((flow) => flow.id === id)

const refreshFlowTabs = (tabs, before, after) => tabs.map((tab) => {
  const current = isFlowTab(tab) && flowWithId(after, tab.flowId)
  return current && !isFlowDirty(tab.flowDraft, flowWithId(before, tab.flowId)) ? { ...tab, flowDraft: current } : tab
})

const FIRST_TAB = createTab(`${TAB_ID_PREFIX}1`)

const savedLookups = new WeakMap()

const savedLookup = (requests) => {
  if (!savedLookups.has(requests)) savedLookups.set(requests, new Map(requests.map((request) => [request.id, request])))
  return savedLookups.get(requests)
}

const persistableTab = (requests) => {
  const saved = savedLookup(requests)
  return ({ id, request, isPreview, vanished, flowId, flowDraft }) => {
    if (flowId) return { id, flowId, flowDraft, request: {} }
    const baseline = (request.id && saved.get(request.id)) || vanished
    return { id, isPreview, isSaved: Boolean(baseline) && !isRequestDirty(request, baseline), request: { ...request, examples: '' } }
  }
}

const restoreTab = ({ id, request, isPreview, isSaved, flowId, flowDraft }) => {
  if (flowId) return createFlowTab(id, { ...flowDraft, id: flowId })
  const tab = createTab(id, request, isPreview === true)
  return isSaved === true ? { ...tab, vanished: tab.request } : tab
}

const restoreTabs = (tabs) => {
  const restorable = asArray(tabs).filter((tab) => tab?.id && tab.request)
  return restorable.length > 0 ? restorable.map(restoreTab) : [FIRST_TAB]
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

const appendTab = (state, request, isPreview = false) => {
  const tab = createTab(`${TAB_ID_PREFIX}${state.nextTabId}`, request, isPreview)
  return { tabs: [...state.tabs, tab], activeTabId: tab.id, nextTabId: state.nextTabId + 1 }
}

const tabsWithFlow = (state, flow) => {
  const holder = state.tabs.find((tab) => tab.flowId === flow.id)
  if (holder) return { activeTabId: holder.id }
  const active = selectActiveTab(state)
  if (isReusableTab(active)) return mapTab(state, active.id, (tab) => createFlowTab(tab.id, flow))
  const tab = createFlowTab(`${TAB_ID_PREFIX}${state.nextTabId}`, flow)
  return { tabs: [...state.tabs, tab], activeTabId: tab.id, nextTabId: state.nextTabId + 1 }
}

export const createEnvironment = (name, variables = EMPTY_VARIABLES, folderId = '') => ({
  id: createId('env'), name, variables, color: '', extends: '', meta: EMPTY_VARIABLES, folderId,
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

const contextFolderId = (state, request) => (request || selectActiveTab(state)?.request)?.folderId || ''

export const environmentFor = (state, request) => chosenEnvironment(state, contextFolderId(state, request))

export const environmentForFolder = (state, folderId) => chosenEnvironment(state, folderId)

export const findActiveEnvironment = (state) => environmentFor(state)

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

const hasEntries = (value) => isPlainObject(value) && Object.keys(value).length > 0

const mergedValues = (existing, changes) => (
  Object.fromEntries(Object.entries({ ...existing, ...changes }).filter(([, value]) => value !== null))
)

const withoutNames = (values, names) => Object.fromEntries(Object.entries(values).filter(([name]) => !names.includes(name)))

const namesWithValues = (values) => Object.keys(values).filter((name) => values[name] !== null)

const mergedVariablesText = (text, changes) => {
  const current = parseVariables(text || EMPTY_VARIABLES)
  return isPlainObject(current) ? JSON.stringify(mergedValues(current, changes), null, 2) : null
}

function withGlobalWrites(state, changes) {
  const active = state.globalEnvironments.find((environment) => environment.id === state.activeGlobalEnvironmentId)
  const target = active || createEnvironment(ENVIRONMENT_TEXT.scriptGlobals)
  const variables = mergedVariablesText(target.variables, changes)
  if (variables === null) return {}
  const updated = { ...target, variables }
  if (!active) return { globalEnvironments: [...state.globalEnvironments, updated], activeGlobalEnvironmentId: updated.id }
  return { globalEnvironments: state.globalEnvironments.map((environment) => (environment.id === active.id ? updated : environment)) }
}

function withCollectionWrites(state, changes, folderId = '') {
  const holder = variableHolderFor(state.folders, folderId)
  const collectionVariables = mergedVariablesText(holder ? holder.collectionVariables : state.collectionVariables, changes)
  if (collectionVariables === null) return {}
  if (!holder) return { collectionVariables }
  return { folders: state.folders.map((folder) => (folder.id === holder.id ? { ...folder, collectionVariables } : folder)) }
}

const isBlankEnvironment = (environment) => {
  const variables = environment ? parseVariables(environment.variables || EMPTY_VARIABLES) : {}
  return isPlainObject(variables) && Object.keys(variables).length === 0
}

const missingFrom = (current, additions) => (
  Object.fromEntries(Object.entries(additions).filter(([name]) => !Object.hasOwn(current, name)))
)

const mergeVariables = (existing, incoming) => {
  const current = parseVariables(existing)
  if (!isPlainObject(current)) return null
  if (Object.keys(current).length === 0) return incoming
  const additions = parseVariables(incoming)
  return isPlainObject(additions) ? JSON.stringify({ ...current, ...missingFrom(current, additions) }, null, 2) : null
}

const withUnusedId = (environment, environments) => {
  const isUnused = environment.id !== '' && environments.every((existing) => existing.id !== environment.id)
  return isUnused ? environment : { ...environment, id: createId('env') }
}

const movedOutOf = (folderId, parentId) => (request) => (
  request.folderId === folderId ? { ...request, folderId: parentId } : request
)

const withoutRequestId = (id) => (request) => (request.id === id ? { ...request, id: '' } : request)

const isReplaceable = (tab) => tab.pendingId === null && tab.isPreview

const tabsWithOpened = (state, request, preview) => {
  const holder = request.id ? state.tabs.find((tab) => tab.request.id === request.id) : null
  if (holder) return { activeTabId: holder.id, ...(preview || !holder.isPreview ? {} : mapTab(state, holder.id, (tab) => ({ ...tab, isPreview: false }))) }
  const active = selectActiveTab(state)
  if (isReusableTab(active)) return mapTab(state, active.id, (tab) => createTab(tab.id, request, preview))
  const replaceable = preview && state.tabs.find(isReplaceable)
  if (!replaceable) return appendTab(state, request, preview)
  return { ...mapTab(state, replaceable.id, (tab) => createTab(tab.id, request, true)), activeTabId: replaceable.id }
}

const withoutTabs = (state, closing) => {
  const closingIds = new Set(closing.map((tab) => tab.id))
  const remaining = state.tabs.filter((tab) => !closingIds.has(tab.id))
  const remembered = closing.filter((tab) => !isFlowTab(tab) && !isBlankRequest(tab.request)).map((tab) => tab.request)
  const closedTabs = [...remembered.reverse(), ...state.closedTabs].slice(0, MAX_CLOSED_TABS)
  if (remaining.length === 0) return { ...appendTab({ ...state, tabs: remaining }, {}), closedTabs }
  if (!closingIds.has(state.activeTabId)) return { tabs: remaining, closedTabs }
  const survivors = state.tabs.slice(0, state.tabs.findIndex((tab) => tab.id === state.activeTabId)).filter((tab) => !closingIds.has(tab.id))
  const next = survivors[survivors.length - 1] || remaining[0]
  return { tabs: remaining, closedTabs, activeTabId: next.id }
}

const historyStatus = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0)

const historyEntry = (raw) => ({ ...normalizeRequest(raw), statusCode: historyStatus(raw?.statusCode), noResponse: raw?.noResponse === true })

const isSameCall = (first, second) => HISTORY_IDENTITY_FIELDS.every((field) => first[field] === second[field])

let reportStorageFailure = () => {}

const WRITE_DELAY_MS = 400
const pendingWrites = new Map()
let writeTimer = 0

let draftSource = null
let draftsRestored = null
let draftsFailure = null

function flushWrites() {
  clearTimeout(writeTimer)
  for (const [name, value] of pendingWrites) {
    draftSource.write(name, JSON.stringify(value)).catch(reportStorageFailure)
  }
  pendingWrites.clear()
}

window.addEventListener('pagehide', flushWrites)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushWrites()
})

const guardedStorage = {
  getItem: async (name) => parseJSON(await draftSource.read(name) ?? '', null),
  setItem: (name, value) => {
    if (!useAppStore.persist.hasHydrated()) return
    pendingWrites.set(name, value)
    clearTimeout(writeTimer)
    writeTimer = setTimeout(flushWrites, WRITE_DELAY_MS)
  },
  removeItem: (name) => {
    pendingWrites.delete(name)
    draftSource?.remove(name).catch(reportStorageFailure)
  },
}

export const useAppStore = create(
  devtools(
    persist(
      (set, get) => ({
        hydrated: false,
        isRestricted: false,
        requests: [],
        folders: [],
        flows: [],
        requestHistory: [],
        cookies: [],
        settings: DEFAULT_SETTINGS,
        environments: [],
        activeEnvironmentId: '',
        environmentChoices: {},
        globalEnvironments: [],
        activeGlobalEnvironmentId: '',
        collectionVariables: EMPTY_VARIABLES,
        collectionVariablesMeta: '',
        sessionVariables: {},
        collectionSettings: normalizeScopeSettings(),
        folderSettings: null,
        dotEnv: {},
        sharedOrder: false,
        runExclusions: {},
        secretConnections: null,
        environmentDialogOpen: false,
        pendingVariable: '',
        variablePrompt: CLOSED_VARIABLE_PROMPT,
        tabs: [FIRST_TAB],
        activeTabId: FIRST_TAB.id,
        nextTabId: 2,
        workspaceStatus: NO_WORKSPACE,
        workspaceSessions: {},
        workspaceMenuOpen: false,
        welcomeVisible: !isWelcomeDismissed(),
        welcomeDismissed: isWelcomeDismissed(),
        onboardingSteps: rememberedSteps(),
        aboutOpen: false,
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
        isSidebarOpen: rememberedSidebarOpen(),
        closedTabs: [],
        cookiesDialogOpen: false,
        scanDialogOpen: false,
        settingsDialogOpen: false,
        examplesDialogOpen: false,
        mockDialogOpen: false,
        specLinks: {},
        specDialog: null,
        runner: CLOSED_RUNNER,
        consoleGroups: [],
        persistenceFailureReported: false,
        treeClipboard: null,
        notice: null,
        revealTarget: null,
        alertDialog: CLOSED_ALERT,
        confirmDialog: CLOSED_CONFIRM,
        promptDialog: CLOSED_PROMPT,
        deleteDataDialog: CLOSED_DELETE_DATA,

        hydrate: (data) => set((state) => {
          const environments = restoreEnvironments(data)
          const requests = asArray(data.requests).map(normalizeRequest)
          const hasActive = environments.some((environment) => environment.id === data.activeEnvironmentId)
          const folders = asArray(data.folders).map(normalizeFolder)
          const flows = asArray(data.flows).map(normalizeFlow)
          const tabs = withSavedExamples(reconcileTabs(state.tabs, state.requests, requests, folders, state.isRestricted), requests)
          return {
            hydrated: true,
            isRestricted: Boolean(data.restricted),
            requests,
            folders,
            flows,
            tabs: refreshFlowTabs(tabs, state.flows, flows),
            requestHistory: asArray(data.history).map(historyEntry),
            cookies: mergeCookies(asArray(data.cookies), []),
            settings: normalizeSettings(data.settings),
            environments,
            activeEnvironmentId: hasActive ? data.activeEnvironmentId : environments[0].id,
            globalEnvironments: asArray(data.globals).filter(isUsableEnvironment),
            activeGlobalEnvironmentId: data.activeGlobalId || '',
            collectionVariables: data.collectionVariables || EMPTY_VARIABLES,
            collectionVariablesMeta: data.collectionVariablesMeta || '',
            collectionSettings: normalizeScopeSettings(data.collectionSettings),
            dotEnv: isPlainObject(data.dotEnv) ? data.dotEnv : {},
            sharedOrder: data.sharedOrder === true,
          }
        }),

        suspendPersistence: () => set({ hydrated: false }),
        enterWorkspace: (status) => set((state) => enterWorkspace(state, status, () => ({
          tabs: [FIRST_TAB], activeTabId: FIRST_TAB.id, nextTabId: 2, requests: [],
        }))),
        showWelcome: () => set((state) => ({ ...appendTab(state, {}), welcomeVisible: true, commandPaletteOpen: false })),
        hideWelcome: () => {
          rememberWelcomeDismissed()
          set({ welcomeVisible: false, welcomeDismissed: true })
        },
        closeWelcome: () => set({ welcomeVisible: false }),
        completeOnboardingStep: (id) => {
          const steps = get().onboardingSteps
          if (steps.includes(id)) return
          const updated = [...steps, id]
          rememberSteps(updated)
          set({ onboardingSteps: updated })
        },
        openAbout: () => set({ aboutOpen: true, commandPaletteOpen: false }),
        closeAbout: () => set({ aboutOpen: false }),
        adoptWorkspaceStatus: (status) => set({ workspaceStatus: status }),
        leaveWorkspace: (path) => set((state) => leaveWorkspace(state, path)),
        setWorkspaceMenuOpen: (workspaceMenuOpen) => set({ workspaceMenuOpen, commandPaletteOpen: false }),
        liftRestriction: () => set({ isRestricted: false }),
        setSecretConnections: (secretConnections) => set({ secretConnections }),

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
        resolveDiskChange: (tabId, loadsDisk) => set((state) => mapTab(state, tabId, (tab) => (
          loadsDisk && tab.diskChange ? { ...tab, request: tab.diskChange, bodyDrafts: {}, diskChange: null } : { ...tab, diskChange: null }
        ))),

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
        patchFolders: (patches) => set((state) => {
          const byId = new Map(patches.map((patch) => [patch.id, patch]))
          return { folders: state.folders.map((folder) => (byId.has(folder.id) ? { ...folder, ...byId.get(folder.id) } : folder)) }
        }),
        addFolders: (folders) => set((state) => {
          const taken = new Set(state.folders.map((folder) => folder.id))
          const additions = folders.filter((folder) => !taken.has(folder.id)).map(normalizeFolder)
          return { folders: [...state.folders, ...additions] }
        }),
        removeFolders: (folderIds) => set((state) => {
          const removed = new Set(folderIds)
          return { folders: state.folders.filter((folder) => !removed.has(folder.id)) }
        }),
        removeRequests: (ids) => set((state) => {
          const removed = new Set(ids)
          return {
            requests: state.requests.filter((request) => !removed.has(request.id)),
            tabs: mapTabRequests(state.tabs, (request) => (removed.has(request.id) ? { ...request, id: '' } : request)),
          }
        }),
        setFlows: (flows) => set({ flows }),
        openFlowTab: (flow) => set((state) => ({ ...tabsWithFlow(state, flow), isSidebarOpen: state.isSidebarOpen && !isNarrowViewport() })),
        updateFlowDraft: (tabId, flowDraft) => set((state) => mapTab(state, tabId, (tab) => ({ ...tab, flowDraft }))),
        renameFlowTabs: (flowId, name) => set((state) => ({
          tabs: state.tabs.map((tab) => (tab.flowId === flowId ? { ...tab, flowDraft: { ...tab.flowDraft, name } } : tab)),
        })),
        setTreeClipboard: (treeClipboard) => set({ treeClipboard }),
        markSharedOrder: () => set({ sharedOrder: true }),
        showNotice: (message, undo = null) => set({ notice: { id: createId('notice'), message, undo } }),
        dismissNotice: () => set({ notice: null }),
        revealRequest: (requestId) => set((state) => {
          const parents = new Map(state.folders.map((folder) => [folder.id, folder.parentId]))
          const ancestors = new Set()
          for (let id = state.requests.find((request) => request.id === requestId)?.folderId; parents.has(id) && !ancestors.has(id); id = parents.get(id)) ancestors.add(id)
          return {
            isSidebarOpen: true,
            folders: state.folders.map((folder) => (ancestors.has(folder.id) && !folder.isOpen ? { ...folder, isOpen: true } : folder)),
            revealTarget: { requestId, nonce: createId('reveal') },
          }
        }),
        toggleFolder: (folderId) => set((state) => ({
          folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder)),
        })),
        collapseFolders: () => set((state) => (state.folders.some((folder) => folder.isOpen)
          ? { folders: state.folders.map((folder) => (folder.isOpen ? { ...folder, isOpen: false } : folder)) }
          : state)),

        addToHistory: (request, statusCode = 0, noResponse = false) => set((state) => {
          const entry = { ...historyEntry({ ...request, statusCode, noResponse }), examples: '', id: createId('hist'), timestamp: new Date().toISOString() }
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
        openRequestTab: (request, { preview = false } = {}) => set((state) => ({
          ...tabsWithOpened(state, request, preview),
          isSidebarOpen: state.isSidebarOpen && !isNarrowViewport(),
        })),
        pinTab: (tabId) => set((state) => mapTab(state, tabId, (tab) => (tab.isPreview ? { ...tab, isPreview: false } : tab))),
        moveTab: (tabId, targetId, place) => set((state) => ({ tabs: reorderTabs(state.tabs, tabId, targetId, place) })),
        stepTab: (tabId, step) => set((state) => ({ tabs: stepTab(state.tabs, tabId, step) })),
        closeTabs: (tabIds) => set((state) => {
          const closing = state.tabs.filter((tab) => tabIds.includes(tab.id))
          return closing.length === 0 ? state : withoutTabs(state, closing)
        }),
        closeTab: (tabId) => get().closeTabs([tabId]),
        reopenClosedTab: () => set((state) => {
          if (state.closedTabs.length === 0) return state
          const [request, ...closedTabs] = state.closedTabs
          const active = selectActiveTab(state)
          const opened = isReusableTab(active) ? { ...mapTab(state, active.id, (tab) => createTab(tab.id, request)) } : appendTab(state, request)
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
          mapTab(state, tabId, (tab) => ({ ...tab, isPreview: false, request: { ...tab.request, ...updates } }))
        )),
        updateActiveRequest: (updates) => get().updateTabRequest(get().activeTabId, updates),
        setActiveBodyDrafts: (bodyDrafts) => set((state) => (
          mapTab(state, state.activeTabId, (tab) => ({ ...tab, bodyDrafts }))
        )),
        startTabRequest: (tabId, pendingId) => set((state) => (
          mapTab(state, tabId, (tab) => ({ ...tab, pendingId }))
        )),
        finishTabRequest: (tabId, pendingId, response, outcome = {}) => set((state) => (
          mapTab(state, tabId, (tab) => (tab.pendingId === pendingId
            ? { ...tab, ...outcome, pendingId: null, response, responses: rememberResponse(tab.responses, response, Date.now()) }
            : tab))
        )),
        patchTab: (tabId, patch) => set((state) => mapTab(state, tabId, (tab) => ({ ...tab, ...patch }))),
        setRequestPanel: (requestPanel) => set({ requestPanel }),

        setActiveEnvironment: (id) => set((state) => choiceFor(state, contextFolderId(state), id)),
        updateEnvironment: (scope, id, patch) => set((state) => {
          const { list } = ENVIRONMENT_LISTS[scope]
          const updated = state[list].map((environment) => (environment.id === id ? { ...environment, ...patch } : environment))
          const inUse = scope === SCOPE_GLOBAL || !Object.hasOwn(patch, 'folderId') ? undefined : findActiveEnvironment(state)
          return { [list]: updated, ...(inUse && choiceFor({ ...state, environments: updated }, contextFolderId(state), inUse.id)) }
        }),
        addEnvironmentTo: (scope, environment) => set((state) => {
          const { list, active } = ENVIRONMENT_LISTS[scope]
          const environments = [...state[list], environment]
          if (scope === SCOPE_GLOBAL) return { [list]: environments, [active]: environment.id }
          return { [list]: environments, ...choiceFor({ ...state, environments }, contextFolderId(state), environment.id) }
        }),
        removeEnvironmentFrom: (scope, id) => set((state) => {
          const { list, active } = ENVIRONMENT_LISTS[scope]
          const remaining = withoutExtending(state[list].filter((environment) => environment.id !== id), id)
          return { [list]: remaining, [active]: state[active] === id ? remaining[0]?.id || '' : state[active] }
        }),
        setActiveEnvironmentIn: (scope, id) => (scope === SCOPE_GLOBAL ? set({ activeGlobalEnvironmentId: id }) : get().setActiveEnvironment(id)),
        setCollectionVariables: (collectionVariables, collectionVariablesMeta) => set({ collectionVariables, collectionVariablesMeta }),
        mergeCollectionVariables: (additions, meta = '') => {
          if (!isPlainObject(additions) || Object.keys(additions).length === 0) return true
          const current = parseVariables(get().collectionVariables || EMPTY_VARIABLES)
          const added = isPlainObject(current) ? missingFrom(current, additions) : additions
          const merged = withCollectionWrites(get(), added)
          if (!Object.hasOwn(merged, 'collectionVariables')) return false
          set({ ...merged, collectionVariablesMeta: withSecretMarks(get().collectionVariablesMeta, meta, Object.keys(added)) })
          return true
        },
        updateScopeSettings: (folderId, patch) => set((state) => updatedScope(state, folderId, patch)),
        openFolderSettings: (folderId = ROOT_SETTINGS_ID) => set({ folderSettings: { folderId } }),
        closeFolderSettings: () => set({ folderSettings: null }),
        adoptCollectionSettings: (incoming) => set((state) => (isBlankScope(state.collectionSettings) ? { collectionSettings: normalizeScopeSettings(incoming) } : state)),
        openEnvironmentDialog: () => set({ environmentDialogOpen: true, pendingVariable: '' }),
        defineVariable: (name) => set({ environmentDialogOpen: true, pendingVariable: name }),
        closeEnvironmentDialog: () => set({ environmentDialogOpen: false, pendingVariable: '' }),
        askVariables: (names, defaults, isForRun = false) => new Promise((resolve) => set({
          variablePrompt: { isOpen: true, names, defaults, isForRun, resolve },
        })),
        answerVariables: (answers) => {
          get().variablePrompt.resolve?.(answers)
          set({ variablePrompt: CLOSED_VARIABLE_PROMPT })
        },
        setActiveVariables: (variables, request) => set((state) => (
          mapEnvironment(state, environmentFor(state, request)?.id, (environment) => ({ ...environment, variables }))
        )),
        mergeActiveVariables: (additions, request) => {
          if (!isPlainObject(additions) || Object.keys(additions).length === 0) return true
          const existing = parseVariables(environmentFor(get(), request)?.variables ?? EMPTY_VARIABLES)
          if (!isPlainObject(existing)) return false
          const merged = Object.entries({ ...existing, ...additions }).filter(([, value]) => value !== null)
          get().setActiveVariables(JSON.stringify(Object.fromEntries(merged), null, 2), request)
          return true
        },
        storeSessionVariables: (changes, forgotten = []) => set((state) => ({
          sessionVariables: mergedValues(withoutNames(state.sessionVariables, forgotten), changes),
        })),
        clearSessionVariables: () => set({ sessionVariables: {} }),
        applyVariableWrites: (writes, request) => {
          const persistent = [SCOPE_ENVIRONMENT, SCOPE_COLLECTION, SCOPE_GLOBAL].filter((scope) => hasEntries(writes?.[scope]))
          if (persistent.length === 0 && !hasEntries(writes?.[SCOPE_SESSION])) return true
          const saved = !persistent.includes(SCOPE_ENVIRONMENT) || get().mergeActiveVariables(writes[SCOPE_ENVIRONMENT], request)
          if (persistent.includes(SCOPE_COLLECTION)) set((state) => withCollectionWrites(state, writes[SCOPE_COLLECTION], contextFolderId(state, request)))
          if (persistent.includes(SCOPE_GLOBAL)) set((state) => withGlobalWrites(state, writes[SCOPE_GLOBAL]))
          get().storeSessionVariables(writes[SCOPE_SESSION] || {}, persistent.flatMap((scope) => namesWithValues(writes[scope])))
          return saved
        },
        mergeEnvironments: (incoming, scope = 'collection') => {
          const { list, active } = ENVIRONMENT_LISTS[scope]
          const environments = [...get()[list]]
          const skippedNames = []
          const joinedNames = []
          const placed = new Map()
          const added = []
          const { folders } = get()
          for (const candidate of asArray(incoming).filter(isEnvironment)) {
            const { id, name, variables, color, meta, extends: parent } = candidate
            const folderId = scope === SCOPE_GLOBAL || typeof candidate.folderId !== 'string' ? '' : candidate.folderId
            const index = environments.findIndex((environment) => environment.name === name && isSameScope(environment, { folderId }, folders))
            const merged = index === -1 ? variables : mergeVariables(environments[index].variables, variables)
            if (merged === null) skippedNames.push(name)
            else if (index === -1) {
              const environment = withUnusedId({ ...createEnvironment(name, variables, folderId), id, ...environmentExtras({ color, meta }) }, environments)
              environments.push(environment)
              added.push([environment, parent])
              placed.set(id, environment.id)
            } else {
              const existing = environments[index]
              const joinedMeta = mergeVariables(existing.meta || EMPTY_VARIABLES, environmentExtras({ meta }).meta)
              environments[index] = { ...existing, variables: merged, meta: joinedMeta ?? existing.meta }
              placed.set(id, existing.id)
              if (!isBlankEnvironment(existing)) joinedNames.push(name)
            }
          }
          for (const [environment, parent] of added) environment.extends = placed.get(parent) || ''
          const current = environments.find((environment) => environment.id === get()[active])
          const firstShared = added.map(([environment]) => environment).find((environment) => !isScoped(environment, folders))
          const activeId = isBlankEnvironment(current) && firstShared ? firstShared.id : get()[active] || environments[0]?.id || ''
          set({ [list]: environments, [active]: activeId })
          return { skipped: skippedNames, joined: joinedNames }
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
        closeSidebar: () => set({ isSidebarOpen: false }),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),
        openCookiesDialog: () => set({ cookiesDialogOpen: true }),
        closeCookiesDialog: () => set({ cookiesDialogOpen: false }),
        openScanDialog: () => set({ scanDialogOpen: true, commandPaletteOpen: false }),
        closeScanDialog: () => set({ scanDialogOpen: false }),
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
        setRunExclusions: (folderId, ids) => set((state) => ({ runExclusions: { ...state.runExclusions, [folderId]: ids } })),
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
        showConfirm: (title, message, onConfirm, onCancel = null, variant = 'default', confirmText = '', alternative = null) => set({
          confirmDialog: {
            isOpen: true,
            title,
            message,
            confirmText: confirmText || (variant === 'destructive' ? 'Delete' : 'OK'),
            variant,
            onConfirm,
            onCancel,
            alternative,
          },
        }),
        closeConfirm: () => set({ confirmDialog: CLOSED_CONFIRM }),
        showPrompt: (title, message, defaultValue = '', placeholder = '', onConfirm, confirmText = CLOSED_PROMPT.confirmText) => set({
          promptDialog: { ...CLOSED_PROMPT, isOpen: true, title, message, placeholder, defaultValue, onConfirm, confirmText },
        }),
        closePrompt: () => set({ promptDialog: CLOSED_PROMPT }),
        showDeleteData: (onDelete) => set({ deleteDataDialog: { isOpen: true, onDelete }, commandPaletteOpen: false }),
        closeDeleteData: () => set({ deleteDataDialog: CLOSED_DELETE_DATA }),

        reportPersistenceFailure: (error) => {
          if (get().persistenceFailureReported) return
          set({ persistenceFailureReported: true })
          get().showAlert(SAVE_FAILURE_TITLE, persistenceFailureMessage(error), 'OK', 'warning')
        },
      }),
      {
        name: TAB_DRAFTS_KEY,
        storage: guardedStorage,
        skipHydration: true,
        onRehydrateStorage: () => (_, error) => {
          draftsFailure = error || null
        },
        partialize: (state) => ({
          tabs: state.tabs.map(persistableTab(state.requests)),
          isRestricted: state.isRestricted,
          specLinks: state.specLinks,
          environmentChoices: state.environmentChoices,
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
            environmentChoices: isPlainObject(persisted?.environmentChoices) ? persisted.environmentChoices : {},
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

reportStorageFailure = (error) => useAppStore.getState().reportPersistenceFailure(error)

export function restoreTabDrafts(source) {
  draftSource = source
  draftsRestored ||= useAppStore.persist.rehydrate().then(() => {
    if (useAppStore.persist.hasHydrated()) return
    draftsRestored = null
    throw draftsFailure || new Error(DATA_TEXT.tabsUnreadable)
  })
  return draftsRestored
}

useAppStore.subscribe((state, previous) => {
  if (state.isSidebarOpen !== previous.isSidebarOpen) rememberSidebarOpen(state.isSidebarOpen)
})

export const selectActiveTab = (state) => state.tabs.find((tab) => tab.id === state.activeTabId) || state.tabs[0]

const sameInputs = (first, second) => first !== null && first.every((input, index) => Object.is(input, second[index]))

let lastInputs = null
let lastResolved = null

export function selectResolvedVariables(state) {
  const request = selectActiveTab(state)?.request
  const inputs = [
    state.globalEnvironments, state.activeGlobalEnvironmentId, state.collectionVariables, state.collectionVariablesMeta, state.environments,
    state.activeEnvironmentId, state.environmentChoices, state.folders, state.dotEnv, request?.folderId, request?.vars, state.sessionVariables, state.isRestricted,
  ]
  if (sameInputs(lastInputs, inputs)) return lastResolved
  lastInputs = inputs
  lastResolved = resolveLayers(scopeLayers(state, request))
  return lastResolved
}

export const variableTextFor = (state, request, answers = {}, referenced = {}) => (
  variableText(resolveLayers([...scopeLayers(state, request, referenced), promptLayer(answers)]))
)

export const scriptLayersFor = (state, request, referenced = {}) => scriptLayers(scopeLayers(state, request, referenced))

export const selectActiveVariables = (state) => variableText(selectResolvedVariables(state))

export const resolvedVariablesFor = (state, folderId) => resolveLayers(scopeLayers(state, { folderId }))

export const selectIsDialogOpen = (state) => (
  state.codeDialogOpen
  || state.importDialogOpen
  || state.commandPaletteOpen
  || state.workspaceMenuOpen
  || state.aboutOpen
  || state.shortcutsDialogOpen
  || state.preferencesDialogOpen
  || state.cookiesDialogOpen
  || state.scanDialogOpen
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
  || state.deleteDataDialog.isOpen
)

export const useActiveTab = () => useAppStore(selectActiveTab)
