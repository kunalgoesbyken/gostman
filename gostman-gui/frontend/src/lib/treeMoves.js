import { MAX_FOLDER_DEPTH, ROOT_ID, ROW_FOLDER, ROW_REQUEST, buildCollectionTree, folderDepth, foldersIn, requestsIn } from './collectionTree.js'
import { PLACE_AFTER, PLACE_BEFORE, PLACE_INSIDE } from './dropPlace.js'
import { cleanOrder } from './sortOrder.js'

export const TARGET_ROOT = 'root'

export const STEP_UP = -1
export const STEP_DOWN = 1

const MAX_CLONED_ITEMS = 5000
const COPY_SUFFIX = 'copy'

const PARENT_KEYS = { [ROW_FOLDER]: 'parentId', [ROW_REQUEST]: 'folderId' }

const listerFor = (kind) => (kind === ROW_FOLDER ? foldersIn : requestsIn)

const idsOf = (items) => items.map((item) => item.id)

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

function insertIds(ids, movedId, anchorId, place) {
  const rest = ids.filter((id) => id !== movedId)
  const anchorIndex = anchorId ? rest.indexOf(anchorId) : -1
  if (anchorIndex < 0) return [...rest, movedId]
  const at = place === PLACE_BEFORE ? anchorIndex : anchorIndex + 1
  return [...rest.slice(0, at), movedId, ...rest.slice(at)]
}

function destinationOf(source, target, lookups) {
  if (target.kind === TARGET_ROOT) return { containerId: ROOT_ID, anchorId: '', place: PLACE_AFTER }
  if (target.kind === ROW_FOLDER) {
    const folder = lookups.items[ROW_FOLDER].get(target.id)
    if (!folder) return null
    if (source.kind === ROW_REQUEST || target.place === PLACE_INSIDE) return { containerId: target.id, anchorId: '', place: PLACE_AFTER }
    return { containerId: lookups.containerOf(folder.parentId || ROOT_ID), anchorId: target.id, place: target.place }
  }
  const request = lookups.items[ROW_REQUEST].get(target.id)
  if (!request || source.kind !== ROW_REQUEST) return null
  return { containerId: lookups.containerOf(request.folderId), anchorId: target.id, place: target.place }
}

const emptyPatches = () => ({ [ROW_FOLDER]: [], [ROW_REQUEST]: [] })

function listPatches(lists, items) {
  const patches = emptyPatches()
  for (const { kind, containerId, ids } of lists) {
    const parentKey = PARENT_KEYS[kind]
    ids.forEach((id, index) => {
      const current = items[kind].get(id)
      const sortOrder = index + 1
      if (current && (current[parentKey] || ROOT_ID) === containerId && cleanOrder(current.sortOrder) === sortOrder) return
      patches[kind].push({ id, [parentKey]: containerId, sortOrder })
    })
  }
  return patches
}

function applyToLookups(items, patches) {
  const applied = {}
  for (const kind of [ROW_FOLDER, ROW_REQUEST]) {
    const byId = new Map(items[kind])
    for (const patch of patches[kind]) byId.set(patch.id, { ...byId.get(patch.id), ...patch })
    applied[kind] = byId
  }
  return applied
}

const isEmpty = (patches) => patches[ROW_FOLDER].length === 0 && patches[ROW_REQUEST].length === 0

function currentList(tree, kind, containerId) {
  return { kind, containerId, ids: idsOf(listerFor(kind)(tree, containerId)) }
}

export function planMove({ folders, requests }, source, target) {
  const lookups = lookupsOf(folders, requests)
  const subject = lookups.items[source.kind].get(source.id)
  const destination = subject && destinationOf(source, target, lookups)
  if (!destination) return null
  const tree = buildCollectionTree(folders, requests)
  const { containerId } = destination
  if (source.kind === ROW_FOLDER) {
    if (isInside(containerId, source.id, lookups.parents) || !fitsDepth(tree, lookups.parents, source.id, containerId)) return null
  }
  const origin = lookups.containerOf(subject[PARENT_KEYS[source.kind]] || ROOT_ID)
  const arrival = currentList(tree, source.kind, containerId)
  const arranged = { ...arrival, ids: insertIds(arrival.ids, source.id, destination.anchorId, destination.place) }
  const patches = listPatches([arranged], lookups.items)
  if (isEmpty(patches)) return null
  const before = origin === containerId ? [arrival] : [currentList(tree, source.kind, origin), arrival]
  const undo = listPatches(before, applyToLookups(lookups.items, patches))
  return { patches, undo, subject, containerId }
}

export function planStep(state, source, direction) {
  const lookups = lookupsOf(state.folders, state.requests)
  const subject = lookups.items[source.kind].get(source.id)
  if (!subject) return null
  const tree = buildCollectionTree(state.folders, state.requests)
  const containerId = lookups.containerOf(subject[PARENT_KEYS[source.kind]] || ROOT_ID)
  const ids = currentList(tree, source.kind, containerId).ids
  const neighbour = ids[ids.indexOf(source.id) + direction]
  if (!neighbour) return null
  return planMove(state, source, { kind: source.kind, id: neighbour, place: direction === STEP_UP ? PLACE_BEFORE : PLACE_AFTER })
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

export function planClone({ folders, requests }, source, destination, newId) {
  const lookups = lookupsOf(folders, requests)
  const subject = lookups.items[source.kind].get(source.id)
  if (!subject) return null
  const tree = buildCollectionTree(folders, requests)
  const containerId = lookups.containerOf(destination.containerId)
  if (source.kind === ROW_FOLDER && !fitsDepth(tree, lookups.parents, source.id, containerId)) return null
  const siblings = listerFor(source.kind)(tree, containerId)
  const name = uniqueName(subject.name, new Set(siblings.map((sibling) => sibling.name)))
  const created = clonedItems(tree, source, subject, containerId, name, newId)
  const root = source.kind === ROW_FOLDER ? created.folders[0] : created.requests[0]
  const ids = insertIds(idsOf(siblings), root.id, destination.anchorId || '', PLACE_AFTER)
  const patches = listPatches([{ kind: source.kind, containerId, ids }], lookups.items)
  const rootPatch = patches[source.kind].find((patch) => patch.id === root.id)
  Object.assign(root, { [PARENT_KEYS[source.kind]]: containerId, sortOrder: rootPatch ? rootPatch.sortOrder : ids.indexOf(root.id) + 1 })
  patches[source.kind] = patches[source.kind].filter((patch) => patch.id !== root.id)
  return { created, patches, root }
}

export function cloneDestination(state, source) {
  const lookups = lookupsOf(state.folders, state.requests)
  const subject = lookups.items[source.kind].get(source.id)
  if (!subject) return null
  return { containerId: lookups.containerOf(subject[PARENT_KEYS[source.kind]] || ROOT_ID), anchorId: source.id }
}

export function pasteDestination(state, clip, row) {
  const lookups = lookupsOf(state.folders, state.requests)
  if (!row) return { containerId: ROOT_ID, anchorId: '' }
  if (row.kind === ROW_FOLDER) return { containerId: lookups.containerOf(row.id), anchorId: '' }
  const request = lookups.items[ROW_REQUEST].get(row.id)
  if (!request) return { containerId: ROOT_ID, anchorId: '' }
  const containerId = lookups.containerOf(request.folderId)
  return { containerId, anchorId: clip.kind === ROW_REQUEST ? request.id : '' }
}
