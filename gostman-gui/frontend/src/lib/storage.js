import { create } from 'zustand'
import { isPlainObject, parseJSON } from './dataUtils'

const QUOTA_EXCEEDED = 'QuotaExceededError'

export const TAB_DRAFTS_KEY = 'gostman-storage'

export const isStorageFull = (error) => error?.name === QUOTA_EXCEEDED

export function storageFullError(room) {
  const error = new Error(QUOTA_EXCEEDED)
  error.name = QUOTA_EXCEEDED
  error.room = room
  return error
}

export async function storageRoom() {
  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return {}
  }
}

export const localRecords = (storage) => ({
  inDatabase: false,
  read: async (key) => storage.getItem(key),
  write: async (key, text) => storage.setItem(key, text),
  remove: async (key) => storage.removeItem(key),
  keys: async () => Object.keys(storage),
})

export function readStored(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function removeStored(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

export const readStoredJSON = (key, fallback) => parseJSON(readStored(key) ?? '', fallback)

const DATA_DELETED_KEY = 'gostman.dataDeleted'

export function markDataDeleted() {
  try {
    sessionStorage.setItem(DATA_DELETED_KEY, '1')
  } catch {
    return
  }
}

export function takeDataDeleted() {
  try {
    const isMarked = sessionStorage.getItem(DATA_DELETED_KEY) !== null
    sessionStorage.removeItem(DATA_DELETED_KEY)
    return isMarked
  } catch {
    return false
  }
}

export function createStoredState(key, normalize) {
  const read = () => {
    const stored = readStoredJSON(key, null)
    return normalize(isPlainObject(stored) ? stored : {})
  }
  return create((set, get) => ({
    ...read(),
    update: (patch) => {
      set(patch)
      writeStored(key, JSON.stringify(normalize(get())))
    },
  }))
}
