import { create } from 'zustand'
import { ROOT_ID } from '../collectionTree'
import { choiceFor } from '../environmentScope'
import { createFlowRunner, runResults, useFlowRunStore } from '../flows/flowRunner'
import { normalizeFlow } from '../flows/model'
import { MONITORS_TEXT } from '../monitorsText'
import { createRunner, requestsToRun } from '../runner'
import { iterationCount } from '../runData'
import { readStored } from '../storage'
import { useAppStore } from '../../store/appStore'
import {
  EVENT_FAILED,
  EVENT_PASSED,
  KIND_FLOW,
  KIND_FOLDER,
  buildRecord,
  cleanerFor,
  eventFor,
  hiddenValues,
  noticeFor,
} from './monitorRecord'

export const MIN_INTERVAL_MINUTES = 1
export const MAX_INTERVAL_MINUTES = 1440
export const DEFAULT_INTERVAL_MINUTES = 15
export const INTERVALS = [
  { minutes: 1, key: 'm1' },
  { minutes: 5, key: 'm5' },
  { minutes: 15, key: 'm15' },
  { minutes: 30, key: 'm30' },
  { minutes: 60, key: 'h1' },
  { minutes: 360, key: 'h6' },
  { minutes: 720, key: 'h12' },
  { minutes: 1440, key: 'h24' },
]
export const RETENTION = 200

const MS_PER_MINUTE = 60000
const STORAGE_PREFIX = 'gostman.monitors:'
const NO_TAGS = { include: [], exclude: [] }
const QUIET = { start() {}, finish() {} }

export const useMonitorStore = create(() => ({
  isOpen: false,
  monitors: [],
  histories: {},
  running: {},
  nextRuns: {},
  hasData: {},
  failures: {},
  editing: null,
  selectedId: '',
}))

const state = () => useMonitorStore.getState()
const patch = (changes) => useMonitorStore.setState(changes)
const app = () => useAppStore.getState()
const scopeOf = () => app().workspaceStatus?.path || ''
const keyOf = () => `${STORAGE_PREFIX}${scopeOf()}`
const withKey = (table, id, value) => ({ ...table, [id]: value })
const without = (table, id) => Object.fromEntries(Object.entries(table).filter(([key]) => key !== id))

export const blankMonitor = (targetKind = KIND_FOLDER, targetId = ROOT_ID) => ({
  id: '',
  name: '',
  kind: targetKind,
  targetId,
  environmentId: '',
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  paused: false,
  dataName: '',
  notify: true,
  browserNotify: false,
  hasWebhook: false,
})

function normalizeMonitor(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || raw.id === '') return null
  const minutes = Math.round(Number(raw.intervalMinutes))
  return {
    ...blankMonitor(raw.kind === KIND_FLOW ? KIND_FLOW : KIND_FOLDER, typeof raw.targetId === 'string' ? raw.targetId : ROOT_ID),
    id: raw.id,
    name: String(raw.name || ''),
    environmentId: typeof raw.environmentId === 'string' ? raw.environmentId : '',
    intervalMinutes: Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Number.isFinite(minutes) ? minutes : DEFAULT_INTERVAL_MINUTES)),
    paused: Boolean(raw.paused),
    dataName: typeof raw.dataName === 'string' ? raw.dataName : '',
    notify: raw.notify !== false,
    browserNotify: Boolean(raw.browserNotify),
    hasWebhook: Boolean(raw.hasWebhook),
  }
}

function loadDefinitions() {
  try {
    const parsed = JSON.parse(readStored(keyOf()) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeMonitor).filter(Boolean) : []
  } catch {
    return []
  }
}

function persistDefinitions(monitors) {
  try {
    localStorage.setItem(keyOf(), JSON.stringify(monitors))
  } catch {
    return
  }
}

export const nameOfTarget = (monitor, appState) => {
  if (monitor.kind === KIND_FLOW) return appState.flows.find((flow) => flow.id === monitor.targetId)?.name || ''
  if (monitor.targetId === ROOT_ID) return MONITORS_TEXT.form.allRequests
  return appState.folders.find((folder) => folder.id === monitor.targetId)?.name || ''
}

const rowsFor = new Map()

function useEnvironment(environmentId, folderId) {
  if (!environmentId) return () => {}
  const before = { activeEnvironmentId: app().activeEnvironmentId, environmentChoices: app().environmentChoices }
  useAppStore.setState(choiceFor(app(), folderId, environmentId))
  return () => useAppStore.setState(before)
}

