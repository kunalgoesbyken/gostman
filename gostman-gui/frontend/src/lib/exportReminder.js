import { useEffect } from 'react'
import { createStoredState } from './storage'

const STORAGE_KEY = 'gostman.exportReminder'
const LARGE_COLLECTION = 50
const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000

const timeOf = (value) => (Number.isFinite(value) ? value : 0)

export const useExportReminderStore = createStoredState(STORAGE_KEY, (source) => ({
  since: timeOf(source.since),
  dismissedAt: timeOf(source.dismissedAt),
}))

const updateReminder = (patch) => useExportReminderStore.getState().update(patch)

export const noteExport = () => updateReminder({ since: Date.now(), dismissedAt: 0 })

export const dismissExportReminder = () => updateReminder({ dismissedAt: Date.now() })

export function useExportReminder(isEnabled, requestCount) {
  const since = useExportReminderStore((state) => state.since)
  const dismissedAt = useExportReminderStore((state) => state.dismissedAt)

  useEffect(() => {
    if (isEnabled && since === 0) updateReminder({ since: Date.now() })
  }, [isEnabled, since])

  return isEnabled && since > 0 && requestCount >= LARGE_COLLECTION && Date.now() - Math.max(since, dismissedAt) >= REMIND_AFTER_MS
}
