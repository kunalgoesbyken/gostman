const WHITESPACE = ' \t\n\r'
const NUMBER_CHARACTERS = '+-0123456789.eE'
const JSON_NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/u
const LITERALS = { t: ['true', true], f: ['false', false], n: ['null', null] }

export class ExactNumber {
  constructor(text) {
    this.text = text
  }
}

export const isJsonNumber = (text) => JSON_NUMBER.test(text)

function setOwn(holder, key, value) {
  Object.defineProperty(holder, key, { value, enumerable: true, writable: true, configurable: true })
}

function reader(text) {
  let at = 0
  const skip = () => {
    while (at < text.length && WHITESPACE.includes(text[at])) at += 1
  }
  const scan = (accepts) => {
    const start = at
    while (at < text.length && accepts(at)) at += 1
    return text.slice(start, at)
  }
  const string = () => {
    const start = at
    at += 1
    while (text[at] !== '"') at += text[at] === '\\' ? 2 : 1
    at += 1
    return JSON.parse(text.slice(start, at))
  }
  const items = (close, readItem) => {
    at += 1
    skip()
    while (text[at] !== close) {
      readItem()
      skip()
      if (text[at] === ',') at += 1
      skip()
    }
    at += 1
  }
  const array = () => {
    const list = []
    items(']', () => list.push(value()))
    return list
  }
  const object = () => {
    const holder = {}
    items('}', () => {
      const key = string()
      skip()
      at += 1
      setOwn(holder, key, value())
    })
    return holder
  }
  const value = () => {
    skip()
    const first = text[at]
    if (first === '{') return object()
    if (first === '[') return array()
    if (first === '"') return string()
    if (LITERALS[first]) {
      const [word, literal] = LITERALS[first]
      at += word.length
      return literal
    }
    return new ExactNumber(scan((position) => NUMBER_CHARACTERS.includes(text[position])))
  }
  return value
}

export function parseExact(text) {
  JSON.parse(text)
  return reader(text)()
}

const isObject = (value) => value !== null && typeof value === 'object'

export const exactNumbersIn = (value) => {
  if (value instanceof ExactNumber) return [value.text]
  return isObject(value) ? Object.values(value).flatMap(exactNumbersIn) : []
}

function wrap(open, close, parts, indent, depth) {
  if (parts.length === 0) return `${open}${close}`
  if (indent === 0) return `${open}${parts.join(',')}${close}`
  const inner = ' '.repeat(indent * (depth + 1))
  return `${open}\n${inner}${parts.join(`,\n${inner}`)}\n${' '.repeat(indent * depth)}${close}`
}

export function stringifyExact(value, indent = 0, depth = 0) {
  if (value instanceof ExactNumber) return value.text
  if (Array.isArray(value)) {
    return wrap('[', ']', value.map((item) => stringifyExact(item === undefined ? null : item, indent, depth + 1)), indent, depth)
  }
  if (isObject(value)) {
    const separator = indent === 0 ? ':' : ': '
    const kept = Object.entries(value).filter(([, item]) => item !== undefined && typeof item !== 'function')
    return wrap('{', '}', kept.map(([key, item]) => `${JSON.stringify(key)}${separator}${stringifyExact(item, indent, depth + 1)}`), indent, depth)
  }
  return JSON.stringify(value) ?? 'null'
}
