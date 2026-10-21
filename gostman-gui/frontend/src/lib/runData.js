import { isPlainObject } from './dataUtils'

const BYTE_ORDER_MARK = '﻿'
const QUOTE = '"'
const JSON_EXTENSION = /\.json$/i

export const DATA_FILE_ERROR = {
  empty: 'The data file has no rows.',
  notArray: 'A JSON data file must be an array of objects, one object per iteration.',
  unreadable: 'The data file cannot be read.',
}

function splitRecords(text) {
  const records = []
  let record = []
  let field = ''
  let quoted = false
  const endField = () => {
    record.push(field)
    field = ''
  }
  const endRecord = () => {
    endField()
    records.push(record)
    record = []
  }
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character !== QUOTE) field += character
      else if (text[index + 1] === QUOTE) {
        field += QUOTE
        index += 1
      } else quoted = false
    } else if (character === QUOTE) quoted = true
    else if (character === ',') endField()
    else if (character === '\n') endRecord()
    else if (character !== '\r') field += character
  }
  if (field !== '' || record.length > 0) endRecord()
  return records.filter((candidate) => candidate.length > 1 || candidate[0].trim() !== '')
}

function parseCsv(text) {
  const [header = [], ...records] = splitRecords(text)
  const names = header.map((name) => name.trim())
  return records.map((record) => Object.fromEntries(
    names.flatMap((name, index) => (name ? [[name, record[index] ?? '']] : [])),
  ))
}

function parseJsonRows(text) {
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed) || !parsed.every(isPlainObject)) throw new Error(DATA_FILE_ERROR.notArray)
  return parsed
}

export function parseDataFile(name, content) {
  const text = content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content
  const rows = JSON_EXTENSION.test(name) ? parseJsonRows(text) : parseCsv(text)
  if (rows.length === 0) throw new Error(DATA_FILE_ERROR.empty)
  return rows
}

export const iterationCount = (rows, iterations) => {
  const requested = Math.max(0, Math.trunc(iterations) || 0)
  if (rows.length === 0) return Math.max(requested, 1)
  return requested > 0 ? Math.min(requested, rows.length) : rows.length
}

export const iterationVariables = (base, rows, iteration, count) => ({
  ...base,
  ...(rows[iteration] || {}),
  iteration: iteration + 1,
  iterationCount: count,
})
