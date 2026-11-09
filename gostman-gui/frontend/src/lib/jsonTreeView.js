import { useMemo, useSyncExternalStore } from 'react'
import { COLLAPSED_DEPTH, depthOfSetting } from './jsonDepth'

const views = new WeakMap()
const listeners = new Set()
const NONE_OPENED = new Map()
let lastViewId = 0

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function changed(view) {
  view.version += 1
  listeners.forEach((listener) => listener())
}

const shownOf = (view) => view.choice ?? view.base

function leaveSetting(view, setting, base) {
  const before = shownOf(view)
  Object.assign(view, {
    setting,
    base,
    choice: null,
    lastLevel: Number.isFinite(before) ? before : null,
    opened: new Map(),
    generation: view.generation + 1,
  })
}

function viewOf(owner, setting, base) {
  if (!views.has(owner)) {
    lastViewId += 1
    views.set(owner, { id: lastViewId, version: 0, generation: 0, setting, base, choice: null, lastLevel: null, opened: new Map(), filterPath: '' })
  }
  const view = views.get(owner)
  if (view.setting !== setting) leaveSetting(view, setting, base)
  return view
}

export function useTreeView(owner, setting, base) {
  const view = owner ? viewOf(owner, setting, base) : null
  useSyncExternalStore(subscribe, () => view?.version ?? 0)
  return view
}

export const shownDepth = (view, base) => view?.choice ?? base

export function useTreeEpoch(view, depth, source, isShown) {
  const generation = view?.generation
  return useMemo(() => (isShown && view ? { id: `${view.id}:${generation}:${source}`, depth, source, view } : null), [isShown, view, generation, depth, source])
}

export function chooseDepth(view, depth) {
  const current = shownOf(view)
  if (depth === Infinity && current !== Infinity) view.lastLevel = current
  view.choice = depth === view.base ? null : depth
  view.opened = new Map()
  view.generation += 1
  changed(view)
}

export function adoptSetting(view, setting) {
  view.setting = setting
  view.base = depthOfSetting(setting)
  view.choice = null
}

export function setFilterPath(view, path) {
  view.filterPath = path
  changed(view)
}

const openedIn = ({ view, source }) => view.opened.get(source) ?? NONE_OPENED

export function noteToggle(epoch, path, byDefault, expanded) {
  const { view, source } = epoch
  if (!view.opened.has(source)) view.opened.set(source, new Map())
  const paths = view.opened.get(source)
  if (expanded === byDefault) paths.delete(path)
  else paths.set(path, expanded)
  changed(view)
}

export function isExpandedIn(epoch, path, byDefault) {
  const opened = openedIn(epoch)
  return opened.has(path) ? opened.get(path) : byDefault
}

export function opensBeyondLevel(epoch) {
  if (epoch.depth === Infinity) return true
  for (const expanded of openedIn(epoch).values()) if (expanded) return true
  return false
}

export function collapseTarget(view) {
  const depth = shownOf(view)
  return depth === Infinity ? view.lastLevel ?? COLLAPSED_DEPTH : depth
}
