const DEFAULT_PATTERN = 'YYYY-MM-DDTHH:mm:ss.SSS[Z]'

const UNIT_MILLISECONDS = {
  millisecond: 1,
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
}

const pad = (value, width) => String(value).padStart(width, '0')

const TOKENS = [
  ['YYYY', (date) => pad(date.getUTCFullYear(), 4)],
  ['SSS', (date) => pad(date.getUTCMilliseconds(), 3)],
  ['MM', (date) => pad(date.getUTCMonth() + 1, 2)],
  ['DD', (date) => pad(date.getUTCDate(), 2)],
  ['HH', (date) => pad(date.getUTCHours(), 2)],
  ['mm', (date) => pad(date.getUTCMinutes(), 2)],
  ['ss', (date) => pad(date.getUTCSeconds(), 2)],
]

function toDate(value) {
  const date = value === undefined ? new Date() : new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`"${value}" is not a valid date.`)
  return date
}

function format(value, pattern = DEFAULT_PATTERN) {
  const date = toDate(value)
  let output = ''
  let index = 0
  while (index < pattern.length) {
    if (pattern[index] === '[') {
      const end = pattern.indexOf(']', index)
      const literalEnd = end < 0 ? pattern.length : end
      output += pattern.slice(index + 1, literalEnd)
      index = literalEnd + 1
      continue
    }
    const token = TOKENS.find(([name]) => pattern.startsWith(name, index))
    output += token ? token[1](date) : pattern[index]
    index += token ? token[0].length : 1
  }
  return output
}

function add(value, amount, unit = 'millisecond') {
  const name = String(unit)
  const size = UNIT_MILLISECONDS[name.endsWith('s') ? name.slice(0, -1) : name]
  if (!size) throw new Error(`Unknown time unit "${unit}". Use ${Object.keys(UNIT_MILLISECONDS).join(', ')}.`)
  return new Date(toDate(value).getTime() + amount * size).toISOString()
}

export const createDates = () => ({
  now: () => new Date().toISOString(),
  timestamp: (value) => toDate(value).getTime(),
  unix: (value) => Math.floor(toDate(value).getTime() / 1000),
  format,
  add,
})
