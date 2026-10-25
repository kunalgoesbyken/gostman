import { MAX_FOLDER_DEPTH, ROOT_ID, ROW_FOLDER, ROW_REQUEST, buildCollectionTree, folderDepth, foldersIn, requestsIn, siblingsIn } from './collectionTree.js'
import { PLACE_AFTER, PLACE_BEFORE, PLACE_INSIDE } from './dropPlace.js'
import { cleanOrder } from './sortOrder.js'

export const TARGET_ROOT = 'root'

export const STEP_UP = -1
export const STEP_DOWN = 1

const MAX_CLONED_ITEMS = 5000
const COPY_SUFFIX = 'copy'

const PARENT_KEYS = { [ROW_FOLDER]: 'parentId', [ROW_REQUEST]: 'folderId' }

const listerFor = (kind) => (kind === ROW_FOLDER ? foldersIn : requestsIn)

const entryOf = ({ kind, id }) => ({ kind, id })

const sameEntry = (first, second) => first.kind === second.kind && first.id === second.id

const siblingEntries = (tree, containerId) => siblingsIn(tree, containerId).map(({ kind, item }) => ({ kind, id: item.id }))

function lookupsOf(folders, requests) {
  const parents = new Map(folders.map((folder) => [folder.id, folder.parentId || ROOT_ID]))
  return {
    parents,
    items: { [ROW_FOLDER]: new Map(folders.map((folder) => [folder.id, folder])), [ROW_REQUEST]: new Map(requests.map((request) => [request.id, request])) },
    containerOf: (id) => (parents.has(id) ? id : ROOT_ID),
  }
}

export function isInside(folderId, ancestorId, parents) {
  let current = folderId
  for (let step = 0; current !== ROOT_ID && step <= MAX_FOLDER_DEPTH + 1; step += 1) {
    if (current === ancestorId) return true
    current = parents.get(current) ?? ROOT_ID
  }
  return false
}

function subtreeHeight(tree, folderId, level = 0) {
  if (level > MAX_FOLDER_DEPTH) return level
  return foldersIn(tree, folderId).reduce((tallest, child) => Math.max(tallest, subtreeHeight(tree, child.id, level + 1)), level)
}

function fitsDepth(tree, parents, folderId, containerId) {
  const arrivalDepth = containerId === ROOT_ID ? 0 : folderDepth(containerId, parents) + 1
  return arrivalDepth + subtreeHeight(tree, folderId) <= MAX_FOLDER_DEPTH
}

export function canDropFolder(folders, folderId, containerId) {
  const { parents } = lookupsOf(folders, [])
  if (containerId === ROOT_ID) return true
  return !isInside(containerId, folderId, parents)
}

function insertEntry(entries, moved, anchor, place) {
  const rest = entries.filter((entry) => !sameEntry(entry, moved))
  const anchorIndex = anchor ? rest.findIndex((entry) => sameEntry(entry, anchor)) : -1
  if (anchorIndex < 0) return [...rest, moved]
  const at = place === PLACE_BEFORE ? anchorIndex : anchorIndex + 1
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}

function destinationOf(target, lookups) {
  if (target.kind === TARGET_ROOT) return { containerId: ROOT_ID, anchor: null, place: PLACE_AFTER }
  const anchorItem = lookups.items[target.kind]?.get(target.id)
  if (!anchorItem) return null
  if (target.kind === ROW_FOLDER && target.place === PLACE_INSIDE) return { containerId: target.id, anchor: null, place: PLACE_AFTER }
  const containerId = lookups.containerOf(anchorItem[PARENT_KEYS[target.kind]] || ROOT_ID)
  return { containerId, anchor: entryOf(target), place: target.place }
}

const emptyPatches = () => ({ [ROW_FOLDER]: [], [ROW_REQUEST]: [] })

function listPatches(containerId, entries, items) {
  const patches = emptyPatches()
  entries.forEach(({ kind, id }, index) => {
    const parentKey = PARENT_KEYS[kind]
    const current = items[kind].get(id)
    const sortOrder = index + 1
    if (current && (current[parentKey] || ROOT_ID) === containerId && cleanOrder(current.sortOrder) === sortOrder) return
    patches[kind].push({ id, [parentKey]: containerId, sortOrder })
  })
  return patches
}

function restoringPatches(patches, items) {
  const undo = emptyPatches()
  for (const kind of [ROW_FOLDER, ROW_REQUEST]) {
    const parentKey = PARENT_KEYS[kind]
    undo[kind] = patches[kind].map(({ id }) => {
      const original = items[kind].get(id)
      return { id, [parentKey]: original[parentKey] || ROOT_ID, sortOrder: cleanOrder(original.sortOrder) }
    })
  }
  return undo
}

const isEmpty = (patches) => patches[ROW_FOLDER].length === 0 && patches[ROW_REQUEST].length === 0

function mergePatches(lists) {
  const merged = emptyPatches()
  for (const patches of lists) {
    merged[ROW_FOLDER].push(...patches[ROW_FOLDER])
    merged[ROW_REQUEST].push(...patches[ROW_REQUEST])
  }
  return merged
}

export function sharingPatches({ folders, requests }) {
  const lookups = lookupsOf(folders, requests)
  const tree = buildCollectionTree(folders, requests)
  return mergePatches([...tree.siblings.keys()].map((containerId) => listPatches(containerId, siblingEntries(tree, containerId), lookups.items)))
}

