import { statusClassOf, timeOf } from './callHistory'

export const CALLS_FILE_NAME = 'gostman-calls.csv'
export const CSV_MEDIA_TYPE = 'text/csv'

const LINE_BREAK = '\r\n'
const SEPARATOR = ','
const QUOTE = '"'
const MINUTE_MS = 60 * 1000
const MINUTES_PER_HOUR = 60
const SPECIAL_CHARACTERS = [SEPARATOR, QUOTE, '\r', '\n']
const FORMULA_STARTS = ['=', '+', '-', '@', '\t', '\r']
const FORMULA_GUARD = "'"

const pad = (number) => String(number).padStart(2, '0')

export function isoWithOffset(time) {
  const offset = -new Date(time).getTimezoneOffset()
  const local = new Date(time + offset * MINUTE_MS).toISOString().slice(0, -1)
  const distance = Math.abs(offset)
  return `${local}${offset < 0 ? '-' : '+'}${pad(Math.floor(distance / MINUTES_PER_HOUR))}:${pad(distance % MINUTES_PER_HOUR)}`
}

const guarded = (value) => (typeof value === 'string' && FORMULA_STARTS.some((start) => value.startsWith(start)) ? FORMULA_GUARD + value : value)

function field(value) {
  const text = String(guarded(value) ?? '')
  return SPECIAL_CHARACTERS.some((character) => text.includes(character)) ? `${QUOTE}${text.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}` : text
}

export const csvLine = (values) => values.map(field).join(SEPARATOR)

const statusOf = (call) => (call.statusCode > 0 ? call.statusCode : statusClassOf(call))

export function callsCsv(rows, headers, urlOf) {
  const lines = rows.map(({ entry, call }) => csvLine([isoWithOffset(timeOf(call)), entry.method, urlOf(entry), statusOf(call), call.reason, call.durationMs, call.size]))
  return [csvLine(headers), ...lines].join(LINE_BREAK) + LINE_BREAK
}
