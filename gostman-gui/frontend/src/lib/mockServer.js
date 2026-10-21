import { create } from 'zustand'
import { ROOT_ID, buildCollectionTree, collectRequests } from './collectionTree'
import { selectActiveVariables, useAppStore } from '../store/appStore'

export const ROUTE_SERVED = 'served'
export const ROUTE_NO_EXAMPLE = 'no-example'
export const ROUTE_CONFLICT = 'conflict'
export const ROUTE_DISABLED = 'disabled'

export const TAB_ROUTES = 'routes'
export const TAB_RULES = 'rules'
export const TAB_BEHAVIOR = 'behavior'
export const TAB_LOG = 'log'

export const FAULT_STATUS = 'status'
export const FAULT_RESET = 'reset'
export const FAULT_EMPTY = 'empty'

export const FIELD_QUERY = 'query'
export const FIELD_HEADER = 'header'
export const FIELD_BODY = 'body'

export const OP_EQUALS = 'equals'
export const OP_CONTAINS = 'contains'
export const OP_EXISTS = 'exists'

const DEFAULT_PORT = 4010
const HIGHEST_PORT = 65535
const HIGHEST_DELAY_MS = 60_000
const HIGHEST_PERCENT = 100
const HIGHEST_STATUS = 599
const LOG_LIMIT = 500
const REFRESH_DELAY_MS = 250
const SAVE_DELAY_MS = 400
const HEADER_SEPARATOR = ':'
const STOPPED = { running: false, address: '', log: [] }

export const emptyBehavior = () => ({
  delayMs: 0,
  delayMaxMs: 0,
  slowBodyMs: 0,
  fault: { percent: 0, kind: FAULT_STATUS, status: 0 },
})

export const emptyRule = () => ({
  id: crypto.randomUUID(),
  name: '',
  disabled: false,
  method: '',
  path: '',
  conditions: [],
  nth: 0,
  exampleId: '',
  status: 0,
  headers: [],
  body: '',
  behavior: emptyBehavior(),
})

export const emptyCondition = () => ({ field: FIELD_QUERY, name: '', op: OP_EQUALS, value: '' })

const normalizeBehavior = (raw) => ({
  ...emptyBehavior(),
  ...raw,
  fault: { ...emptyBehavior().fault, ...raw?.fault },
})

const normalizeRule = (raw) => ({
  ...emptyRule(),
  ...raw,
  conditions: raw.conditions || [],
  headers: raw.headers || [],
  behavior: normalizeBehavior(raw.behavior),
})

export const normalizeConfig = (raw) => ({
  settings: {
    port: raw?.settings?.port || DEFAULT_PORT,
    cors: Boolean(raw?.settings?.cors),
    behavior: normalizeBehavior(raw?.settings?.behavior),
  },
  spec: { title: raw?.spec?.title || '', sources: raw?.spec?.sources || [] },
  rules: (raw?.rules || []).map(normalizeRule),
  routes: raw?.routes || {},
  selections: raw?.selections || {},
})

const INITIAL_STATE = {
  isRunning: false,
  isStarting: false,
  isLoadingSpec: false,
  address: '',
  routes: [],
  log: [],
  failure: '',
  folderId: ROOT_ID,
  tab: TAB_ROUTES,
  config: normalizeConfig(null),
}

export const useMockStore = create(() => INITIAL_STATE)

const mock = () => useMockStore.getState()
const patch = (changes) => useMockStore.setState(changes)
const app = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)

const wholeNumber = (text, highest) => Math.min(highest, Math.max(0, Math.trunc(Number(text)) || 0))

export const toPort = (text) => wholeNumber(text, HIGHEST_PORT)

export const toDelayMs = (text) => wholeNumber(text, HIGHEST_DELAY_MS)

export const toPercent = (text) => wholeNumber(text, HIGHEST_PERCENT)

export const toStatus = (text) => wholeNumber(text, HIGHEST_STATUS)

export const toCount = (text) => wholeNumber(text, Number.MAX_SAFE_INTEGER)

export const headersToText = (headers) => headers.map(({ key, value }) => `${key}${HEADER_SEPARATOR} ${value}`).join('\n')

export const textToHeaders = (text) => text.split('\n').flatMap((line) => {
  const at = line.indexOf(HEADER_SEPARATOR)
  const key = at < 0 ? '' : line.slice(0, at).trim()
  return key ? [{ key, value: line.slice(at + HEADER_SEPARATOR.length).trim() }] : []
})

function requestsInScope() {
  const { folders, requests } = app()
  return collectRequests(buildCollectionTree(folders, requests), mock().folderId)
}

const toSource = ({ id, name, method, url, examples }) => ({ id, name, method, url, examples })

const sourcesInScope = () => requestsInScope().map(toSource)

const affectsRoutes = (state, previous) => (
  state.requests !== previous.requests
  || state.folders !== previous.folders
  || selectActiveVariables(state) !== selectActiveVariables(previous)
)

const WEB_PROTOCOLS = ['http:', 'https:']

function isWebAddress(text) {
  try {
    return WEB_PROTOCOLS.includes(new URL(text).protocol)
  } catch {
    return false
  }
}

export function specSourceOf(text) {
  const address = text.trim()
  return isWebAddress(address) ? { url: address } : { path: address }
}

const replaceAt = (items, id, change) => items.map((item) => (item.id === id ? { ...item, ...change } : item))

