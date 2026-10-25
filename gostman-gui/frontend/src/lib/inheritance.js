import { NO_AUTH, NO_SCRIPTS, activeKinds, hasActiveContent, withoutFileContent } from './activeContent'
import { FOLDER_SETTINGS_TEXT as TEXT } from './folderSettingsText'
import { AUTH_OAUTH2, normalizeAuth } from './request'
import { parseRows } from './rows'
import { cleanOrder } from './sortOrder.js'
import { cleanColorChoice } from './swatches.js'
import { normalizeTags } from './tags.js'
import { folderChain } from './variableScopes'
import { collectionIdOf, holdsCollections, isCollectionRoot } from './environmentScope'

export const AUTH_INHERIT = 'inherit'
export const AUTH_NONE = 'none'
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
  scriptTimeoutMs: Math.max(0, Math.trunc(Number(raw?.scriptTimeoutMs)) || 0),
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
  ...(typeof raw.collectionVariables === 'string' && { collectionVariables: raw.collectionVariables }),
  ...(typeof raw.collectionVariablesMeta === 'string' && { collectionVariablesMeta: raw.collectionVariablesMeta }),
})

export function lineageOf(state, folderId) {
  const folders = folderChain(state.folders, folderId).map((folder) => ({
    id: folder.id,
    name: folder.name,
    settings: normalizeScopeSettings(folder),
  }))
  return [{ id: ROOT_SETTINGS_ID, name: rootSettingsName(state.workspaceStatus?.path), settings: normalizeScopeSettings(state.collectionSettings) }, ...folders]
}

const rootSettingsName = (workspacePath) => (holdsCollections(workspacePath) ? TEXT.allCollectionsName : TEXT.collectionName)

export const rootSettingsTitle = (workspacePath) => (holdsCollections(workspacePath) ? TEXT.allCollectionsTitle : TEXT.collectionTitle)

export function settingsTitle(state, folder) {
  if (!folder) return rootSettingsTitle(state.workspaceStatus.path)
  return isCollectionRoot(state.folders, folder.id, state.workspaceStatus.path) ? TEXT.collectionFolderTitle(folder.name) : TEXT.folderTitle(folder.name)
}

export const collectionSettingsTarget = (state, folderId) => (
  holdsCollections(state.workspaceStatus.path) ? collectionIdOf(state.folders, folderId) : ROOT_SETTINGS_ID
)

export const layersOf = (lineage) => lineage.map(({ settings }) => ({ headers: settings.headers, auth: settings.auth }))

export const HEADER_SENT = 'sent'
const HEADER_REPLACED = 'replaced'
const HEADER_OFF = 'off'

const lowerKey = (row) => row.key.trim().toLowerCase()

const namedRows = (rows) => rows.filter((row) => lowerKey(row) !== '')

function headerState(key, laterRows) {
  const later = laterRows.filter((row) => lowerKey(row) === key)
  if (later.length === 0) return HEADER_SENT
  return later.some((row) => row.enabled) ? HEADER_REPLACED : HEADER_OFF
}

export function inheritedHeaderRows(lineage, ownRows) {
  const layers = lineage.map(({ id, name, settings }) => ({ source: { id, name }, rows: namedRows(parseRows(settings.headers)) }))
  return layers.flatMap(({ source, rows }, index) => {
    const laterRows = [...layers.slice(index + 1).flatMap((layer) => layer.rows), ...namedRows(ownRows)]
    return rows.filter((row) => row.enabled).map((row) => ({ key: row.key, value: row.value, source, state: headerState(lowerKey(row), laterRows) }))
  })
}

export const countInheritedHeaders = (state, folderId, ownRows) => (
  inheritedHeaderRows(lineageOf(state, folderId), ownRows).filter((row) => row.state === HEADER_SENT).length
)

export const withInheritance = (state, request) => ({ ...request, inherited: layersOf(lineageOf(state, request.folderId)) })

const setsAuth = ({ settings }) => settings.auth.type !== '' && settings.auth.type !== AUTH_INHERIT

export const inheritedAuthSource = (auth, lineage) => (
  auth.type === AUTH_INHERIT ? [...lineage].reverse().find(setsAuth) || null : null
)

export const inheritedAuthLayer = (state, folderId) => inheritedAuthSource({ type: AUTH_INHERIT }, lineageOf(state, folderId))

export function updatedScope(state, folderId, patch) {
  if (folderId === ROOT_SETTINGS_ID) return { collectionSettings: { ...state.collectionSettings, ...patch } }
  return { folders: state.folders.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder)) }
}

export const isBlankScope = (settings) => JSON.stringify(normalizeScopeSettings(settings)) === JSON.stringify(normalizeScopeSettings())

export const hasActiveSettings =(raw) => hasActiveContent(normalizeScopeSettings(raw))

export const activeSettingsKinds = (raw) => activeKinds(normalizeScopeSettings(raw))

export function withoutActiveSettings(raw) {
  const settings = withoutFileContent(normalizeScopeSettings(raw))
  return { ...raw, ...settings, ...NO_SCRIPTS, auth: settings.auth.type === AUTH_OAUTH2 ? normalizeAuth(NO_AUTH) : settings.auth }
}
