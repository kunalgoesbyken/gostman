import { isPlainObject, parseJSON } from './dataUtils'

const SHARED = ''

export const holdsCollections = (workspacePath) => workspacePath === ''

const asShared = (environment) => ({ ...environment, folderId: SHARED })

const byIdOf = (folders) => new Map(folders.map((folder) => [folder.id, folder]))

function folderIdsUp(byId, folderId) {
  const chain = []
  for (let folder = byId.get(folderId); folder && !chain.includes(folder.id); folder = byId.get(folder.parentId)) chain.push(folder.id)
  return chain
}

const scopeOf = (environment, byId) => (environment.folderId && byId.has(environment.folderId) ? environment.folderId : SHARED)

export const isScoped = (environment, folders) => scopeOf(environment, byIdOf(folders)) !== SHARED

export const isSameScope = (first, second, folders) => {
  const byId = byIdOf(folders)
  return scopeOf(first, byId) === scopeOf(second, byId)
}

export const collectionIdOf = (folders, folderId) => folderIdsUp(byIdOf(folders), folderId).at(-1) || SHARED

export const isCollectionRoot = (folders, folderId, workspacePath) => (
  holdsCollections(workspacePath) && Boolean(folderId) && collectionIdOf(folders, folderId) === folderId
)

export function offeredEnvironments(environments, folders, folderId) {
  const byId = byIdOf(folders)
  const chain = folderIdsUp(byId, folderId)
  return {
    collectionId: chain[chain.length - 1] || SHARED,
    own: environments.filter((environment) => chain.includes(scopeOf(environment, byId))),
    shared: environments.filter((environment) => scopeOf(environment, byId) === SHARED),
  }
}

const findById = (environments, id) => (id ? environments.find((environment) => environment.id === id) : undefined)

export function chosenEnvironment(state, folderId) {
  const { collectionId, own, shared } = offeredEnvironments(state.environments, state.folders, folderId)
  if (own.length > 0) return findById([...own, ...shared], state.environmentChoices?.[collectionId]) || own[0]
  return findById(shared, state.activeEnvironmentId) || shared[0]
}

export function choiceFor(state, folderId, environmentId) {
  const { collectionId, own, shared } = offeredEnvironments(state.environments, state.folders, folderId)
  if (!findById([...own, ...shared], environmentId)) return {}
  if (own.length === 0) return { activeEnvironmentId: environmentId }
  return { environmentChoices: { ...state.environmentChoices, [collectionId]: environmentId } }
}

export const scopeForNew = (environments, folders, folderId) => {
  const { collectionId, own } = offeredEnvironments(environments, folders, folderId)
  return own.length > 0 ? collectionId : SHARED
}

export function environmentGroups(environments, folders, folderId) {
  const byId = byIdOf(folders)
  const { collectionId, own, shared } = offeredEnvironments(environments, folders, folderId)
  const listed = new Set([...own, ...shared])
  const others = new Map()
  for (const environment of environments.filter((candidate) => !listed.has(candidate))) {
    const scope = scopeOf(environment, byId)
    others.set(scope, [...(others.get(scope) || []), environment])
  }
  const named = (id, members) => ({ id, name: byId.get(id)?.name || '', environments: members })
  return [
    ...(collectionId ? [named(collectionId, own)] : []),
    { id: SHARED, name: '', environments: shared },
    ...Array.from(others, ([id, members]) => named(id, members)),
  ]
}

export function environmentsForShare(environments, folders, selectedFolders) {
  const byId = byIdOf(folders)
  const kept = new Set(selectedFolders.map((folder) => folder.id))
  const root = selectedFolders.find((folder) => !kept.has(folder.parentId))
  const above = root ? folderIdsUp(byId, root.id) : []
  return environments.flatMap((environment) => {
    const scope = scopeOf(environment, byId)
    if (scope === SHARED || kept.has(scope)) return [environment]
    return above.includes(scope) ? [{ ...environment, folderId: root.id }] : []
  })
}

export const ownsCollectionVariables = (folder) => typeof folder?.collectionVariables === 'string'

const withoutCollectionVariables = ({ collectionVariables, collectionVariablesMeta, ...folder }) => folder

const variablesOf = (folder) => {
  const parsed = parseJSON(folder.collectionVariables || '{}', null)
  return isPlainObject(parsed) ? parsed : {}
}

export function variableHolders(folders, folderId) {
  const byId = byIdOf(folders)
  return folderIdsUp(byId, folderId).map((id) => byId.get(id)).filter(ownsCollectionVariables).reverse()
}

export const variableHolderFor = (folders, folderId) => variableHolders(folders, folderId).at(-1)

const ownedVariableNames = (folders) => new Set(folders.filter(ownsCollectionVariables).flatMap((folder) => Object.keys(variablesOf(folder))))

export function foldersForShare(folders, selectedFolders, shared = {}) {
  const kept = new Set(selectedFolders.map((folder) => folder.id))
  const root = selectedFolders.find((folder) => !kept.has(folder.parentId))
  const above = root ? variableHolders(folders, root.id).filter((folder) => folder.id !== root.id) : []
  if (above.length === 0 && Object.keys(shared).length === 0) return selectedFolders
  const carried = Object.assign({}, shared, ...above.map(variablesOf), ownsCollectionVariables(root) ? variablesOf(root) : {})
  return selectedFolders.map((folder) => (folder === root ? { ...folder, collectionVariables: JSON.stringify(carried, null, 2) } : folder))
}

const withoutNames = (values, names) => Object.fromEntries(Object.entries(values).filter(([name]) => !names.has(name)))

const marksOf = (meta) => {
  const parsed = parseJSON(meta || '{}', null)
  return isPlainObject(parsed) ? parsed : {}
}

function withOwnedVariables(data) {
  const owners = data.folders.filter(ownsCollectionVariables).reverse()
  const ownedMarks = Object.assign({}, ...owners.map((folder) => marksOf(folder.collectionVariablesMeta)))
  return {
    variables: Object.assign({}, ...owners.map(variablesOf), data.variables),
    variablesMeta: JSON.stringify({ ...ownedMarks, ...marksOf(data.variablesMeta) }),
  }
}

export function scopedImport(data, workspacePath) {
  if (!holdsCollections(workspacePath)) {
    return { ...data, ...withOwnedVariables(data), folders: data.folders.map(withoutCollectionVariables), environments: data.environments.map(asShared) }
  }
  return { ...data, variables: withoutNames(data.variables, ownedVariableNames(data.folders)) }
}

export function scopedFolderNames(data) {
  const holding = new Set(data.environments.map((environment) => environment.folderId).filter(Boolean))
  const namesOf = (holds) => data.folders.filter(holds).map((folder) => folder.name)
  return {
    environments: namesOf((folder) => holding.has(folder.id)),
    variables: namesOf((folder) => Object.keys(variablesOf(folder)).length > 0),
  }
}

export function collectionFolders(folders) {
  const byId = byIdOf(folders)
  return folders.filter((folder) => !byId.has(folder.parentId))
}
