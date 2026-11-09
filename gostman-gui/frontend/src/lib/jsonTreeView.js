import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { depthOfSetting } from './jsonDepth'

const views = new WeakMap()
const eras = new Map()
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

const shownOf = (state) => state.choice ?? state.base

const startState = (era, base, lastLevel) => ({ era, base, lastLevel, generation: 0, choice: null, opened: new Map() })

function eraFor(known, setting) {
  if (!known) return { setting, count: 0 }
  return known.setting === setting ? known : { setting, count: known.count + 1 }
}

function stateFor(state, era, base) {
  if (state.era === era.count) return state
  const before = shownOf(state)
  return startState(era.count, base, Number.isFinite(before) ? before : null)
}

function viewOf(owner, era, base) {
  if (!views.has(owner)) {
    lastViewId += 1
    views.set(owner, { id: lastViewId, version: 0, filterPath: '', state: startState(era.count, base, null) })
  }
  return views.get(owner)
}

export function useTreeView(owner, scope, setting, base) {
  const known = eras.get(scope)
  const era = useMemo(() => eraFor(known, setting), [known, setting])
  const view = owner ? viewOf(owner, era, base) : null
  useSyncExternalStore(subscribe, () => view?.version ?? 0)
  const committed = view?.state
  const treeView = useMemo(() => (view ? { view, scope, era, base, state: stateFor(committed, era, base) } : null), [view, scope, era, base, committed])
  useEffect(() => {
    eras.set(scope, era)
  }, [scope, era])
  useEffect(() => {
    if (!treeView || treeView.state === treeView.view.state) return
    treeView.view.state = treeView.state
    changed(treeView.view)
  }, [treeView])
  return treeView
}

export const shownDepth = (treeView, base) => treeView?.state.choice ?? base

export function useTreeEpoch(treeView, source, isShown) {
  return useMemo(() => {
    if (!isShown || !treeView) return null
    const { view, state, base } = treeView
    return { id: `${view.id}:${state.era}:${state.generation}:${source}`, depth: state.choice ?? base, source, view, state }
  }, [isShown, treeView, source])
}

export function chooseDepth({ view, state, base }, depth) {
  const current = state.choice ?? base
  view.state = {
    ...state,
    base,
    choice: depth === base ? null : depth,
    lastLevel: depth === Infinity && current !== Infinity ? current : state.lastLevel,
    opened: new Map(),
    generation: state.generation + 1,
  }
  changed(view)
}

export function adoptSetting({ view, scope, era, state }, setting) {
  eras.set(scope, { setting, count: era.count })
  view.state = { ...state, base: depthOfSetting(setting), choice: null }
  changed(view)
}

export function setFilterPath({ view }, path) {
  view.filterPath = path
  changed(view)
}

const openedIn = ({ state, source }) => state.opened.get(source) ?? NONE_OPENED

export function noteToggle(epoch, path, byDefault, expanded) {
  const { state, source, view } = epoch
  if (!state.opened.has(source)) state.opened.set(source, new Map())
  const paths = state.opened.get(source)
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

export function collapseTarget({ state }, depth, fallback) {
  return depth === Infinity ? state.lastLevel ?? fallback : depth
}