export function createMockActions(backend) {
  const server = backend.mock
  let revision = 0
  let refreshTimer = null
  let saveTimer = null
  let stopWatching = null
  let stopListening = null

  function record(entry) {
    patch({ log: [entry, ...mock().log].slice(0, LOG_LIMIT) })
  }

  function listen() {
    if (!stopListening) stopListening = server.onRequest(record)
  }

  function unlisten() {
    stopListening?.()
    stopListening = null
  }

  function adopt({ running, address, log }) {
    if (running) listen()
    else unlisten()
    patch({ isRunning: running, address, log: [...log].reverse() })
  }

  const planRoutes = async () => {
    const { config } = mock()
    return mock().isRunning
      ? (await server.update(sourcesInScope(), selectActiveVariables(app()), config)).routes
      : server.routes(sourcesInScope(), selectActiveVariables(app()), config)
  }

  async function refresh() {
    revision += 1
    const current = revision
    try {
      const routes = await planRoutes()
      if (current === revision) patch({ routes, failure: '' })
    } catch (error) {
      if (current === revision) patch({ failure: messageOf(error) })
    }
  }

  function refreshSoon() {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(refresh, REFRESH_DELAY_MS)
  }

  async function save() {
    clearTimeout(saveTimer)
    saveTimer = null
    try {
      await server.saveConfig(mock().config)
    } catch (error) {
      patch({ failure: messageOf(error) })
    }
  }

  function saveSoon() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(save, SAVE_DELAY_MS)
  }

  function change(update) {
    patch({ config: update(mock().config) })
    saveSoon()
    refreshSoon()
  }

  function watch() {
    if (stopWatching) return
    stopWatching = useAppStore.subscribe((state, previous) => {
      if (affectsRoutes(state, previous)) refreshSoon()
    })
  }

  function stopWatchingWhenIdle() {
    if (mock().isRunning || app().mockDialogOpen || !stopWatching) return
    clearTimeout(refreshTimer)
    stopWatching()
    stopWatching = null
  }

  async function open() {
    app().openMockDialog()
    if (!server) return
    watch()
    try {
      patch({ config: normalizeConfig(await server.loadConfig()) })
      adopt(await server.status())
    } catch (error) {
      patch({ failure: messageOf(error) })
    }
    await refresh()
  }

  async function close() {
    app().closeMockDialog()
    stopWatchingWhenIdle()
    if (saveTimer) await save()
  }

  async function start() {
    revision += 1
    patch({ isStarting: true, failure: '' })
    try {
      const state = await server.start(sourcesInScope(), selectActiveVariables(app()), mock().config)
      adopt(state)
      patch({ routes: state.routes })
    } catch (error) {
      patch({ failure: messageOf(error) })
    } finally {
      patch({ isStarting: false })
    }
  }

  async function stop() {
    try {
      await server.stop()
      adopt(STOPPED)
      await refresh()
    } catch (error) {
      patch({ failure: messageOf(error) })
    }
    stopWatchingWhenIdle()
  }

  async function importSpec(source) {
    patch({ isLoadingSpec: true, failure: '' })
    try {
      const spec = await server.fromSpec(source)
      change((config) => ({ ...config, spec: { title: spec.title, sources: spec.sources } }))
    } catch (error) {
      patch({ failure: messageOf(error) })
    } finally {
      patch({ isLoadingSpec: false })
    }
  }

  const setSettings = (changes) => change((config) => ({ ...config, settings: { ...config.settings, ...changes } }))

  const setRouteOptions = (routeId, changes) => change((config) => ({
    ...config,
    routes: { ...config.routes, [routeId]: { disabled: false, behavior: emptyBehavior(), ...config.routes[routeId], ...changes } },
  }))

  const setRules = (update) => change((config) => ({ ...config, rules: update(config.rules) }))

  function moveRule(id, offset) {
    setRules((rules) => {
      const from = rules.findIndex((rule) => rule.id === id)
      const to = from + offset
      if (from < 0 || to < 0 || to >= rules.length) return rules
      const reordered = [...rules]
      reordered.splice(to, 0, reordered.splice(from, 1)[0])
      return reordered
    })
  }

  return {
    isAvailable: Boolean(server),
    open,
    close,
    start,
    stop,
    importSpec,
    setSettings,
    pickSpecFile: backend.network ? (title) => backend.network.pickFile(title) : null,
    clearSpec: () => change((config) => ({ ...config, spec: { title: '', sources: [] } })),
    setScope: (folderId) => {
      patch({ folderId })
      refresh()
    },
    setTab: (tab) => patch({ tab }),
    selectExample: (routeId, exampleId) => change((config) => ({ ...config, selections: { ...config.selections, [routeId]: exampleId } })),
    setBehavior: (behavior) => setSettings({ behavior }),
    setRouteEnabled: (routeId, isEnabled) => setRouteOptions(routeId, { disabled: !isEnabled }),
    setRouteBehavior: (routeId, behavior) => setRouteOptions(routeId, { behavior }),
    addRule: () => setRules((rules) => [...rules, emptyRule()]),
    updateRule: (id, changes) => setRules((rules) => replaceAt(rules, id, changes)),
    removeRule: (id) => setRules((rules) => rules.filter((rule) => rule.id !== id)),
    moveRule,
    clearLog: () => {
      patch({ log: [] })
      server.clearLog()
    },
  }
}
