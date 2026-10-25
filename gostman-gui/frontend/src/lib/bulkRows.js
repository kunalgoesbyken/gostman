import { isBlankRow } from './rows'

const DISABLED_PREFIX = '//'
const DISABLED_PREFIXES = [DISABLED_PREFIX, '#']
const SEPARATOR = ':'
const KEY_START = 1

const rowToLine = ({ key, value, enabled }) => `${enabled ? '' : `${DISABLED_PREFIX} `}${key}${SEPARATOR} ${value}`

export const rowsToBulkText = (rows) => rows.map(rowToLine).join('\n')

function splitPair(text) {
  const at = text.indexOf(SEPARATOR, KEY_START)
  if (at < 0) return { key: text, value: '' }
  return { key: text.slice(0, at).trim(), value: text.slice(at + SEPARATOR.length).trim() }
}

function lineToRow(line) {
  const text = line.trim()
  const prefix = DISABLED_PREFIXES.find((candidate) => text.startsWith(candidate))
  return { ...splitPair(prefix ? text.slice(prefix.length).trim() : text), enabled: !prefix }
}

export const bulkTextToRows = (text) => text.split(/\r?\n/).map(lineToRow).filter((row) => !isBlankRow(row))

const sameRow = (left, right) => left.key === right.key && left.value === right.value && left.enabled === right.enabled

export function fitsBulkText(rows) {
  const parsed = bulkTextToRows(rowsToBulkText(rows))
  return parsed.length === rows.length && parsed.every((row, index) => sameRow(row, rows[index]))
}
