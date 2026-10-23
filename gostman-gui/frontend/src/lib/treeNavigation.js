import { ROW_EMPTY, ROW_FOLDER } from './collectionTree'

const NOT_FOUND = -1

const isFocusable = (row) => row !== undefined && row.kind !== ROW_EMPTY

export function stepFrom(rows, index, step) {
  for (let candidate = index + step; candidate >= 0 && candidate < rows.length; candidate += step) {
    if (isFocusable(rows[candidate])) return candidate
  }
  return NOT_FOUND
}

export function pageFrom(rows, index, step, pageSize) {
  const nearest = nearestRow(rows, Math.max(0, Math.min(rows.length - 1, index + step * pageSize)))
  return nearest === index ? stepFrom(rows, index, step) : nearest
}

export const firstRow = (rows) => stepFrom(rows, NOT_FOUND, 1)

export const lastRow = (rows) => stepFrom(rows, rows.length, -1)

export function parentRow(rows, index) {
  const { depth } = rows[index]
  for (let candidate = index - 1; candidate >= 0; candidate -= 1) {
    if (rows[candidate].kind === ROW_FOLDER && rows[candidate].depth === depth - 1) return candidate
  }
  return NOT_FOUND
}

export function firstChildRow(rows, index) {
  const child = rows[index + 1]
  return isFocusable(child) && child.depth === rows[index].depth + 1 ? index + 1 : NOT_FOUND
}

export function nearestRow(rows, index) {
  const clamped = Math.min(index, rows.length - 1)
  if (isFocusable(rows[clamped])) return clamped
  const below = stepFrom(rows, clamped, 1)
  return below === NOT_FOUND ? stepFrom(rows, clamped, -1) : below
}

export const rowLabel = (row) => (isFocusable(row) ? (row.folder || row.request).name || '' : null)
