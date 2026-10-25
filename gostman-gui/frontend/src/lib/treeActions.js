import { ROOT_ID, ROW_FOLDER, ROW_REQUEST } from './collectionTree'
import { PLACE_AFTER, PLACE_INSIDE } from './dropPlace'
import { normalizeRequest } from './request'
import { TREE_TEXT } from './treeText'
import { TARGET_ROOT, cloneDestination, pasteDestination, planClone, planMove, planStep, sharingPatches } from './treeMoves'
import { useAppStore } from '../store/appStore'

const store = () => useAppStore.getState()
const snapshot = () => ({ folders: store().folders, requests: store().requests, sharedOrder: store().sharedOrder })
const newId = () => crypto.randomUUID()
const newFolderId = () => `folder-${crypto.randomUUID()}`

const targetFor = (folderId) => (
  folderId === ROOT_ID ? { kind: TARGET_ROOT } : { kind: ROW_FOLDER, id: folderId, place: PLACE_INSIDE }
)

const idFactoryFor = (kind) => (kind === ROW_FOLDER ? newFolderId : newId)

const HISTORY_LIMIT = 50

const pasteTarget = ({ containerId, anchor }) => (anchor ? { ...anchor, place: PLACE_AFTER } : targetFor(containerId))

export function createTreeActions(backend, attempt) {
  const history = { done: [], undone: [] }

  async function applyPatches(patches) {
    const changed = patches[ROW_REQUEST]
    if (patches[ROW_FOLDER].length > 0) store().patchFolders(patches[ROW_FOLDER])
    if (changed.length === 0) return
    const byId = new Map(store().requests.map((request) => [request.id, request]))
    const updated = changed.filter((patch) => byId.has(patch.id)).map((patch) => normalizeRequest({ ...byId.get(patch.id), ...patch }))
    store().upsertRequests(await backend.saveRequests(updated))
    changed.forEach(({ id, folderId, sortOrder }) => store().patchOpenRequest(id, { folderId, sortOrder }))
  }

  async function shareOrder() {
    if (store().sharedOrder) return
    await applyPatches(sharingPatches(snapshot()))
    await backend.saveFolders(store().folders)
    await backend.shareOrder()
    store().markSharedOrder()
  }

  async function planShared(planner) {
    if (!planner(snapshot())) return null
    await shareOrder()
    return planner(snapshot())
  }

  const undoLatest = attempt(TREE_TEXT.undoFailed, async () => {
    const step = history.done.pop()
    if (!step) return
    await step.undo()
    history.undone.push(step)
    store().dismissNotice()
  })

  const redoLatest = attempt(TREE_TEXT.redoFailed, async () => {
    const step = history.undone.pop()
    if (!step) return
    await step.redo()
    history.done.push(step)
    store().showNotice(step.message, undoLatest)
  })

  function record(step) {
    history.done = [...history.done.slice(1 - HISTORY_LIMIT), step]
    history.undone = []
    store().showNotice(step.message, undoLatest)
  }

  async function relocate(planner) {
    const plan = await planShared(planner)
    if (!plan) return false
    await applyPatches(plan.patches)
    record({ message: TREE_TEXT.moved(plan.subject.name), undo: () => applyPatches(plan.undo), redo: () => applyPatches(plan.patches) })
    return true
  }

  const isAppending = (target) => target.kind === TARGET_ROOT || target.place === PLACE_INSIDE

  async function relocateAll(sources, target) {
    const plans = []
    let next = target
    for (const source of sources) {
      const plan = await planShared((state) => planMove(state, source, next))
      if (!plan) continue
      await applyPatches(plan.patches)
      plans.push(plan)
      if (!isAppending(target)) next = { ...source, place: PLACE_AFTER }
    }
    if (plans.length === 0) return false
    const message = plans.length === 1 ? TREE_TEXT.moved(plans[0].subject.name) : TREE_TEXT.movedMany(plans.length)
    const undo = async () => {
      for (const plan of [...plans].reverse()) await applyPatches(plan.undo)
    }
    const redo = async () => {
      for (const plan of plans) await applyPatches(plan.patches)
    }
    record({ message, undo, redo })
    return true
  }

  const moveItem = attempt(TREE_TEXT.moveFailed, (source, target) => relocate((state) => planMove(state, source, target)))

  const stepItem = attempt(TREE_TEXT.moveFailed, (source, direction) => relocate((state) => planStep(state, source, direction)))

  const canStep = (source, direction) => planStep(snapshot(), source, direction) !== null

  const moveToFolder = (source, folderId) => moveItem(source, targetFor(folderId))

  const moveItems = attempt(TREE_TEXT.moveFailed, (sources, target) => relocateAll(sources, target))

  const moveItemsToFolder = (sources, folderId) => moveItems(sources, targetFor(folderId))

  async function discard(created) {
    const ids = created.requests.map((request) => request.id)
    if (ids.length > 0) await backend.deleteRequests(ids)
    store().removeRequests(ids)
    store().removeFolders(created.folders.map((folder) => folder.id))
  }

  async function persistClone({ created, patches }) {
    store().addFolders(created.folders)
    store().patchFolders(patches[ROW_FOLDER])
    if (created.folders.length > 0) await backend.saveFolders(store().folders)
    if (created.requests.length > 0) store().upsertRequests(await backend.saveRequests(created.requests.map(normalizeRequest)))
    await applyPatches(patches)
  }

  async function cloneInto(source, destination, label) {
    const plan = await planShared((state) => planClone(state, source, destination, idFactoryFor(source.kind)))
    if (!plan) return
    await persistClone(plan)
    record({ message: label(plan.root.name), undo: () => discard(plan.created), redo: () => persistClone(plan) })
  }

  const duplicateItem = attempt(TREE_TEXT.cloneFailed, (source) => {
    const destination = cloneDestination(snapshot(), source)
    return destination && cloneInto(source, destination, TREE_TEXT.duplicated)
  })

  const copyItem = (source) => store().setTreeClipboard(source)

  const cutItem = (source) => store().setTreeClipboard({ ...source, cut: true })

  const pasteCopy = attempt(TREE_TEXT.cloneFailed, (clip, row) => cloneInto(clip, pasteDestination(snapshot(), row), TREE_TEXT.pasted))

  const pasteCut = attempt(TREE_TEXT.moveFailed, async (clip, row) => {
    const moved = await relocate((state) => planMove(state, clip, pasteTarget(pasteDestination(state, row))))
    if (moved) store().setTreeClipboard(null)
  })

  const pasteItem = (row) => {
    const clip = store().treeClipboard
    if (!clip) return undefined
    return clip.cut ? pasteCut(clip, row) : pasteCopy(clip, row)
  }

  return { moveItem, moveItems, moveItemsToFolder, stepItem, canStep, moveToFolder, duplicateItem, copyItem, cutItem, pasteItem, undo: undoLatest, redo: redoLatest, shareOrder }
}
