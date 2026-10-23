const PATH_TOKENS = /(\.{1,2}|\[\?\]|\[\d+\])/
const WHITESPACE = /\s+/g
const DEEP = '..'
const STEP = '.'
const FILTER = '[?]'
const INDEX_OPEN = '['

const isObject = (value) => value !== null && typeof value === 'object'

const isMissing = (value) => value === null || value === undefined

function flattened(value) {
  if (!Array.isArray(value)) return value
  const values = value.flatMap((item) => flattened(item) ?? [])
  return values.length > 0 ? values : undefined
}

function valueOf(source, name, deep) {
  if (!isObject(source)) return undefined
  if (Array.isArray(source)) return flattened(source.map((item) => valueOf(item, name, deep)))
  if (!deep) return flattened(source[name])
  const nested = Object.entries(source)
    .filter(([key, item]) => key !== name && isObject(item))
    .map(([, item]) => valueOf(item, name, deep))
  return flattened([source[name], ...nested])
}

const matchesAll = (expected) => (item) => Object.entries(expected).every(([key, value]) => item[key] === value)

function filterOrMap(source, filter) {
  const test = typeof filter === 'function' ? filter : matchesAll(filter)
  const list = Array.isArray(source) ? source : [source]
  const kept = []
  for (const item of list.filter((entry) => !isMissing(entry))) {
    const outcome = test(item)
    if (outcome === true) kept.push(item)
    else if (!isMissing(outcome) && outcome !== false) kept.push(outcome)
  }
  return flattened(Array.isArray(source) ? kept : kept[0])
}

const tokensOf = (path) => String(path).replace(WHITESPACE, '').split(PATH_TOKENS).filter((token) => token !== '')

const indexOf = (token) => (token.startsWith(INDEX_OPEN) && token !== FILTER ? Number(token.slice(1, -1)) : null)

function step(current, token, previous, nextFilter) {
  if (token === FILTER) return filterOrMap(current, nextFilter())
  const index = indexOf(token)
  if (index !== null) return flattened(current[index])
  if (token === DEEP || token === STEP) return current
  return valueOf(current, token, previous === DEEP)
}

export function queryValue(source, path, ...filters) {
  let current = source
  let previous = ''
  let used = 0
  const nextFilter = () => {
    const filter = filters[used++]
    if (isMissing(filter)) throw new Error(`The query "${path}" needs a filter argument for each [?].`)
    return filter
  }
  for (const token of tokensOf(path)) {
    if (isMissing(current)) return current
    current = step(current, token, previous, nextFilter)
    previous = token
  }
  return current
}
