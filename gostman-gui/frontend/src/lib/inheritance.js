import { NO_AUTH, NO_SCRIPTS, hasActiveContent, withoutFileContent } from './activeContent'
import { FOLDER_SETTINGS_TEXT as TEXT } from './folderSettingsText'
import { AUTH_OAUTH2, normalizeAuth } from './request'
import { parseRows, countSentRows } from './rows'
import { cleanOrder } from './sortOrder.js'
import { cleanColorChoice } from './swatches.js'
import { normalizeTags } from './tags.js'
import { folderChain } from './variableScopes'

export const AUTH_INHERIT = 'inherit'
export const ROOT_SETTINGS_ID = ''
export const EMPTY_ROWS = '{}'

const textOf = (value) => (typeof value === 'string' ? value : '')

export const normalizeScopeSettings = (raw) => ({
  description: textOf(raw?.description),
  headers: textOf(raw?.headers) || EMPTY_ROWS,
  auth: normalizeAuth(raw?.auth?.type ? raw.auth : undefined),
  preScript: textOf(raw?.preScript),
  postScript: textOf(raw?.postScript),
  assertions: textOf(raw?.assertions),
})

export const normalizeFolder = (raw) => ({
  id: raw.id,
  name: raw.name,
  isOpen: Boolean(raw.isOpen),
  parentId: raw.parentId || '',
  sortOrder: cleanOrder(raw.sortOrder),
  variables: textOf(raw.variables) || EMPTY_ROWS,
  color: cleanColorChoice(raw.color),
  tags: normalizeTags(raw.tags),
  ...normalizeScopeSettings(raw),
})

export function lineageOf(state, folderId) {
  const folders = folderChain(state.folders, folderId).map((folder) => ({
    id: folder.id,
    name: folder.name,
    settings: normalizeScopeSettings(folder),
  }))
  return [{ id: ROOT_SETTINGS_ID, name: TEXT.collectionName, settings: normalizeScopeSettings(state.collectionSettings) }, ...folders]
}

export const layersOf = (lineage) => lineage.map(({ settings }) => ({ headers: settings.headers, auth: settings.auth }))

export const countInheritedHeaders = (state, folderId) => (
  lineageOf(state, folderId).reduce((total, { settings }) => total + countSentRows(parseRows(settings.headers)), 0)
)

export const withInheritance = (state, request) => ({ ...request, inherited: layersOf(lineageOf(state, request.folderId)) })

const setsAuth = ({ settings }) => settings.auth.type !== '' && settings.auth.type !== AUTH_INHERIT

export const inheritedAuthSource = (auth, lineage) => (
  auth.type === AUTH_INHERIT ? [...lineage].reverse().find(setsAuth) || null : null
)

export function updatedScope(state, folderId, patch) {
  if (folderId === ROOT_SETTINGS_ID) return { collectionSettings: { ...state.collectionSettings, ...patch } }
  return { folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder)) }
}

export const isBlankScope = (settings) => JSON.stringify(normalizeScopeSettings(settings)) === JSON.stringify(normalizeScopeSettings())

export const hasActiveSettings =(raw) => hasActiveContent(normalizeScopeSettings(raw))

export function withoutActiveSettings(raw) {
  const settings = withoutFileContent(normalizeScopeSettings(raw))
  return { ...raw, ...settings, ...NO_SCRIPTS, auth: settings.auth.type === AUTH_OAUTH2 ? normalizeAuth(NO_AUTH) : settings.auth }
}
