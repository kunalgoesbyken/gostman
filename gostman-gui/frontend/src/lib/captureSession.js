import { create } from 'zustand'
import { draftRequests, isSavable, suggestedFolderName } from './captureConversion'
import { ROOT_ID } from './collectionTree'
import { CAPTURE_ACTION_TEXT } from './captureText'
import { DIALOG_TEXT } from './dialogText'
import { isAsking } from './exampleActions'
import { toPort } from './mockServer'
import { useAppStore } from '../store/appStore'

export const NEW_FOLDER = 'capture:new-folder'

const DEFAULT_PORT = 4020
const LOG_LIMIT = 500

const INITIAL_STATE = {
  isOpen: false,
  isRunning: false,
  isStarting: false,
  address: '',
  upstream: '',
  port: DEFAULT_PORT,
  log: [],
  detail: null,
  failure: '',
}

export const useCaptureStore = create(() => INITIAL_STATE)

const capture = () => useCaptureStore.getState()
const patch = (changes) => useCaptureStore.setState(changes)
const app = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)
const newestFirst = (first, second) => second.id - first.id
const portOf = (address) => toPort(new URL(address).port)

function mergeLogs(...logs) {
  const byId = new Map(logs.flat().map((exchange) => [exchange.id, exchange]))
  return [...byId.values()].sort(newestFirst).slice(0, LOG_LIMIT)
}

const topLevelFolder = (name) => app().folders.find((folder) => !folder.parentId && folder.name === name)

function ensureTopLevelFolder(name) {
  const existing = topLevelFolder(name)
  if (existing) return existing
  const folder = { id: crypto.randomUUID(), name, isOpen: true, parentId: ROOT_ID }
  app().mergeFolders([folder])
  return folder
}

function destinationFor(target, exchanges) {
  if (target === NEW_FOLDER) return ensureTopLevelFolder(suggestedFolderName(exchanges))
  return app().folders.find((folder) => folder.id === target) || { id: ROOT_ID, name: '' }
}

const savedSummary = (count, folder) => (
  folder.id === ROOT_ID ? CAPTURE_ACTION_TEXT.savedTopLevel(count) : CAPTURE_ACTION_TEXT.savedToFolder({ count, name: folder.name })
)

export function createCaptureActions(backend) {
  const server = backend.capture
  let inspection = 0
  let stopListening = null

  const report = (run) => async (...args) => {
    try {
      await run(...args)
    } catch (error) {
      patch({ failure: messageOf(error) })
    }
  }

  function record(exchange) {
    patch({ log: mergeLogs([exchange], capture().log) })
  }

  function listen() {
    if (!stopListening) stopListening = server.onExchange(record)
  }

  function unlisten() {
    stopListening?.()
    stopListening = null
  }

  function adopt({ running, address, upstream }) {
    if (running) listen()
    else unlisten()
    patch({ isRunning: running, address, upstream: running ? upstream : capture().upstream, port: running ? portOf(address) : capture().port })
  }

  async function sync() {
    adopt(await server.status())
    patch({ log: mergeLogs(await server.list(), capture().log) })
  }

  const refresh = report(sync)

  const resume = report(async () => {
    if (server) adopt(await server.status())
  })

  async function open() {
    patch({ isOpen: true, failure: '' })
    if (server) await refresh()
  }

  function close() {
    if (!isAsking()) patch({ isOpen: false })
  }

  async function start() {
    patch({ isStarting: true, failure: '' })
    try {
      adopt(await server.start({ upstream: capture().upstream.trim(), port: capture().port }))
    } catch (error) {
      patch({ failure: messageOf(error) })
    } finally {
      patch({ isStarting: false })
    }
  }

  const stop = report(async () => {
    await server.stop()
    await sync()
  })

  const clear = report(async () => {
    await server.clear()
    patch({ log: [], detail: null })
  })

  const inspect = report(async (id) => {
    inspection += 1
    const current = inspection
    const [detail] = await server.details([id])
    if (current !== inspection) return
    patch({ detail: detail || null, failure: detail ? '' : CAPTURE_ACTION_TEXT.noLongerKept })
  })

  function openAsRequest(exchange) {
    const { requests, notes } = draftRequests([exchange])
    if (requests.length === 0) return
    app().openRequestTab(requests[0])
    patch({ isOpen: false })
    if (notes.length > 0) app().showAlert(CAPTURE_ACTION_TEXT.openedTitle, notes.join('\n'), DIALOG_TEXT.ok, 'warning')
  }

  const saveToFolder = report(async (ids, target) => {
    const exchanges = await server.details(ids)
    const savable = exchanges.filter(isSavable)
    if (savable.length === 0) {
      app().showAlert(CAPTURE_ACTION_TEXT.nothingSavedTitle, CAPTURE_ACTION_TEXT.nothingToSave, DIALOG_TEXT.ok, 'warning')
      return
    }
    const destination = destinationFor(target, savable)
    const { requests, notes } = draftRequests(exchanges, destination.id)
    app().upsertRequests(await backend.saveRequests(requests))
    const summary = savedSummary(requests.length, destination)
    app().showAlert(CAPTURE_ACTION_TEXT.savedTitle, [summary, ...notes].join('\n'), DIALOG_TEXT.ok, notes.length > 0 ? 'warning' : 'success')
  })

  return {
    isAvailable: Boolean(server),
    open,
    resume,
    close,
    start,
    stop,
    clear,
    inspect,
    openAsRequest,
    saveToFolder,
    closeDetail: () => patch({ detail: null }),
    setUpstream: (upstream) => patch({ upstream }),
    setPort: (text) => patch({ port: toPort(text) }),
  }
}
