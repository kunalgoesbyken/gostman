export const ROOT_ID = ''

export const ROW_FOLDER = 'folder'
const ROW_REQUEST = 'request'

const NO_ITEMS = []

function groupBy(items, keyOf) {
  const groups = new Map()
  for (const item of items) {
    const key = keyOf(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}

export function buildCollectionTree(folders, requests) {
  const folderIds = new Set(folders.map((folder) => folder.id))
  const containerOf = (id) => (folderIds.has(id) ? id : ROOT_ID)
  return {
    childFolders: groupBy(folders, (folder) => containerOf(folder.parentId)),
    folderRequests: groupBy(requests, (request) => containerOf(request.folderId)),
  }
}

export const foldersIn = (tree, folderId) => tree.childFolders.get(folderId) || NO_ITEMS

export const requestsIn = (tree, folderId) => tree.folderRequests.get(folderId) || NO_ITEMS

export function listFolders(tree) {
  const entries = []
  const visit = (parentId, ancestors) => {
    for (const folder of foldersIn(tree, parentId)) {
      const path = [...ancestors, folder.name]
      entries.push({ folder, path, depth: ancestors.length })
      visit(folder.id, path)
    }
  }
  visit(ROOT_ID, [])
  return entries
}

export function findMatches(folders, requests, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return null

  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId]))
  const requestIds = new Set()
  const folderIds = new Set()
  for (const request of requests) {
    if (!`${request.name}\n${request.url}`.toLowerCase().includes(needle)) continue
    requestIds.add(request.id)
    let ancestorId = request.folderId
    while (parentOf.has(ancestorId) && !folderIds.has(ancestorId)) {
      folderIds.add(ancestorId)
      ancestorId = parentOf.get(ancestorId)
    }
  }
  return { requestIds, folderIds }
}

export function flattenCollection(tree, matches) {
  const rows = []
  const visit = (containerId, depth) => {
    for (const folder of foldersIn(tree, containerId)) {
      if (matches && !matches.folderIds.has(folder.id)) continue
      const isOpen = Boolean(matches) || folder.isOpen
      rows.push({ kind: ROW_FOLDER, key: `${ROW_FOLDER}:${folder.id}`, depth, folder, isOpen })
      if (isOpen) visit(folder.id, depth + 1)
    }
    for (const request of requestsIn(tree, containerId)) {
      if (matches && !matches.requestIds.has(request.id)) continue
      rows.push({ kind: ROW_REQUEST, key: `${ROW_REQUEST}:${request.id}`, depth, request })
    }
  }
  visit(ROOT_ID, 0)
  return rows
}
