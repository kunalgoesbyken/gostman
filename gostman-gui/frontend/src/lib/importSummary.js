import { isPlainObject } from './dataUtils'
import { collectionFolders, ownedVariableCount } from './environmentScope'
import { isBlankScope } from './inheritance'

const listOf = (value) => (Array.isArray(value) ? value : [])

const withSettings = (folders) => folders.filter((folder) => !isBlankScope(folder)).length

export function countImported(data) {
  const folders = listOf(data.folders)
  const collections = collectionFolders(folders)
  const inner = folders.filter((folder) => !collections.includes(folder))
  return {
    collections: collections.length,
    folders: inner.length,
    requests: listOf(data.requests).length,
    environments: listOf(data.environments).length,
    globals: listOf(data.globals).length,
    variables: (isPlainObject(data.variables) ? Object.keys(data.variables).length : 0) + ownedVariableCount(folders),
    collectionSettings: withSettings(collections),
    folderSettings: withSettings(inner),
  }
}
