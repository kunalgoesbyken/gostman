import { useEffect } from 'react'
import { isPlainObject } from './dataUtils'
import { createStoredState } from './storage'

const STORAGE_KEY = 'gostman.updates'
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const RECHECK_EVERY_MS = 60 * 60 * 1000

const textOr = (value, fallback) => (typeof value === 'string' ? value : fallback)

const releaseOf = (value) => (
  isPlainObject(value) && typeof value.version === 'string' && typeof value.url === 'string' ? { version: value.version, url: value.url } : null
)

export const useUpdateStore = createStoredState(STORAGE_KEY, (source) => ({
  enabled: source.enabled === true,
  checkedAt: Number.isFinite(source.checkedAt) ? source.checkedAt : 0,
  checkedFor: textOr(source.checkedFor, ''),
  failed: source.failed === true,
  latest: releaseOf(source.latest),
  dismissed: textOr(source.dismissed, ''),
}))

const updateState = (patch) => useUpdateStore.getState().update(patch)

export const setUpdateChecks = (enabled) => updateState({ enabled })

export const dismissUpdate = (version) => updateState({ dismissed: version })

const isDue = (state, now) => state.checkedFor !== __APP_VERSION__ || now - state.checkedAt >= CHECK_INTERVAL_MS

async function checkIfDue(updates) {
  const state = useUpdateStore.getState()
  if (!state.enabled || !isDue(state, Date.now())) return
  const checked = { checkedAt: Date.now(), checkedFor: __APP_VERSION__ }
  try {
    const release = await updates.latest()
    updateState({ ...checked, failed: false, latest: release.newer ? releaseOf(release) : null })
  } catch {
    updateState({ ...checked, failed: true })
  }
}

export function useUpdateCheck(updates) {
  const enabled = useUpdateStore((state) => state.enabled)

  useEffect(() => {
    if (!updates || !enabled) return undefined
    checkIfDue(updates)
    const timer = setInterval(() => checkIfDue(updates), RECHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [updates, enabled])
}

export const selectAvailableUpdate = (state) => (
  state.enabled && state.checkedFor === __APP_VERSION__ && state.latest && state.latest.version !== state.dismissed ? state.latest : null
)
