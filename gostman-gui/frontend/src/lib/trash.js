import { isPlainObject, parseJSON } from './dataUtils'

export const KIND_REQUEST = 'request'
export const KIND_FOLDER = 'folder'
export const KIND_ENVIRONMENT = 'environment'

export const TRASH_DAYS = 30
export const TRASH_LIMIT = 500

const KINDS = [KIND_REQUEST, KIND_FOLDER, KIND_ENVIRONMENT]
const DAY_MS = 24 * 60 * 60 * 1000

const isEntry = (value) => (
  isPlainObject(value)
  && KINDS.includes(value.kind)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && !Number.isNaN(Date.parse(value.deletedAt))
  && isPlainObject(value.item)
  && typeof value.item.id === 'string'
)

export function createEntry(kind, item, extra, now) {
  return { id: crypto.randomUUID(), kind, name: item.name ?? '', deletedAt: new Date(now).toISOString(), item, ...extra }
}

export const isExpired = (entry, now) => now - Date.parse(entry.deletedAt) >= TRASH_DAYS * DAY_MS

export const daysLeft = (entry, now) => Math.max(0, Math.ceil(TRASH_DAYS - (now - Date.parse(entry.deletedAt)) / DAY_MS))

export const pruned = (entries, now) => entries.filter((entry) => !isExpired(entry, now)).slice(-TRASH_LIMIT)

export function parseTrash(text) {
  const stored = parseJSON(text ?? '', [])
  return Array.isArray(stored) ? stored.filter(isEntry) : []
}

export const serializeTrash = (entries) => JSON.stringify(entries)
