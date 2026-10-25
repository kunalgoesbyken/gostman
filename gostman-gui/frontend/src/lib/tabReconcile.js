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

  const lastSaved = ({ request, vanished }) => previous.get(request.id) || vanished

  const refresh = (tab) => {
    const { request } = tab
    const current = request.id ? saved.get(request.id) : null
    if (!current) return carried(request)
    const before = lastSaved(tab)
    return before && !isRequestDirty(request, before) ? current : carried(request)
  }

  const vanishedOf = (tab) => (tab.request.id && !saved.has(tab.request.id) ? lastSaved(tab) || null : null)

  const diskChangeOf = (tab) => {
    const { request, diskChange } = tab
    const current = request.id ? saved.get(request.id) : null
    if (!current || !isRequestDirty(request, current)) return null
    const before = lastSaved(tab)
    const changedUnderDraft = Boolean(before) && isRequestDirty(request, before) && isRequestDirty(current, before)
    return changedUnderDraft || diskChange ? current : null
  }

  return tabs.map((tab) => ({
    ...tab,
    request: inKnownFolder(refresh(tab)),
    diskChange: diskChangeOf(tab),
    vanished: vanishedOf(tab),
  }))
}
