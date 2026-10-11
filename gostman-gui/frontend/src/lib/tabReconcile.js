import { withoutActiveContent } from './activeContent'
import { isRequestDirty } from './requestChanges'

const byId = (items) => new Map(items.map((item) => [item.id, item]))

export function reconcileTabs(tabs, previousRequests, requests, folders, wasRestricted) {
  const previous = byId(previousRequests)
  const saved = byId(requests)
  const folderIds = new Set(folders.map((folder) => folder.id))

  const inKnownFolder = (request) => (
    !request.folderId || folderIds.has(request.folderId) ? request : { ...request, folderId: '' }
  )

  const detach = (request) => {
    const draft = { ...request, id: '' }
    return wasRestricted ? withoutActiveContent(draft) : draft
  }

  const refresh = (request) => {
    if (!request.id) return request
    const current = saved.get(request.id)
    if (!current) return detach(request)
    const before = previous.get(request.id)
    return before && !isRequestDirty(request, before) ? current : request
  }

  return tabs.map((tab) => ({ ...tab, request: inKnownFolder(refresh(tab.request)) }))
}