export function sharedNumbering(state) {
  const patches = sharingPatches(state)
  const patched = (items, kind) => {
    const byId = new Map(patches[kind].map((patch) => [patch.id, patch]))
    return items.map((item) => ({ ...item, ...byId.get(item.id) }))
  }
  return { folders: patched(state.folders, ROW_FOLDER), requests: patched(state.requests, ROW_REQUEST) }
}

export function planMove({ folders, requests, sharedOrder }, source, target) {
  const lookups = lookupsOf(folders, requests)
  const subject = lookups.items[source.kind].get(source.id)
  const destination = subject && destinationOf(target, lookups)
  if (!destination || (destination.anchor && sameEntry(destination.anchor, source))) return null
  const tree = buildCollectionTree(folders, requests, sharedOrder)
  const { containerId } = destination
  if (source.kind === ROW_FOLDER) {
    if (isInside(containerId, source.id, lookups.parents) || !fitsDepth(tree, lookups.parents, source.id, containerId)) return null
  }
  const entries = insertEntry(siblingEntries(tree, containerId), entryOf(source), destination.anchor, destination.place)
  const patches = listPatches(containerId, entries, lookups.items)
  if (isEmpty(patches)) return null
  return { patches, undo: restoringPatches(patches, lookups.items), subject, containerId }
}

export function planStep(state, source, direction) {
  const lookups = lookupsOf(state.folders, state.requests)
  const subject = lookups.items[source.kind].get(source.id)
  if (!subject) return null
  const tree = buildCollectionTree(state.folders, state.requests, state.sharedOrder)
  const entries = siblingEntries(tree, lookups.containerOf(subject[PARENT_KEYS[source.kind]] || ROOT_ID))
  const index = entries.findIndex((entry) => sameEntry(entry, source))
  const neighbour = index < 0 ? null : entries[index + direction]
  if (!neighbour) return null
  return planMove(state, source, { ...neighbour, place: direction === STEP_UP ? PLACE_BEFORE : PLACE_AFTER })
}

export function canStep(state, source, direction) {
  return planStep(state, source, direction) !== null
}

function uniqueName(name, taken) {
  if (!taken.has(name)) return name
  const base = `${name} ${COPY_SUFFIX}`
  if (!taken.has(base)) return base
  for (let attempt = 2; ; attempt += 1) {
    const candidate = `${base} ${attempt}`
    if (!taken.has(candidate)) return candidate
  }
}

function cloneSubtree(tree, folder, parentId, newId, created) {
  const copy = { ...folder, id: newId(), parentId }
  created.folders.push(copy)
  for (const request of requestsIn(tree, folder.id)) {
    created.requests.push({ ...request, id: newId(), folderId: copy.id, timestamp: '' })
  }
  for (const child of foldersIn(tree, folder.id)) {
    if (created.folders.length + created.requests.length > MAX_CLONED_ITEMS) return
    cloneSubtree(tree, child, copy.id, newId, created)
  }
}

function clonedItems(tree, source, subject, containerId, name, newId) {
  if (source.kind === ROW_REQUEST) {
    return { folders: [], requests: [{ ...subject, id: newId(), folderId: containerId, name, timestamp: '' }] }
  }
  const created = { folders: [], requests: [] }
  cloneSubtree(tree, { ...subject, name }, containerId, newId, created)
  return created
}

export function planClone({ folders, requests, sharedOrder }, source, destination, newId) {
  const lookups = lookupsOf(folders, requests)
  const subject = lookups.items[source.kind].get(source.id)
  if (!subject) return null
  const tree = buildCollectionTree(folders, requests, sharedOrder)
  const containerId = lookups.containerOf(destination.containerId)
  if (source.kind === ROW_FOLDER && !fitsDepth(tree, lookups.parents, source.id, containerId)) return null
  const namesakes = listerFor(source.kind)(tree, containerId)
  const name = uniqueName(subject.name, new Set(namesakes.map((sibling) => sibling.name)))
  const created = clonedItems(tree, source, subject, containerId, name, newId)
  const root = source.kind === ROW_FOLDER ? created.folders[0] : created.requests[0]
  const entries = insertEntry(siblingEntries(tree, containerId), { kind: source.kind, id: root.id }, destination.anchor, PLACE_AFTER)
  const patches = listPatches(containerId, entries, lookups.items)
  const rootPatch = patches[source.kind].find((patch) => patch.id === root.id)
  Object.assign(root, { [PARENT_KEYS[source.kind]]: containerId, sortOrder: rootPatch.sortOrder })
  patches[source.kind] = patches[source.kind].filter((patch) => patch.id !== root.id)
  return { created, patches, root }
}

export function cloneDestination(state, source) {
  const lookups = lookupsOf(state.folders, state.requests)
  const subject = lookups.items[source.kind].get(source.id)
  if (!subject) return null
  return { containerId: lookups.containerOf(subject[PARENT_KEYS[source.kind]] || ROOT_ID), anchor: entryOf(source) }
}

export function pasteDestination(state, row) {
  const lookups = lookupsOf(state.folders, state.requests)
  if (!row) return { containerId: ROOT_ID, anchor: null }
  if (row.kind === ROW_FOLDER) return { containerId: lookups.containerOf(row.id), anchor: null }
  const request = lookups.items[ROW_REQUEST].get(row.id)
  if (!request) return { containerId: ROOT_ID, anchor: null }
  return { containerId: lookups.containerOf(request.folderId), anchor: { kind: ROW_REQUEST, id: request.id } }
}
