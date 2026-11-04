import { useEffect } from 'react'
import { create } from 'zustand'
import { isPlainObject } from './dataUtils'
import { createStoredState } from './storage'
import { SECTION_UPDATES, selectPreferencesSection } from './preferencesSection'
import { UPDATES_TEXT } from './updatesText'
import { flushPendingWrites, useAppStore } from '../store/appStore'

const STORAGE_KEY = 'gostman.updates'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const RECHECK_EVERY_MS = 60 * 60 * 1000

export const PHASE_IDLE = ''
export const PHASE_DOWNLOADING = 'downloading'
export const PHASE_VERIFYING = 'verifying'
export const PHASE_READY = 'ready'
const PHASE_INSTALLING = 'installing'
export const PHASE_FAILED = 'failed'
export const METHOD_MANUAL = 'manual'

const BUSY_PHASES = [PHASE_DOWNLOADING, PHASE_VERIFYING, PHASE_INSTALLING]

const textOr = (value, fallback) => (typeof value === 'string' ? value : fallback)

const releaseOf = (value) => (
  isPlainObject(value) && typeof value.version === 'string' && typeof value.url === 'string'
    ? { version: value.version, url: value.url, installs: value.installs === true, download: textOr(value.download, '') }
    : null
)

export const useUpdateStore = createStoredState(STORAGE_KEY, (source) => ({
  enabled: source.enabled !== false,
  autoInstall: source.enabled !== false && source.autoInstall !== false,
  checkedAt: Number.isFinite(source.checkedAt) ? source.checkedAt : 0,
  checkedFor: textOr(source.checkedFor, ''),
  failed: source.failed === true,
  latest: releaseOf(source.latest),
  dismissed: textOr(source.dismissed, ''),
}))

const NO_PROGRESS = { version: '', received: 0, total: 0, failure: '', detail: '' }

export const useUpdateProgress = create(() => ({
  ...NO_PROGRESS,
  phase: PHASE_IDLE,
  method: METHOD_MANUAL,
  manager: '',
  asksPermission: false,
  checking: false,
}))

const updateState = (patch) => useUpdateStore.getState().update(patch)

const receiveProgress = (state) => {
  if (isPlainObject(state)) useUpdateProgress.setState({ ...NO_PROGRESS, ...state })
}

export const setUpdateChecks = (enabled) => updateState(enabled ? { enabled } : { enabled, autoInstall: false, latest: null })

export const setAutoInstall = (autoInstall) => updateState(autoInstall ? { autoInstall, enabled: true } : { autoInstall })

export const dismissUpdate = (version) => updateState({ dismissed: version })

export const isBusy = (phase) => BUSY_PHASES.includes(phase)

export const canInstall = (progress) => progress.method !== METHOD_MANUAL

const isDue = (state, now) => state.checkedFor !== __APP_VERSION__ || now - state.checkedAt >= CHECK_INTERVAL_MS

export function downloadUpdate(updates, version) {
  if (isBusy(useUpdateProgress.getState().phase)) return
  useUpdateProgress.setState({ ...NO_PROGRESS, phase: PHASE_DOWNLOADING, version })
  updates.download(version).then(receiveProgress, () => updates.state().then(receiveProgress))
}

function installIfWanted(updates, release) {
  const progress = useUpdateProgress.getState()
  const wanted = useUpdateStore.getState().autoInstall && release?.installs && canInstall(progress)
  const settled = progress.phase === PHASE_IDLE || (progress.phase === PHASE_READY && progress.version !== release?.version)
  if (wanted && settled) downloadUpdate(updates, release.version)
}

export async function checkNow(updates) {
  const checked = { checkedAt: Date.now(), checkedFor: __APP_VERSION__ }
  useUpdateProgress.setState({ checking: true })
  try {
    const release = await updates.latest()
    const latest = release.newer ? releaseOf(release) : null
    updateState({ ...checked, failed: false, latest })
    installIfWanted(updates, latest)
  } catch {
    updateState({ ...checked, failed: true })
  } finally {
    useUpdateProgress.setState({ checking: false })
  }
}

async function checkIfDue(updates) {
  const state = useUpdateStore.getState()
  if (!state.enabled || !isDue(state, Date.now())) return
  await checkNow(updates)
}

export function useUpdateCheck(updates) {
  const enabled = useUpdateStore((state) => state.enabled)
  const autoInstall = useUpdateStore((state) => state.autoInstall)

  useEffect(() => {
    if (!updates) return undefined
    updates.state().then(receiveProgress)
    return updates.onState(receiveProgress)
  }, [updates])

  useEffect(() => {
    if (updates) updates.setAutoInstall(autoInstall)
    if (updates && autoInstall) installIfWanted(updates, useUpdateStore.getState().latest)
  }, [updates, autoInstall])

  useEffect(() => {
    if (!updates || !enabled) return undefined
    checkIfDue(updates)
    const timer = setInterval(() => checkIfDue(updates), RECHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [updates, enabled])
}

export const selectAvailableUpdate = (state) => (
  state.checkedFor === __APP_VERSION__ && state.latest && state.latest.version !== state.dismissed ? state.latest : null
)

export function openUpdatesSection() {
  selectPreferencesSection(SECTION_UPDATES)
  useAppStore.getState().openPreferencesDialog()
}

async function restart(updates) {
  await flushPendingWrites()
  try {
    await updates.restart()
  } catch {
    updates.state().then(receiveProgress)
  }
}

export const restartMessage = ({ version, asksPermission }) => (
  asksPermission ? UPDATES_TEXT.restartMessageInstaller(version) : UPDATES_TEXT.restartMessage(version)
)

export function confirmRestart(updates) {
  const message = restartMessage(useUpdateProgress.getState())
  useAppStore.getState().showConfirm(UPDATES_TEXT.restartTitle, message, () => restart(updates), null, 'default', UPDATES_TEXT.restartNow)
}
