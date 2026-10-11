import { create } from 'zustand'
import { ROOT_ID, buildCollectionTree, collectRequests } from './collectionTree'
import { selectActiveVariables, useAppStore } from '../store/appStore'

export const ROUTE_SERVED = 'served'
export const ROUTE_NO_EXAMPLE = 'no-example'
export const ROUTE_CONFLICT = 'conflict'

const DEFAULT_PORT = 4010
const HIGHEST_PORT = 65535
const HIGHEST_DELAY_MS = 60_000
const LOG_LIMIT = 200
const REFRESH_DELAY_MS = 250
const STOPPED = { running: false, address: '' }

const INITIAL_STATE = {
  isRunning: false,
  isStarting: false,
  address: '',
  routes: [],
  log: [],
  failure: '',
  folderId: ROOT_ID,
  selections: {},
  settings: { port: DEFAULT_PORT, delayMs: 0, cors: false },
}

export const useMockStore = create(() => INITIAL_STATE)

const mock = () => useMockStore.getState()
const patch = (changes) => useMockStore.setState(changes)
const app = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)

const wholeNumber = (text, highest) => Math.min(highest, Math.max(0, Math.trunc(Number(text)) || 0))

export const toPort = (text) => wholeNumber(text, HIGHEST_PORT)

export const toDelayMs = (text) => wholeNumber(text, HIGHEST_DELAY_MS)

function requestsInScope() {
  const { folders, requests } = app()
  return collectRequests(buildCollectionTree(folders, requests), mock().folderId)
}

const toSource = (selections) => ({ id, name, method, url, examples }) => (
  { id, name, method, url, examples, exampleId: selections[id] || '' }
)

const sourcesInScope = () => requestsInScope().map(toSource(mock().selections))

const affectsRoutes = (state, previous) => (
  state.requests !== previous.requests
  || state.folders !== previous.folders
  || selectActiveVariables(state) !== selectActiveVariables(previous)
)

export function createMockActions(backend) {
  const server = backend.mock
  let revision = 0
  let entrySequence = 0
  let refreshTimer = null
  let stopWatching = null
  let stopListening = null

  function record(entry) {
    entrySequence += 1
    patch({ log: [{ ...entry, id: entrySequence }, ...mock().log].slice(0, LOG_LIMIT) })
  }

  function listen() {
    if (!stopListening) stopListening = server.onRequest(record)
  }

  function unlisten() {
    stopListening?.()
    stopListening = null
  }

  function adopt({ running, address }) {
    if (running) listen()
    else unlisten()
    patch({ isRunning: running, address })
  }

  const planRoutes = async () => (
    mock().isRunning
      ? (await server.update(sourcesInScope(), selectActiveVariables(app()))).routes
      : server.routes(sourcesInScope(), selectActiveVariables(app()))
  )

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
      adopt(await server.status())
    } catch (error) {
      patch({ failure: messageOf(error) })
    }
    await refresh()
  }

  function close() {
    app().closeMockDialog()
    stopWatchingWhenIdle()
  }

  async function start() {
    revision += 1
    patch({ isStarting: true, failure: '' })
    try {
      const state = await server.start(sourcesInScope(), selectActiveVariables(app()), mock().settings)
      adopt(state)
      patch({ routes: state.routes, log: [] })
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

  function setScope(folderId) {
    patch({ folderId })
    refresh()
  }

  function selectExample(requestId, exampleId) {
    patch({ selections: { ...mock().selections, [requestId]: exampleId } })
    refresh()
  }

  return {
    isAvailable: Boolean(server),
    open,
    close,
    start,
    stop,
    setScope,
    selectExample,
    setSettings: (changes) => patch({ settings: { ...mock().settings, ...changes } }),
    clearLog: () => patch({ log: [] }),
  }
}
