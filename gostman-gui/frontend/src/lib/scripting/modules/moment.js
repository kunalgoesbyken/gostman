const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const FIXED_UNITS = { millisecond: 1, second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000, week: 604_800_000 }

const UNIT_ALIASES = { ms: 'millisecond', s: 'second', m: 'minute', h: 'hour', d: 'day', w: 'week', M: 'month', y: 'year' }

const pad = (value, width = 2) => String(value).padStart(width, '0')

const hour12 = (date) => date.getUTCHours() % 12 || 12

const TOKENS = [
  ['YYYY', (date) => pad(date.getUTCFullYear(), 4)],
  ['MMMM', (date) => MONTHS[date.getUTCMonth()]],
  ['dddd', (date) => DAYS[date.getUTCDay()]],
  ['MMM', (date) => MONTHS[date.getUTCMonth()].slice(0, 3)],
  ['ddd', (date) => DAYS[date.getUTCDay()].slice(0, 3)],
  ['SSS', (date) => pad(date.getUTCMilliseconds(), 3)],
  ['YY', (date) => pad(date.getUTCFullYear() % 100)],
  ['MM', (date) => pad(date.getUTCMonth() + 1)],
  ['DD', (date) => pad(date.getUTCDate())],
  ['HH', (date) => pad(date.getUTCHours())],
  ['hh', (date) => pad(hour12(date))],
  ['mm', (date) => pad(date.getUTCMinutes())],
  ['ss', (date) => pad(date.getUTCSeconds())],
  ['ZZ', () => '+0000'],
  ['Z', () => '+00:00'],
  ['M', (date) => String(date.getUTCMonth() + 1)],
  ['D', (date) => String(date.getUTCDate())],
  ['H', (date) => String(date.getUTCHours())],
  ['h', (date) => String(hour12(date))],
  ['m', (date) => String(date.getUTCMinutes())],
  ['s', (date) => String(date.getUTCSeconds())],
  ['A', (date) => (date.getUTCHours() < 12 ? 'AM' : 'PM')],
  ['a', (date) => (date.getUTCHours() < 12 ? 'am' : 'pm')],
  ['X', (date) => String(Math.floor(date.getTime() / 1000))],
  ['x', (date) => String(date.getTime())],
]

const DEFAULT_PATTERN = 'YYYY-MM-DDTHH:mm:ssZ'

function format(date, pattern) {
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

function unitOf(unit) {
  const name = UNIT_ALIASES[unit] ?? String(unit).replace(/s$/, '')
  if (Object.hasOwn(FIXED_UNITS, name) || name === 'month' || name === 'year') return name
  throw new Error(`Unknown time unit "${unit}". Use millisecond, second, minute, hour, day, week, month or year.`)
}

function shifted(time, amount, unit) {
  const name = unitOf(unit)
  if (Object.hasOwn(FIXED_UNITS, name)) return time + amount * FIXED_UNITS[name]
  const date = new Date(time)
  if (name === 'month') date.setUTCMonth(date.getUTCMonth() + amount)
  else date.setUTCFullYear(date.getUTCFullYear() + amount)
  return date.getTime()
}

function startOf(time, unit) {
  const name = unitOf(unit)
  const date = new Date(time)
  const parts = [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
  if (name === 'week') return startOf(time, 'day') - date.getUTCDay() * FIXED_UNITS.day
  const keep = { year: 0, month: 1, day: 2, hour: 3, minute: 4, second: 5 }[name]
  if (keep === undefined) return time
  return Date.UTC(parts[0], keep >= 1 ? parts[1] : 0, keep >= 2 ? parts[2] : 1, keep >= 3 ? parts[3] : 0, keep >= 4 ? parts[4] : 0, keep >= 5 ? parts[5] : 0)
}

function difference(first, second, unit) {
  const name = unitOf(unit)
  if (Object.hasOwn(FIXED_UNITS, name)) return Math.trunc((first - second) / FIXED_UNITS[name])
  const [a, b] = [new Date(first), new Date(second)]
  const months = (a.getUTCFullYear() - b.getUTCFullYear()) * 12 + a.getUTCMonth() - b.getUTCMonth()
  return name === 'month' ? months : Math.trunc(months / 12)
}

function timeOf(input, pattern) {
  if (pattern !== undefined) throw new Error('Parsing with a format string is not supported. Pass an ISO 8601 string, a number or a Date.')
  if (input === undefined) return Date.now()
  if (input !== null && typeof input === 'object' && typeof input.valueOf === 'function') return Number(input.valueOf())
  return typeof input === 'number' ? input : Date.parse(input)
}

export function createTimeLibrary({ mutable }) {
  const create = (input, pattern) => instance(timeOf(input, pattern))
  const instance = (initial) => {
    let time = initial
    const next = (value) => {
      if (mutable) {
        time = value
        return self
      }
      return instance(value)
    }
    const self = {
      format: (pattern = DEFAULT_PATTERN) => format(new Date(time), pattern),
      valueOf: () => time,
      unix: () => Math.floor(time / 1000),
      toDate: () => new Date(time),
      toISOString: () => new Date(time).toISOString(),
      toJSON: () => new Date(time).toISOString(),
      toString: () => new Date(time).toUTCString(),
      isValid: () => !Number.isNaN(time),
      clone: () => instance(time),
      utc: () => self,
      add: (amount, unit) => next(shifted(time, amount, unit)),
      subtract: (amount, unit) => next(shifted(time, -amount, unit)),
      startOf: (unit) => next(startOf(time, unit)),
      endOf: (unit) => next(shifted(shifted(startOf(time, unit), 1, unit), -1, 'ms')),
      diff: (other, unit = 'millisecond') => difference(time, timeOf(other), unit),
      isBefore: (other) => time < timeOf(other),
      isAfter: (other) => time > timeOf(other),
      isSame: (other) => time === timeOf(other),
    }
    return self
  }
  create.utc = create
  create.unix = (seconds) => instance(seconds * 1000)
  create.isMoment = (value) => value !== null && typeof value === 'object' && typeof value.unix === 'function' && typeof value.diff === 'function'
  return create
}
