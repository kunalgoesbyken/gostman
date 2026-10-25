import { ROOT_ID } from './collectionTree'
import { holdsCollections } from './environmentScope'
import { IMPORT_RESULT_TEXT as TEXT } from './importText'
import { remark } from './importRemarks'
import { AUTH_NONE, isBlankScope, normalizeFolder, normalizeScopeSettings } from './inheritance'

const FIRST_PLACE = 1

const atRoot = (parentId) => (parentId || ROOT_ID) === ROOT_ID

const asCollectionSettings = (raw) => {
  const settings = normalizeScopeSettings(raw)
  return settings.auth.type === AUTH_NONE ? { ...settings, auth: { ...settings.auth, type: '' } } : settings
}

function attached(data, collections, settings) {
  const chosen = new Set(collections)
  return {
    parts: { folders: data.folders.map((folder) => (chosen.has(folder) ? { ...folder, ...settings } : folder)) },
    note: TEXT.settingsAttached(collections.map((folder) => folder.name)),
  }
}

function wrapped(data, settings) {
  const holder = normalizeFolder({ ...settings, id: crypto.randomUUID(), name: TEXT.importedCollectionName, isOpen: true, sortOrder: FIRST_PLACE })
  return {
    parts: {
      folders: [holder, ...data.folders.map((folder) => (atRoot(folder.parentId) ? { ...folder, parentId: holder.id } : folder))],
      requests: data.requests.map((request) => (atRoot(request.folderId) ? { ...request, folderId: holder.id } : request)),
    },
    note: TEXT.settingsWrapped(holder.name),
  }
}

const fitsEachCollection = (data, collections) => (
  collections.length > 0 && collections.every(isBlankScope) && !data.requests.some((request) => atRoot(request.folderId))
)

export function withImportedSettings(data, workspacePath) {
  if (!holdsCollections(workspacePath) || isBlankScope(data.settings)) return data
  const settings = asCollectionSettings(data.settings)
  const collections = data.folders.filter((folder) => atRoot(folder.parentId))
  const { parts, note } = fitsEachCollection(data, collections) ? attached(data, collections, settings) : wrapped(data, settings)
  return { ...data, ...parts, settings: normalizeScopeSettings(), remarks: [...data.remarks, remark(note)] }
}
