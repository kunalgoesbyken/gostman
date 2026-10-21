import { PLACE_AFTER, PLACE_BEFORE } from './dropPlace.js'

export const CLOSE_OTHERS = 'others'
export const CLOSE_RIGHT = 'right'
export const CLOSE_SAVED = 'saved'

export function reorderTabs(tabs, tabId, targetId, place) {
  const moving = tabs.find((tab) => tab.id === tabId)
  const rest = tabs.filter((tab) => tab.id !== tabId)
  const targetIndex = rest.findIndex((tab) => tab.id === targetId)
  if (!moving || targetIndex < 0) return tabs
  const at = place === PLACE_AFTER ? targetIndex + 1 : targetIndex
  return [...rest.slice(0, at), moving, ...rest.slice(at)]
}

export function stepTab(tabs, tabId, step) {
  const index = tabs.findIndex((tab) => tab.id === tabId)
  const neighbour = tabs[index + step]
  if (index < 0 || !neighbour) return tabs
  return reorderTabs(tabs, tabId, neighbour.id, step > 0 ? PLACE_AFTER : PLACE_BEFORE)
}

export function tabsToClose(tabs, anchorId, scope, isClean) {
  const anchorIndex = tabs.findIndex((tab) => tab.id === anchorId)
  if (anchorIndex < 0) return []
  if (scope === CLOSE_SAVED) return tabs.filter(isClean)
  if (scope === CLOSE_RIGHT) return tabs.slice(anchorIndex + 1)
  return tabs.filter((tab) => tab.id !== anchorId)
}
