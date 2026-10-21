import { isPlainObject } from './dataUtils'
import { isBlankScope } from './inheritance'

const listOf = (value) => (Array.isArray(value) ? value : [])

export const countImported = (data) => ({
  requests: listOf(data.requests).length,
  folders: listOf(data.folders).length,
  environments: listOf(data.environments).length,
  variables: isPlainObject(data.variables) ? Object.keys(data.variables).length : 0,
  folderSettings: listOf(data.folders).filter((folder) => !isBlankScope(folder)).length,
})
