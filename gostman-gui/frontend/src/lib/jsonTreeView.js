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

export function useTreeEpoch(treeView, source, isShown, nesting) {
  return useMemo(() => {
    if (!isShown || !treeView) return null
    const { view, state, base } = treeView
    const tree = treeOf(state, source)
    return { id: `${view.id}:${state.era}:${tree.generation}:${source}`, depth: tree.choice ?? base, nesting, source, treeView }
  }, [isShown, treeView, source, nesting])
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

const releasedFromOldBase = (tree) => (tree.choice === null ? { ...tree, opened: new Map() } : tree)

export function adoptSetting({ source, treeView: { view, scope, era, state } }, setting) {
  eras.set(scope, { setting, count: era.count })
  const trees = new Map([...state.trees].map(([key, tree]) => [key, releasedFromOldBase(tree)]))
  trees.set(source, { ...treeOf(state, source), choice: null })
  view.state = { ...state, base: depthOfSetting(setting), trees }
  changed(view)
}

export function setFilterPath({ view }, path) {
  view.filterPath = path
  changed(view)
}

const openedIn = ({ source, treeView }) => treeView.state.trees.get(source)?.opened ?? NONE_OPENED

export function noteToggle(epoch, path, level, expanded) {
  const { source, treeView: { state, view } } = epoch
  if (!state.trees.has(source)) state.trees.set(source, freshTree(state.lastLevel))
  state.trees.get(source).opened.set(path, { level, expanded })
  changed(view)
}

export function isExpandedIn(epoch, path, level) {
  return openedIn(epoch).get(path)?.expanded ?? level < epoch.depth
}

const handOpened = (depth, { level, expanded }) => expanded && level >= depth

const handClosed = (depth, { level, expanded }) => !expanded && level < depth

const someOpened = (epoch, test) => [...openedIn(epoch).values()].some((entry) => test(epoch.depth, entry))

const hasDeeperLevels = (epoch) => epoch.nesting >= epoch.depth

export const opensBeyondLevel = (epoch, fallback) =>
  epoch.depth === Infinity ? epoch.nesting >= collapseTarget(epoch, fallback) : someOpened(epoch, handOpened)

export const hasUnopenedNodes = (epoch) => hasDeeperLevels(epoch) || someOpened(epoch, handClosed)

export function expandAll(epoch) {
  chooseDepth(epoch, hasDeeperLevels(epoch) ? Infinity : epoch.depth)
}

export function collapseTarget(epoch, fallback) {
  return epoch.depth === Infinity ? treeOf(epoch.treeView.state, epoch.source).lastLevel ?? fallback : epoch.depth
}
