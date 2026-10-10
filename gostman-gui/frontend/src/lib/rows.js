import { isPlainObject, parseJSON } from './dataUtils'

export const ROW_TEXT = 'text'
export const ROW_FILE = 'file'

const asText = (value) => {
  if (value === null || value === undefined) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const toRow = (raw) => ({ ...raw, key: asText(raw.key), value: asText(raw.value), enabled: raw.enabled !== false })

const rowsFromObject = (object) => Object.entries(object).flatMap(([key, value]) => (
  (Array.isArray(value) ? value : [value]).map((item) => ({ key, value: asText(item), enabled: true }))
))

export function parseRows(json) {
  const parsed = parseJSON(json, [])
  if (Array.isArray(parsed)) return parsed.filter(isPlainObject).map(toRow)
  if (isPlainObject(parsed)) return rowsFromObject(parsed)
  return []
}

export const serializeRows = (rows) => JSON.stringify(rows)

export const isFileRow = (row) => row.type === ROW_FILE

export const isBlankRow = (row) => row.key === '' && row.value === '' && !isFileRow(row)

export const isSentRow = (row) => row.enabled && row.key.trim() !== ''

export const countSentRows = (rows) => rows.filter(isSentRow).length