export function createMonitorActions(backend, { execute }) {
  const history = backend.monitors
  const timers = new Map()
  let queue = Promise.resolve()

  const flowRunner = createFlowRunner(execute, (sendId) => backend.cancel(sendId))

  async function runFolder(monitor, rows) {
    const results = []
    const runner = createRunner(backend, execute, { ...QUIET, add: (result) => results.push(result) })
    const planned = requestsToRun(app(), monitor.targetId, NO_TAGS).length * iterationCount(rows, 0)
    await runner.start({ folderId: monitor.targetId, delayMs: 0, stopOnFailure: false, parallel: 1, rows, iterations: 0, tagFilter: NO_TAGS })
    return { results, planned, outcome: '' }
  }

  async function runFlow(monitor) {
    const flow = app().flows.find((candidate) => candidate.id === monitor.targetId)
    if (!flow) throw new Error(MONITORS_TEXT.form.targetRequired)
    const tabId = `monitor-${monitor.id}`
    await flowRunner.start(tabId, normalizeFlow(flow))
    const run = useFlowRunStore.getState().runs[tabId]
    const results = runResults(run)
    flowRunner.discard(tabId)
    return { results, planned: results.length, outcome: run?.status === 'passed' ? 'passed' : 'failed' }
  }

  async function loadHistory(monitorId) {
    const records = await history.runs(scopeOf())
    return records.filter((record) => record.monitor === monitorId).sort((first, second) => (first.id < second.id ? -1 : 1))
  }

  async function announce(monitor, record, previous) {
    const event = eventFor(record.passed, previous?.passed === false)
    const repeatedFailure = event === EVENT_FAILED && previous?.passed === false
    if (!monitor.notify || event === EVENT_PASSED || repeatedFailure) return
    const title = event === EVENT_FAILED ? MONITORS_TEXT.notifyTitleFailed(record.target || monitor.name) : MONITORS_TEXT.notifyTitleRecovered(record.target || monitor.name)
    if (monitor.hasWebhook && history.webhook) await history.webhook.notify(monitor.id, noticeFor(record, event))
    if (monitor.browserNotify && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body: MONITORS_TEXT.notifyBody({ failed: record.summary.failed, requests: record.summary.requests }) })
    }
  }

  async function execution(monitor) {
    const rows = rowsFor.get(monitor.id) || []
    const startedAt = new Date()
    const restore = useEnvironment(monitor.environmentId, monitor.kind === KIND_FOLDER ? monitor.targetId : ROOT_ID)
    try {
      const ran = monitor.kind === KIND_FLOW ? await runFlow(monitor) : await runFolder(monitor, rows)
      const appState = app()
      const inScope = monitor.kind === KIND_FLOW ? appState.requests : requestsToRun(appState, monitor.targetId, NO_TAGS)
      const environmentId = monitor.environmentId || appState.activeEnvironmentId
      return buildRecord({
        monitor,
        target: nameOfTarget(monitor, appState) || monitor.name,
        environment: appState.environments.find((candidate) => candidate.id === environmentId)?.name || '',
        startedAt,
        finishedAt: new Date(),
        ...ran,
        clean: cleanerFor(hiddenValues(appState, inScope, rows)),
      })
    } finally {
      restore()
    }
  }

  async function perform(id) {
    const monitor = state().monitors.find((candidate) => candidate.id === id)
    if (!monitor || state().running[id]) return
    if (monitor.dataName && !rowsFor.has(id)) {
      patch({ hasData: withKey(state().hasData, id, false) })
      return
    }
    patch({ running: withKey(state().running, id, true), failures: without(state().failures, id) })
    try {
      let record
      try {
        record = { ...(await execution(monitor)), monitor: id }
      } catch (error) {
        patch({ failures: withKey(state().failures, id, error?.message || MONITORS_TEXT.runFailed) })
        return
      }
      const previous = state().histories[id]?.at(-1)
      await history.save(scopeOf(), record, RETENTION)
      patch({ histories: withKey(state().histories, id, [...(state().histories[id] || []), record].slice(-RETENTION)) })
      await announce(monitor, record, previous).catch((error) => patch({ failures: withKey(state().failures, id, error?.message || String(error)) }))
    } finally {
      patch({ running: without(state().running, id) })
    }
  }

  const runNow = (id) => {
    queue = queue.then(() => perform(id)).catch(() => {})
    return queue
  }

  function unschedule(id) {
    clearTimeout(timers.get(id))
    timers.delete(id)
    patch({ nextRuns: without(state().nextRuns, id) })
  }

  function schedule(monitor) {
    unschedule(monitor.id)
    if (monitor.paused) return
    const delay = monitor.intervalMinutes * MS_PER_MINUTE
    patch({ nextRuns: withKey(state().nextRuns, monitor.id, Date.now() + delay) })
    timers.set(monitor.id, setTimeout(async () => {
      await runNow(monitor.id)
      const current = state().monitors.find((candidate) => candidate.id === monitor.id)
      if (current) schedule(current)
    }, delay))
  }

  async function adopt(monitors) {
    timers.forEach((_, id) => unschedule(id))
    patch({ monitors, histories: {} })
    monitors.forEach(schedule)
    const records = await history.runs(scopeOf()).catch(() => [])
    const histories = {}
    monitors.forEach((monitor) => {
      histories[monitor.id] = records.filter((record) => record.monitor === monitor.id).sort((first, second) => (first.id < second.id ? -1 : 1))
    })
    patch({ histories })
  }

  const commit = (monitors) => {
    persistDefinitions(monitors)
    patch({ monitors })
  }

  function open(target) {
    const monitors = state().monitors
    patch({
      isOpen: true,
      editing: target ? { ...blankMonitor(target.kind, target.id), dataName: target.data?.name ?? '', rows: target.data?.rows } : null,
      selectedId: state().selectedId || monitors[0]?.id || '',
    })
  }

  const close = () => patch({ isOpen: false, editing: null })
  const select = (id) => patch({ selectedId: id, editing: null })
  const startNew = () => patch({ editing: blankMonitor() })
  const startEdit = (id) => patch({ editing: state().monitors.find((monitor) => monitor.id === id) || null })
  const cancelEdit = () => patch({ editing: null })

  async function save(draft, webhookAddress, rows) {
    const isNew = draft.id === ''
    const id = isNew ? `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : draft.id
    let hasWebhook = draft.hasWebhook
    if (history.webhook) {
      if (webhookAddress.trim()) {
        await history.webhook.save(id, webhookAddress.trim())
        hasWebhook = true
      } else if (!draft.notify && draft.hasWebhook) {
        await history.webhook.remove(id)
        hasWebhook = false
      }
    }
    if (rows) rowsFor.set(id, rows)
    if (rows === null) rowsFor.delete(id)
    patch({ hasData: withKey(state().hasData, id, rowsFor.has(id)) })
    const monitor = normalizeMonitor({ ...draft, id, hasWebhook, dataName: rowsFor.has(id) || rows === undefined ? draft.dataName : '' })
    const monitors = isNew ? [...state().monitors, monitor] : state().monitors.map((candidate) => (candidate.id === id ? monitor : candidate))
    commit(monitors)
    schedule(monitor)
    patch({ editing: null, selectedId: id })
  }

  async function remove(id) {
    unschedule(id)
    rowsFor.delete(id)
    if (history.webhook) await history.webhook.remove(id).catch(() => {})
    commit(state().monitors.filter((monitor) => monitor.id !== id))
    patch({ histories: without(state().histories, id), selectedId: state().selectedId === id ? '' : state().selectedId })
  }

  function confirmRemove(id) {
    const monitor = state().monitors.find((candidate) => candidate.id === id)
    if (monitor) app().showConfirm(MONITORS_TEXT.deleteTitle, MONITORS_TEXT.deleteMessage(monitor.name), () => remove(id), null, 'destructive')
  }

  function togglePause(id) {
    const monitors = state().monitors.map((monitor) => (monitor.id === id ? { ...monitor, paused: !monitor.paused } : monitor))
    commit(monitors)
    schedule(monitors.find((monitor) => monitor.id === id))
  }

  function start() {
    adopt(loadDefinitions())
    let path = scopeOf()
    useAppStore.subscribe((next) => {
      const current = next.workspaceStatus?.path || ''
      if (current === path) return
      path = current
      adopt(loadDefinitions())
    })
  }

  return {
    start,
    open,
    close,
    select,
    startNew,
    startEdit,
    cancelEdit,
    save,
    confirmRemove,
    togglePause,
    runNow,
    hasWebhooks: Boolean(history.webhook),
  }
}
