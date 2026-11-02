import { create } from 'zustand'
import { draftRequests, isSavable, suggestedFolderName } from './captureConversion'
import { textToBase64 } from './base64'
import { answerRuleFrom, canAnswerWith, emptyCaptureRule, normalizeCaptureConfig, normalizeCaptureRule, withoutDraftEdits } from './captureRules'
import { ROOT_ID } from './collectionTree'
import { CAPTURE_ACTION_TEXT } from './captureText'
import { DIALOG_TEXT } from './dialogText'
import { isAsking } from './exampleActions'
import { toPort } from './mockServer'
import { useAppStore } from '../store/appStore'

export const NEW_FOLDER = 'capture:new-folder'

const DEFAULT_PORT = 4020
const LOG_LIMIT = 500
const SAVE_DELAY_MS = 400
const YAML_TYPE = 'application/yaml'
const HAR_TYPE = 'application/json'

export const VIEW_CALLS = 'calls'
export const VIEW_RULES = 'rules'
export const VIEW_HELD = 'held'

const INITIAL_STATE = {
  isOpen: false,
  isRunning: false,
  isStarting: false,
  address: '',
  upstream: '',
  port: DEFAULT_PORT,
  log: [],
  detail: null,
  view: VIEW_CALLS,
  config: normalizeCaptureConfig(null),
  held: [],
  comparison: null,
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

export function createCaptureActions(backend, mockActions) {
  const server = backend.capture
  let inspection = 0
  let stopListening = null
  let stopHeld = null
  let saveTimer = null

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

  function listenHeld() {
    if (stopHeld) return
    const stopArrivals = server.onHeld((held) => patch({ held: [...capture().held.filter((one) => one.id !== held.id), held] }))
    const stopSettled = server.onSettled((id) => patch({ held: capture().held.filter((one) => one.id !== id) }))
    stopHeld = () => {
      stopArrivals?.()
      stopSettled?.()
    }
  }

  async function save() {
    clearTimeout(saveTimer)
    saveTimer = null
    try {
      await server.saveConfig(withoutDraftEdits(capture().config))
    } catch (error) {
      patch({ failure: messageOf(error) })
    }
  }

  function change(update) {
    patch({ config: update(capture().config) })
    clearTimeout(saveTimer)
    saveTimer = setTimeout(save, SAVE_DELAY_MS)
  }

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

  async function loadWorkbench() {
    patch({ config: normalizeCaptureConfig(await server.loadConfig()), held: await server.held() })
    listenHeld()
  }

  function adopt({ running, address, upstream }) {
    if (running) listen()
    else unlisten()
    patch({ isRunning: running, address, upstream: running ? upstream : capture().upstream, port: running ? portOf(address) : capture().port })
  }

  async function sync() {
    adopt(await server.status())
    await loadWorkbench()
    patch({ log: mergeLogs(await server.list(), capture().log) })
  }

  const refresh = report(sync)

  const resume = report(async () => {
    if (!server) return
    adopt(await server.status())
    if (capture().isRunning) await loadWorkbench()
  })

  if (server) {
    useAppStore.subscribe((state, previous) => {
      if (previous.isRestricted && !state.isRestricted && capture().isOpen) report(loadWorkbench)()
    })
  }

  async function open() {
    patch({ isOpen: true, failure: '' })
    if (server) await refresh()
  }

  async function close() {
    if (isAsking()) return
    patch({ isOpen: false })
    if (saveTimer) await save()
  }

  async function start() {
    patch({ isStarting: true, failure: '' })
    try {
      if (saveTimer) await save()
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

  const exportRules = report(async () => {
    const text = await server.exportRules(capture().config.rules)
    await backend.saveFile(CAPTURE_ACTION_TEXT.rulesName, textToBase64(text), YAML_TYPE)
  })

  const importRules = report(async (file) => {
    let imported
    try {
      imported = await server.importRules(await file.text())
    } catch (error) {
      patch({ failure: CAPTURE_ACTION_TEXT.rulesImportFailed({ reason: messageOf(error) }) })
      return
    }
    setRules((rules) => [...rules, ...imported.map(normalizeCaptureRule)])
    app().showAlert(CAPTURE_ACTION_TEXT.importedTitle, CAPTURE_ACTION_TEXT.rulesImported(imported.length), DIALOG_TEXT.ok, 'success')
  })

  const exportHar = report(async (ids) => {
    await backend.saveFile(CAPTURE_ACTION_TEXT.harName, textToBase64(await server.har(ids)), HAR_TYPE)
  })

  const makeMockRule = report(async (exchange) => {
    let rule
    try {
      rule = await server.mockRule(exchange.id)
    } catch {
      app().showAlert(CAPTURE_ACTION_TEXT.nothingSavedTitle, CAPTURE_ACTION_TEXT.mockRuleUnavailable, DIALOG_TEXT.ok, 'warning')
      return
    }
    await mockActions.addRules([rule])
    app().showAlert(CAPTURE_ACTION_TEXT.savedTitle, CAPTURE_ACTION_TEXT.mockRuleAdded({ name: rule.name }), DIALOG_TEXT.ok, 'success')
  })

  function answerWith(exchange) {
    if (!canAnswerWith(exchange)) {
      app().showAlert(CAPTURE_ACTION_TEXT.nothingSavedTitle, CAPTURE_ACTION_TEXT.answerRuleUnavailable, DIALOG_TEXT.ok, 'warning')
      return
    }
    const rule = answerRuleFrom(exchange)
    setRules((rules) => [...rules, rule])
    patch({ view: VIEW_RULES })
    app().showAlert(CAPTURE_ACTION_TEXT.savedTitle, CAPTURE_ACTION_TEXT.answerRuleAdded({ name: rule.name }), DIALOG_TEXT.ok, 'success')
  }

  const compare = report(async (ids) => {
    const [first, second] = (await server.details(ids)).sort((a, b) => a.id - b.id)
    const entry = (exchange) => ({ at: exchange.time, response: { ...exchange.response, status: exchange.status, durationMs: exchange.durationMs } })
    if (first && second) patch({ comparison: { earlier: entry(first), latest: entry(second) } })
  })

  const release = report((id, decision) => server.release(id, decision))
  const drop = report((id) => server.drop(id))

  return {
    isAvailable: Boolean(server),
    setView: (view) => patch({ view }),
    addRule: () => setRules((rules) => [...rules, emptyCaptureRule()]),
    updateRule: (id, changes) => setRules((rules) => rules.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule))),
    removeRule: (id) => setRules((rules) => rules.filter((rule) => rule.id !== id)),
    moveRule,
    setBreakSeconds: (breakSeconds) => change((config) => ({ ...config, breakSeconds })),
    exportRules,
    importRules,
    exportHar,
    makeMockRule,
    answerWith,
    compare,
    closeComparison: () => patch({ comparison: null }),
    release,
    drop,
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
