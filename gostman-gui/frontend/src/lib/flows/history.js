const LIMIT = 100
const COALESCE_MS = 1000

const histories = new Map()

function historyOf(key) {
  if (!histories.has(key)) histories.set(key, { past: [], future: [], group: '', at: 0 })
  return histories.get(key)
}

export function recordChange(key, before, group = '') {
  const history = historyOf(key)
  const now = Date.now()
  const isSameEdit = group !== '' && group === history.group && now - history.at < COALESCE_MS
  if (!isSameEdit) history.past = [...history.past.slice(1 - LIMIT), before]
  history.future = []
  history.group = group
  history.at = now
}

function step(key, current, from, to) {
  const history = historyOf(key)
  const target = history[from].pop()
  if (target === undefined) return null
  history[to].push(current)
  history.group = ''
  return target
}

export const undoChange = (key, current) => step(key, current, 'past', 'future')

export const redoChange = (key, current) => step(key, current, 'future', 'past')

export const forgetHistory = (key) => histories.delete(key)

export const canUndo = (key) => historyOf(key).past.length > 0

export const canRedo = (key) => historyOf(key).future.length > 0
