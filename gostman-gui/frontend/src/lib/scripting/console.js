import { LEVELS } from '../consoleLog'
import { isPlainObject } from '../dataUtils'
import { MAX_LOG_CHARS, MAX_LOG_ENTRIES } from './limits'

const LEVEL_DEFAULT = 'log'
const LEVEL_WARN = 'warn'
const LEVEL_ERROR = 'error'
const INDEX_COLUMN = '(index)'
const VALUE_COLUMN = 'Value'
const COLUMN_GAP = '  '
const TRUNCATED_OUTPUT = 'Console output was truncated.'

export const printable = (value) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return `${value.name}: ${value.message}`
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

const capped = (text) => (
  text.length > MAX_LOG_CHARS ? `${text.slice(0, MAX_LOG_CHARS)}\n... ${text.length - MAX_LOG_CHARS} more characters` : text
)

export const logLine = (level, text) => ({ level, text: capped(text), at: Date.now() })

const cellText = (value) => (typeof value === 'string' ? value : JSON.stringify(value) ?? String(value))

function tableRows(data) {
  const entries = Array.isArray(data) ? data.map((item, index) => [String(index), item]) : Object.entries(data)
  const columns = [...new Set(entries.flatMap(([, item]) => (isPlainObject(item) ? Object.keys(item) : [])))]
  const hasValues = entries.some(([, item]) => !isPlainObject(item))
  const header = [INDEX_COLUMN, ...columns, ...(hasValues ? [VALUE_COLUMN] : [])]
  const body = entries.map(([key, item]) => [
    key,
    ...columns.map((column) => (isPlainObject(item) && column in item ? cellText(item[column]) : '')),
    ...(hasValues ? [isPlainObject(item) ? '' : cellText(item)] : []),
  ])
  return [header, ...body]
}

export function tableText(data) {
  const rows = tableRows(data)
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)))
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join(COLUMN_GAP).trimEnd()).join('\n')
}

const isTabular = (value) => value !== null && typeof value === 'object'

export function createConsole(logs) {
  const write = (level, text) => {
    if (logs.length > MAX_LOG_ENTRIES) return
    logs.push(logs.length === MAX_LOG_ENTRIES ? logLine(LEVEL_WARN, TRUNCATED_OUTPUT) : logLine(level, text))
  }
  const writer = (level) => (...values) => write(level, values.map(printable).join(' '))
  return {
    ...Object.fromEntries(LEVELS.map((level) => [level, writer(level)])),
    table: (data, ...rest) => write(LEVEL_DEFAULT, isTabular(data) ? tableText(data) : [data, ...rest].map(printable).join(' ')),
  }
}

export const errorLine = (text) => logLine(LEVEL_ERROR, text)
