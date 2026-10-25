import { ROOT_ID, ROW_EMPTY, ROW_FOLDER, ROW_REQUEST, siblingsIn } from './collectionTree'

const KEY_SEPARATOR = ':'

export const keyOf = ({ kind, id }) => `${kind}${KEY_SEPARATOR}${id}`

export function entryOfKey(key) {
  const at = key.indexOf(KEY_SEPARATOR)
  return { kind: key.slice(0, at), id: key.slice(at + 1) }
}

export const isSelectable = (row) => row.kind !== ROW_EMPTY

export function toggled(selection, key) {
  const next = new Set(selection)
  if (!next.delete(key)) next.add(key)
  return next
}

export function rangeBetween(rows, fromKey, toKey) {
  const from = rows.findIndex((row) => row.key === fromKey)
  const to = rows.findIndex((row) => row.key === toKey)
  if (to < 0) return []
  const start = from < 0 ? to : Math.min(from, to)
  const end = from < 0 ? to : Math.max(from, to)
  return rows.slice(start, end + 1).filter(isSelectable).map((row) => row.key)
}

export function existingKeys(selection, folders, requests) {
  const live = new Set([...folders.map((folder) => keyOf({ kind: ROW_FOLDER, id: folder.id })), ...requests.map((request) => keyOf({ kind: ROW_REQUEST, id: request.id }))])
  return new Set([...selection].filter((key) => live.has(key)))
}

export function treeOrder(tree, folderId = ROOT_ID) {
  return siblingsIn(tree, folderId).flatMap(({ kind, item }) => [{ kind, id: item.id }, ...(kind === ROW_FOLDER ? treeOrder(tree, item.id) : [])])
}

export function orderedEntries(selection, tree) {
  return treeOrder(tree).filter((entry) => selection.has(keyOf(entry)))
}

export function outermostEntries(entries, folders, requests) {
  const parents = new Map(folders.map((folder) => [folder.id, folder.parentId || ROOT_ID]))
  const holders = new Map(requests.map((request) => [request.id, request.folderId || ROOT_ID]))
  const chosen = new Set(entries.filter((entry) => entry.kind === ROW_FOLDER).map((entry) => entry.id))
  const containerOf = (entry) => (entry.kind === ROW_FOLDER ? parents : holders).get(entry.id)
  const isCovered = (entry) => {
    const seen = new Set()
    for (let id = containerOf(entry); id && id !== ROOT_ID && !seen.has(id); id = parents.get(id)) {
      if (chosen.has(id)) return true
      seen.add(id)
    }
    return false
  }
  return entries.filter((entry) => !isCovered(entry))
}

export function countKinds(entries) {
  const folders = entries.filter((entry) => entry.kind === ROW_FOLDER).length
  return { folders, requests: entries.length - folders }
}
