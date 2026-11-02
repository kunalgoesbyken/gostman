import { readStoredJSON, writeStored } from './storage'

const STORAGE_KEY = 'gostman.hiddenHints'

export const hiddenHints = () => {
  const stored = readStoredJSON(STORAGE_KEY, [])
  return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
}

export const hideHint = (id) => writeStored(STORAGE_KEY, JSON.stringify([...new Set([...hiddenHints(), id])]))
