import { useEffect, useMemo, useSyncExternalStore } from 'react'
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

const shownOf = (state) => state.choice ?? state.base

const startState = (setting, base, generation, lastLevel) => ({ setting, base, generation, lastLevel, choice: null, opened: new Map() })

function stateFor(state, setting, base) {
  if (state.setting === setting) return state
  const before = shownOf(state)
  return startState(setting, base, state.generation + 1, Number.isFinite(before) ? before : null)
}

function viewOf(owner, setting, base) {
  if (!views.has(owner)) {
    lastViewId += 1
    views.set(owner, { id: lastViewId, version: 0, filterPath: '', state: startState(setting, base, 0, null) })
  }
  return views.get(owner)
}

export function useTreeView(owner, setting, base) {
  const view = owner ? viewOf(owner, setting, base) : null
  useSyncExternalStore(subscribe, () => view?.version ?? 0)
  const committed = view?.state
  const treeView = useMemo(() => (view ? { view, state: stateFor(committed, setting, base) } : null), [view, committed, setting, base])
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
    const { view, state } = treeView
    return { id: `${view.id}:${state.generation}:${source}`, depth: shownOf(state), source, view, state }
  }, [isShown, treeView, source])
}

export function chooseDepth({ view, state }, depth) {
  const current = shownOf(state)
  view.state = {
    ...state,
    choice: depth === state.base ? null : depth,
    lastLevel: depth === Infinity && current !== Infinity ? current : state.lastLevel,
    opened: new Map(),
    generation: state.generation + 1,
  }
  changed(view)
}

export function adoptSetting({ view, state }, setting) {
  view.state = { ...state, setting, base: depthOfSetting(setting), choice: null }
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

export function collapseTarget({ state }) {
  const depth = shownOf(state)
  return depth === Infinity ? state.lastLevel ?? COLLAPSED_DEPTH : depth
}
