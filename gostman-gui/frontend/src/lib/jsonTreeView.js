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

const freshTree = (lastLevel) => ({ choice: null, lastLevel, generation: 0, opened: new Map() })

const startState = (era, base, lastLevel) => ({ era, base, lastLevel, trees: new Map() })

const finiteOrNull = (depth) => (Number.isFinite(depth) ? depth : null)

const treeOf = (state, source) => state.trees.get(source) ?? freshTree(state.lastLevel)

const withTree = (state, source, tree) => new Map(state.trees).set(source, tree)

function eraFor(known, setting) {
  if (!known) return { setting, count: 0 }
  return known.setting === setting ? known : { setting, count: known.count + 1 }
}

function stateFor(state, era, base) {
  if (state.era === era.count) return state
  const levelBefore = (choice) => finiteOrNull(choice ?? state.base)
  const restarted = startState(era.count, base, levelBefore(null))
  state.trees.forEach((tree, source) => restarted.trees.set(source, freshTree(levelBefore(tree.choice))))
  return restarted
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

export function useTreeEpoch(treeView, source, isShown) {
  return useMemo(() => {
    if (!isShown || !treeView) return null
    const { view, state, base } = treeView
    const tree = treeOf(state, source)
    return { id: `${view.id}:${state.era}:${tree.generation}:${source}`, depth: tree.choice ?? base, source, treeView }
  }, [isShown, treeView, source])
}

export function chooseDepth({ depth: current, source, treeView: { view, state, base } }, depth) {
  const tree = treeOf(state, source)
  view.state = {
    ...state,
    base,
    trees: withTree(state, source, {
      choice: depth === base ? null : depth,
      lastLevel: depth === Infinity && current !== Infinity ? current : tree.lastLevel,
      generation: tree.generation + 1,
      opened: new Map(),
    }),
  }
  changed(view)
}

export function adoptSetting({ source, treeView: { view, scope, era, state } }, setting) {
  eras.set(scope, { setting, count: era.count })
  view.state = { ...state, base: depthOfSetting(setting), trees: withTree(state, source, { ...treeOf(state, source), choice: null }) }
  changed(view)
}

export function setFilterPath({ view }, path) {
  view.filterPath = path
  changed(view)
}

const openedIn = ({ source, treeView }) => treeView.state.trees.get(source)?.opened ?? NONE_OPENED

export function noteToggle(epoch, path, byDefault, expanded) {
  const { source, treeView: { state, view } } = epoch
  if (!state.trees.has(source)) state.trees.set(source, freshTree(state.lastLevel))
  const paths = state.trees.get(source).opened
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

export const hasUnopenedNodes = (epoch, deepestLevel) => deepestLevel >= epoch.depth || openedIn(epoch).size > 0

export function collapseTarget(epoch, fallback) {
  return epoch.depth === Infinity ? treeOf(epoch.treeView.state, epoch.source).lastLevel ?? fallback : epoch.depth
}
