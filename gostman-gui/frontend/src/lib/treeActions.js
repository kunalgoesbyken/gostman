import { ROOT_ID, ROW_FOLDER, ROW_REQUEST } from './collectionTree'
import { PLACE_INSIDE } from './dropPlace'
import { normalizeRequest } from './request'
import { TREE_TEXT } from './treeText'
import { TARGET_ROOT, cloneDestination, pasteDestination, planClone, planMove, planStep } from './treeMoves'
import { useAppStore } from '../store/appStore'

const store = () => useAppStore.getState()
const snapshot = () => ({ folders: store().folders, requests: store().requests })
const newId = () => crypto.randomUUID()
const newFolderId = () => `folder-${crypto.randomUUID()}`

const targetFor = (folderId) => (
  folderId === ROOT_ID ? { kind: TARGET_ROOT } : { kind: ROW_FOLDER, id: folderId, place: PLACE_INSIDE }
)

const idFactoryFor = (kind) => (kind === ROW_FOLDER ? newFolderId : newId)

export function createTreeActions(backend, attempt) {
  async function applyPatches(patches) {
    const changed = patches[ROW_REQUEST]
    if (patches[ROW_FOLDER].length > 0) store().patchFolders(patches[ROW_FOLDER])
    if (changed.length === 0) return
    const byId = new Map(store().requests.map((request) => [request.id, request]))
    const updated = changed.filter((patch) => byId.has(patch.id)).map((patch) => normalizeRequest({ ...byId.get(patch.id), ...patch }))
    store().upsertRequests(await backend.saveRequests(updated))
    changed.forEach(({ id, folderId, sortOrder }) => store().patchOpenRequest(id, { folderId, sortOrder }))
  }

  const offerUndo = (message, revert) => {
    const undo = attempt(TREE_TEXT.undoFailed, async () => {
      await revert()
      store().dismissNotice()
    })
    store().showNotice(message, undo)
  }

  const moveItem = attempt(TREE_TEXT.moveFailed, async (source, target) => {
    const plan = planMove(snapshot(), source, target)
    if (!plan) return
    await applyPatches(plan.patches)
    offerUndo(TREE_TEXT.moved(plan.subject.name), () => applyPatches(plan.undo))
  })

  const stepItem = attempt(TREE_TEXT.moveFailed, async (source, direction) => {
    const plan = planStep(snapshot(), source, direction)
    if (!plan) return
    await applyPatches(plan.patches)
    offerUndo(TREE_TEXT.moved(plan.subject.name), () => applyPatches(plan.undo))
  })

  const canStep = (source, direction) => planStep(snapshot(), source, direction) !== null

  const moveToFolder = (source, folderId) => moveItem(source, targetFor(folderId))

  async function discard(created) {
    for (const request of created.requests) await backend.deleteRequest(request.id)
    store().removeRequests(created.requests.map((request) => request.id))
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
    const plan = planClone(snapshot(), source, destination, idFactoryFor(source.kind))
    if (!plan) return
    await persistClone(plan)
    offerUndo(label(plan.root.name), () => discard(plan.created))
  }

  const duplicateItem = attempt(TREE_TEXT.cloneFailed, (source) => {
    const destination = cloneDestination(snapshot(), source)
    return destination && cloneInto(source, destination, TREE_TEXT.duplicated)
  })

  const copyItem = (source) => store().setTreeClipboard(source)

  const pasteItem = attempt(TREE_TEXT.cloneFailed, (row) => {
    const clip = store().treeClipboard
    if (!clip) return undefined
    const destination = pasteDestination(snapshot(), clip, row)
    return cloneInto(clip, destination, TREE_TEXT.pasted)
  })

  return { moveItem, stepItem, canStep, moveToFolder, duplicateItem, copyItem, pasteItem }
}
