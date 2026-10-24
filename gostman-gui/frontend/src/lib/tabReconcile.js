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

  const carried = (request) => (wasRestricted ? withoutActiveContent(request) : request)

  const refresh = (request) => {
    if (!request.id) return carried(request)
    const current = saved.get(request.id)
    if (!current) return carried({ ...request, id: '' })
    const before = previous.get(request.id)
    return before && !isRequestDirty(request, before) ? current : carried(request)
  }

  const diskChangeOf = ({ request, diskChange }) => {
    const current = request.id ? saved.get(request.id) : null
    if (!current || !isRequestDirty(request, current)) return null
    const before = previous.get(request.id)
    const changedUnderDraft = Boolean(before) && isRequestDirty(request, before) && isRequestDirty(current, before)
    return changedUnderDraft || diskChange ? current : null
  }

  return tabs.map((tab) => ({ ...tab, request: inKnownFolder(refresh(tab.request)), diskChange: diskChangeOf(tab) }))
}
