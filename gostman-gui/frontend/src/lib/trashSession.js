import { create } from 'zustand'
import { DIALOG_TEXT } from './dialogText'
import { normalizeRequest } from './request'
import {
  KIND_ENVIRONMENT, KIND_FOLDER, KIND_REQUEST, createEntry, parseTrash, pruned, serializeTrash,
} from './trash'
import { TRASH_TEXT as TEXT } from './trashText'
import { foldersWithoutSecrets, withoutSecretValues } from './variableScopes'
import { useAppStore } from '../store/appStore'

const INITIAL_STATE = { isOpen: false, entries: [], storage: null }

export const useTrashStore = create(() => INITIAL_STATE)

const trash = () => useTrashStore.getState()
const patch = (changes) => useTrashStore.setState(changes)
const app = () => useAppStore.getState()
const messageOf = (error) => error?.message || String(error)

const warn = (message) => app().showAlert(TEXT.title, message, DIALOG_TEXT.ok, 'warning')

async function readEntries() {
  return pruned(parseTrash(await trash().storage.read()), Date.now())
}

async function writeEntries(entries) {
  await trash().storage.write(serializeTrash(entries))
  patch({ entries })
}

const withFreshId = (item, taken) => (taken.some((candidate) => candidate.id === item.id) ? { ...item, id: crypto.randomUUID() } : item)

const existingFolderId = (folderId) => (app().folders.some((folder) => folder.id === folderId) ? folderId : '')

async function restoreRequest(backend, item) {
  const request = withFreshId({ ...item, folderId: existingFolderId(item.folderId) }, app().requests)
  app().upsertRequest(await backend.saveRequest(normalizeRequest(request)))
}

async function restoreFolder(backend, { item, childRequestIds, childFolderIds }) {
  const parentId = existingFolderId(item.parentId)
  const folder = withFreshId({ ...item, parentId }, app().folders)
  app().addFolders([folder])
  const adopted = app().requests.filter((request) => childRequestIds.includes(request.id) && (request.folderId || '') === parentId)
  if (adopted.length > 0) app().upsertRequests(await backend.saveRequests(adopted.map((request) => ({ ...request, folderId: folder.id }))))
  const adoptedFolders = app().folders.filter((candidate) => childFolderIds.includes(candidate.id) && (candidate.parentId || '') === parentId && candidate.id !== folder.id)
  app().patchFolders(adoptedFolders.map((candidate) => ({ id: candidate.id, parentId: folder.id })))
}

function restoreEnvironment({ item, scope }) {
  const list = scope === 'global' ? app().globalEnvironments : app().environments
  app().addEnvironmentTo(scope, withFreshId(item, list))
}

async function keep(entry) {
  try {
    await writeEntries(pruned([...(await readEntries()), entry], Date.now()))
  } catch (error) {
    warn(TEXT.saveFailed(messageOf(error)))
  }
}

export const keepRequest = (request) => keep(createEntry(KIND_REQUEST, request, {}, Date.now()))

export function keepFolder(folder) {
  const { requests, folders } = app()
  const childRequestIds = requests.filter((request) => request.folderId === folder.id).map((request) => request.id)
  const childFolderIds = folders.filter((candidate) => candidate.parentId === folder.id).map((candidate) => candidate.id)
  return keep(createEntry(KIND_FOLDER, foldersWithoutSecrets([folder])[0], { childRequestIds, childFolderIds }, Date.now()))
}

export const keepEnvironment = (scope, environment) => keep(createEntry(KIND_ENVIRONMENT, withoutSecretValues([environment])[0], { scope }, Date.now()))

export function createTrashActions(backend) {
  patch({ storage: backend.trash })

  const restorers = {
    [KIND_REQUEST]: (entry) => restoreRequest(backend, entry.item),
    [KIND_FOLDER]: (entry) => restoreFolder(backend, entry),
    [KIND_ENVIRONMENT]: restoreEnvironment,
  }

  return {
    open: async () => {
      patch({ isOpen: true })
      try {
        await writeEntries(await readEntries())
      } catch (error) {
        warn(TEXT.readFailed(messageOf(error)))
      }
    },
    close: () => patch({ isOpen: false }),
    restore: async (id) => {
      const entry = trash().entries.find((candidate) => candidate.id === id)
      if (!entry) return
      try {
        await restorers[entry.kind](entry)
        await writeEntries(trash().entries.filter((candidate) => candidate.id !== id))
        app().showNotice(TEXT.restored(entry.name || TEXT.unnamed))
      } catch (error) {
        warn(TEXT.restoreFailed(messageOf(error)))
      }
    },
    purge: (id) => writeEntries(trash().entries.filter((entry) => entry.id !== id)).catch((error) => warn(TEXT.saveFailed(messageOf(error)))),
    empty: () => app().showConfirm(
      TEXT.emptyBinTitle,
      TEXT.emptyBinMessage,
      () => writeEntries([]).catch((error) => warn(TEXT.saveFailed(messageOf(error)))),
      null,
      'destructive',
      TEXT.emptyBinConfirm,
    ),
    purgeExpired: () => readEntries().then(writeEntries).catch(() => {}),
  }
}
