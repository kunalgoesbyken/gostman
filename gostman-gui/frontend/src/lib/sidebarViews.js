import { isPlainObject } from './dataUtils.js'

export const VIEW_COLLECTIONS = 'collections'
export const VIEW_FLOWS = 'flows'
export const VIEW_HISTORY = 'history'
export const SIDEBAR_VIEWS = [VIEW_COLLECTIONS, VIEW_FLOWS, VIEW_HISTORY]
export const DEFAULT_SIDEBAR_VIEWS = SIDEBAR_VIEWS.map((id) => ({ id, visible: true }))

const isEntry = (entry) => isPlainObject(entry) && SIDEBAR_VIEWS.includes(entry.id) && typeof entry.visible === 'boolean'

const firstOfEach = (entries) => entries.filter((entry, index) => entries.findIndex((other) => other.id === entry.id) === index)

const withOneVisible = (views) => (views.some((view) => view.visible) ? views : views.map((view, index) => ({ ...view, visible: index === 0 })))

export function normalizeSidebarViews(raw) {
  const listed = firstOfEach((Array.isArray(raw) ? raw : []).filter(isEntry)).map(({ id, visible }) => ({ id, visible }))
  const missing = SIDEBAR_VIEWS.filter((id) => !listed.some((view) => view.id === id)).map((id) => ({ id, visible: true }))
  return withOneVisible([...listed, ...missing])
}

export const visibleViews = (views) => views.filter((view) => view.visible).map((view) => view.id)

export const canHideView = (views, id) => visibleViews(views).some((other) => other !== id)

export const withViewVisible = (views, id, visible) => views.map((view) => (view.id === id ? { ...view, visible } : view))

export function withViewMoved(views, id, offset) {
  const from = views.findIndex((view) => view.id === id)
  const to = from + offset
  if (from < 0 || to < 0 || to >= views.length) return views
  const moved = [...views]
  ;[moved[from], moved[to]] = [moved[to], moved[from]]
  return moved
}
