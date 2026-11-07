import { useMemo, useSyncExternalStore } from 'react'
import { COLLAPSED_DEPTH } from './jsonDepth'

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

function viewOf(owner) {
  if (views.has(owner)) return views.get(owner)
  lastViewId += 1
  views.set(owner, { id: lastViewId, version: 0, generation: 0, choice: null, lastLevel: null, opened: { epochId: '', paths: new Map() } })
  return views.get(owner)
}

export function useTreeView(owner) {
  const view = owner ? viewOf(owner) : null
  useSyncExternalStore(subscribe, () => view?.version ?? 0)
  return view
}

export const shownDepth = (view, base, setting) => (view?.choice?.setting === setting ? view.choice.depth : base)

export function useTreeEpoch(view, depth, source, isShown) {
  const generation = view?.generation
  return useMemo(() => (isShown && view ? { id: `${view.id}:${generation}:${depth}:${source}`, depth, view } : null), [isShown, view, generation, depth, source])
}

export function chooseDepth(view, { depth, current, base, setting }) {
  if (depth === Infinity && current !== Infinity) view.lastLevel = current
  view.choice = depth === base ? null : { depth, setting }
  view.generation += 1
  changed(view)
}

export function noteToggle(view, epoch, path, byDefault, expanded) {
  if (view.opened.epochId !== epoch.id) view.opened = { epochId: epoch.id, paths: new Map() }
  if (expanded === byDefault) view.opened.paths.delete(path)
  else view.opened.paths.set(path, expanded)
  changed(view)
}

const openedIn = (epoch) => (epoch.view.opened.epochId === epoch.id ? epoch.view.opened.paths : NONE_OPENED)

export function isExpandedIn(epoch, path, byDefault) {
  const opened = openedIn(epoch)
  return opened.has(path) ? opened.get(path) : byDefault
}

export function opensBeyondLevel(epoch, depth) {
  if (depth === Infinity) return true
  for (const expanded of openedIn(epoch).values()) if (expanded) return true
  return false
}

export function collapseTarget(view, depth, base) {
  if (depth !== Infinity) return depth
  if (view.lastLevel !== null) return view.lastLevel
  return base === Infinity ? COLLAPSED_DEPTH : base
}
