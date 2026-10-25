import { compareOrder } from './sortOrder.js'
import { foldCase, normalizeTags } from './tags.js'

export const ROOT_ID = ''
export const MAX_FOLDER_DEPTH = 32

export const ROW_FOLDER = 'folder'
export const ROW_REQUEST = 'request'
export const ROW_EMPTY = 'empty'

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

export function folderDepth(folderId, parentOf) {
  let depth = 0
  let ancestorId = parentOf.get(folderId)
  while (parentOf.has(ancestorId) && depth <= MAX_FOLDER_DEPTH) {
    depth += 1
    ancestorId = parentOf.get(ancestorId)
  }
  return depth
}

function sortedGroups(groups) {
  for (const group of groups.values()) group.sort(compareOrder)
  return groups
}

export function orderSiblings(folders, requests, shared) {
  const siblings = []
  let folderIndex = 0
  let requestIndex = 0
  while (folderIndex < folders.length || requestIndex < requests.length) {
    const requestFirst = requestIndex < requests.length
      && (folderIndex === folders.length || (shared && compareOrder(requests[requestIndex], folders[folderIndex]) < 0))
    if (requestFirst) siblings.push({ kind: ROW_REQUEST, item: requests[requestIndex++] })
    else siblings.push({ kind: ROW_FOLDER, item: folders[folderIndex++] })
  }
  return siblings
}

function siblingGroups(childFolders, folderRequests, shared) {
  const groups = new Map()
  for (const containerId of new Set([...childFolders.keys(), ...folderRequests.keys()])) {
    groups.set(containerId, orderSiblings(childFolders.get(containerId) || NO_ITEMS, folderRequests.get(containerId) || NO_ITEMS, shared))
  }
  return groups
}

export function buildCollectionTree(folders, requests, sharedOrder = false) {
  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId]))
  const containerOf = (id) => (parentOf.has(id) ? id : ROOT_ID)
  const parentFolderOf = (folder) => (
    folderDepth(folder.id, parentOf) > MAX_FOLDER_DEPTH ? ROOT_ID : containerOf(folder.parentId)
  )
  const childFolders = sortedGroups(groupBy(folders, parentFolderOf))
  const folderRequests = sortedGroups(groupBy(requests, (request) => containerOf(request.folderId)))
  return { childFolders, folderRequests, siblings: siblingGroups(childFolders, folderRequests, sharedOrder) }
}

export const foldersIn = (tree, folderId) => tree.childFolders.get(folderId) || NO_ITEMS

export const requestsIn = (tree, folderId) => tree.folderRequests.get(folderId) || NO_ITEMS

export const siblingsIn = (tree, folderId) => tree.siblings.get(folderId) || NO_ITEMS

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

export function collectRequests(tree, folderId) {
  return siblingsIn(tree, folderId).flatMap(({ kind, item }) => (kind === ROW_FOLDER ? collectRequests(tree, item.id) : [item]))
}

export function inheritedTags(folders) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  return (request) => {
    const tags = [...normalizeTags(request.tags)]
    const visited = new Set()
    for (let id = request.folderId; byId.has(id) && !visited.has(id); id = byId.get(id).parentId) {
      visited.add(id)
      tags.push(...normalizeTags(byId.get(id).tags))
    }
    return normalizeTags(tags)
  }
}

export function buildSearchIndex(folders, requests) {
  const tagsOf = inheritedTags(folders)
  return {
    parentOf: new Map(folders.map((folder) => [folder.id, folder.parentId])),
    entries: requests.map((request) => ({ request, text: foldCase([request.name, request.url, ...tagsOf(request)].join('\n')) })),
  }
}

export function findMatches({ parentOf, entries }, query) {
  const needle = foldCase(query.trim())
  if (!needle) return null

  const requestIds = new Set()
  const folderIds = new Set()
  for (const { request, text } of entries) {
    if (!text.includes(needle)) continue
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
  const visitFolder = (folder, depth) => {
    const first = rows.length
    visit(folder.id, depth + 1)
    if (!matches && rows.length === first) rows.push({ kind: ROW_EMPTY, key: `${ROW_EMPTY}:${folder.id}`, depth: depth + 1, parentId: folder.id })
  }
  const visit = (containerId, depth) => {
    const siblings = []
    for (const { kind, item } of siblingsIn(tree, containerId)) {
      if (kind === ROW_FOLDER) {
        if (matches && !matches.folderIds.has(item.id)) continue
        const isOpen = Boolean(matches) || item.isOpen
        const row = { kind, key: `${kind}:${item.id}`, depth, folder: item, isOpen }
        rows.push(row)
        siblings.push(row)
        if (isOpen) visitFolder(item, depth)
        continue
      }
      if (matches && !matches.requestIds.has(item.id)) continue
      const row = { kind, key: `${kind}:${item.id}`, depth, request: item }
      rows.push(row)
      siblings.push(row)
    }
    siblings.forEach((row, index) => {
      row.position = index + 1
      row.siblings = siblings.length
    })
  }
  visit(ROOT_ID, 0)
  return rows
}
