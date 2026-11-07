import { useSyncExternalStore } from 'react'
import { COLLAPSED_DEPTH } from './jsonDepth'

const views = new WeakMap()
const listeners = new Set()
let lastEpochId = 0

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function changed(view) {
  view.version += 1
  listeners.forEach((listener) => listener())
}

function freshEpoch(depth, source) {
  lastEpochId += 1
  return { id: lastEpochId, depth, source, opened: new Map() }
}

function viewOf(owner) {
  if (!views.has(owner)) views.set(owner, { version: 0, choice: null, lastLevel: null, epoch: freshEpoch(null, null) })
  return views.get(owner)
}

export function useTreeView(owner) {
  const view = owner ? viewOf(owner) : null
  useSyncExternalStore(subscribe, () => view?.version ?? 0)
  return view
}

export function shownDepth(view, base, setting) {
  if (!view?.choice) return base
  if (view.choice.setting !== setting) view.choice = null
  return view.choice ? view.choice.depth : base
}

export function treeEpoch(view, depth, source) {
  if (view.epoch.depth !== depth || view.epoch.source !== source) view.epoch = freshEpoch(depth, source)
  return view.epoch
}

export function chooseDepth(view, { depth, current, base, setting }) {
  if (depth === Infinity && current !== Infinity) view.lastLevel = current
  view.choice = depth === base ? null : { depth, setting }
  view.epoch = freshEpoch(depth, view.epoch.source)
  changed(view)
}

export function noteToggle(view, epoch, path, byDefault, expanded) {
  if (epoch !== view.epoch) return
  if (expanded === byDefault) epoch.opened.delete(path)
  else epoch.opened.set(path, expanded)
  changed(view)
}

export const isExpandedIn = (epoch, path, byDefault) => (epoch.opened.has(path) ? epoch.opened.get(path) : byDefault)

export function opensBeyondLevel(epoch, depth) {
  if (depth === Infinity) return true
  for (const expanded of epoch.opened.values()) if (expanded) return true
  return false
}

export function collapseTarget(view, depth, base) {
  if (depth !== Infinity) return depth
  if (view.lastLevel !== null) return view.lastLevel
  return base === Infinity ? COLLAPSED_DEPTH : base
}
