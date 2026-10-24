import { isPlainObject } from '../../dataUtils'

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const toPath = (path) => (Array.isArray(path) ? path.map(String) : String(path).split(/[.[\]]/).filter(Boolean))

const isSafe = (path) => path.every((key) => !BLOCKED_KEYS.has(key))

export const get = (object, path, fallback) => {
  let current = object
  for (const key of toPath(path)) {
    if (current === null || current === undefined) return fallback
    current = current[key]
  }
  return current === undefined ? fallback : current
}

const has = (object, path) => {
  let current = object
  for (const key of toPath(path)) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return false
    current = current[key]
  }
  return true
}

function set(object, path, value) {
  const keys = toPath(path)
  if (!isSafe(keys) || keys.length === 0 || object === null || typeof object !== 'object') return object
  let current = object
  keys.slice(0, -1).forEach((key, index) => {
    if (current[key] === null || typeof current[key] !== 'object') current[key] = /^\d+$/.test(keys[index + 1]) ? [] : {}
    current = current[key]
  })
  current[keys[keys.length - 1]] = value
  return object
}

const isEqual = (first, second) => {
  if (first === second || (Number.isNaN(first) && Number.isNaN(second))) return true
  if (typeof first !== 'object' || typeof second !== 'object' || first === null || second === null) return false
  if (Array.isArray(first) !== Array.isArray(second)) return false
  const keys = Object.keys(first)
  return keys.length === Object.keys(second).length && keys.every((key) => Object.hasOwn(second, key) && isEqual(first[key], second[key]))
}

const cloneDeep = (value) => {
  if (Array.isArray(value)) return value.map(cloneDeep)
  if (value instanceof Date) return new Date(value.getTime())
  if (!isPlainObject(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, cloneDeep(inner)]))
}

const iteratee = (spec) => {
  if (typeof spec === 'function') return spec
  if (spec === undefined || spec === null) return (value) => value
  if (isPlainObject(spec)) return (value) => Object.entries(spec).every(([key, expected]) => isEqual(get(value, key), expected))
  if (Array.isArray(spec)) return (value) => isEqual(get(value, spec[0]), spec[1])
  return (value) => get(value, spec)
}

const entriesOf = (collection) => (Array.isArray(collection) ? collection.map((value, index) => [index, value]) : Object.entries(collection ?? {}))

const valuesOf = (collection) => (Array.isArray(collection) ? collection : Object.values(collection ?? {}))

const merge = (target, ...sources) => {
  sources.filter(isPlainObject).forEach((source) => {
    Object.entries(source).filter(([key]) => !BLOCKED_KEYS.has(key)).forEach(([key, value]) => {
      target[key] = isPlainObject(value) && isPlainObject(target[key]) ? merge(target[key], value) : cloneDeep(value)
    })
  })
  return target
}

const compare = (first, second) => {
  if (first === second) return 0
  return first < second ? -1 : 1
}

function orderBy(collection, specs = [], directions = []) {
  const getters = [].concat(specs).map(iteratee)
  const sign = (index) => (String([].concat(directions)[index] ?? 'asc').toLowerCase() === 'desc' ? -1 : 1)
  return [...valuesOf(collection)].sort((first, second) => {
    for (let index = 0; index < getters.length; index += 1) {
      const result = compare(getters[index](first), getters[index](second))
      if (result !== 0) return result * sign(index)
    }
    return 0
  })
}

const groupBy = (collection, spec) => valuesOf(collection).reduce((groups, value) => {
  const key = iteratee(spec)(value)
  const group = groups[key] ?? []
  group.push(value)
  groups[key] = group
  return groups
}, {})

const uniqBy = (collection, spec) => {
  const seen = []
  return valuesOf(collection).filter((value) => {
    const key = iteratee(spec)(value)
    if (seen.some((known) => isEqual(known, key))) return false
    seen.push(key)
    return true
  })
}

const flattenDeep = (items) => items.reduce((flat, item) => flat.concat(Array.isArray(item) ? flattenDeep(item) : [item]), [])

const words = (text) => String(text).match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+/g) ?? []

const capitalize = (text) => String(text).charAt(0).toUpperCase() + String(text).slice(1).toLowerCase()

const camelCase = (text) => words(text).map((word, index) => (index === 0 ? word.toLowerCase() : capitalize(word))).join('')

const sum = (values) => valuesOf(values).reduce((total, value) => total + value, 0)

const pick = (object, ...paths) => paths.flat().reduce((picked, path) => (has(object, path) ? set(picked, path, get(object, path)) : picked), {})

const omit = (object, ...paths) => {
  const dropped = new Set(paths.flat().map(String))
  return Object.fromEntries(Object.entries(object ?? {}).filter(([key]) => !dropped.has(key)))
}

const range = (start, end, step) => {
  const [from, to] = end === undefined ? [0, start] : [start, end]
  const stride = step ?? (from < to ? 1 : -1)
  if (stride === 0) return []
  const length = Math.max(Math.ceil((to - from) / stride), 0)
  return Array.from({ length }, (_, index) => from + index * stride)
}

export function createLodash() {
  const lodash = {
    get,
    has,
    set,
    isEqual,
    cloneDeep,
    merge,
    orderBy,
    groupBy,
    uniqBy,
    camelCase,
    capitalize,
    pick,
    omit,
    range,
    sum,
    keys: (object) => Object.keys(object ?? {}),
    values: (object) => Object.values(object ?? {}),
    toPairs: (object) => Object.entries(object ?? {}),
    fromPairs: (pairs) => Object.fromEntries(pairs),
    assign: Object.assign,
    isString: (value) => typeof value === 'string',
    isNumber: (value) => typeof value === 'number',
    isBoolean: (value) => typeof value === 'boolean',
    isFunction: (value) => typeof value === 'function',
    isArray: Array.isArray,
    isPlainObject,
    isObject: (value) => value !== null && (typeof value === 'object' || typeof value === 'function'),
    isNil: (value) => value === null || value === undefined,
    isNull: (value) => value === null,
    isUndefined: (value) => value === undefined,
    isEmpty: (value) => value === null || value === undefined || (typeof value === 'object' ? Object.keys(value).length === 0 : value.length === 0),
    map: (collection, spec) => valuesOf(collection).map(iteratee(spec)),
    filter: (collection, spec) => valuesOf(collection).filter(iteratee(spec)),
    reject: (collection, spec) => valuesOf(collection).filter((value) => !iteratee(spec)(value)),
    find: (collection, spec) => valuesOf(collection).find(iteratee(spec)),
    findIndex: (collection, spec) => valuesOf(collection).findIndex(iteratee(spec)),
    some: (collection, spec) => valuesOf(collection).some(iteratee(spec)),
    every: (collection, spec) => valuesOf(collection).every(iteratee(spec)),
    reduce: (collection, step, initial) => valuesOf(collection).reduce(step, initial),
    forEach: (collection, step) => {
      entriesOf(collection).forEach(([key, value]) => step(value, key))
      return collection
    },
    includes: (collection, value) => (typeof collection === 'string' ? collection.includes(value) : valuesOf(collection).some((item) => isEqual(item, value))),
    keyBy: (collection, spec) => Object.fromEntries(valuesOf(collection).map((value) => [iteratee(spec)(value), value])),
    countBy: (collection, spec) => valuesOf(collection).reduce((counts, value) => {
      const key = iteratee(spec)(value)
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {}),
    sortBy: (collection, specs) => orderBy(collection, specs),
    uniq: (collection) => uniqBy(collection),
    flatten: (items) => items.flat(),
    flattenDeep,
    compact: (items) => items.filter(Boolean),
    chunk: (items, size = 1) => Array.from({ length: Math.ceil(items.length / Math.max(size, 1)) }, (_, index) => items.slice(index * size, (index + 1) * size)),
    first: (items) => items?.[0],
    last: (items) => items?.[items.length - 1],
    take: (items, count = 1) => items.slice(0, Math.max(count, 0)),
    drop: (items, count = 1) => items.slice(Math.max(count, 0)),
    difference: (items, ...others) => items.filter((item) => !others.flat().some((other) => isEqual(item, other))),
    intersection: (items, ...others) => uniqBy(items.filter((item) => others.every((other) => other.some((candidate) => isEqual(item, candidate))))),
    union: (...lists) => uniqBy(lists.flat()),
    zip: (...lists) => Array.from({ length: Math.max(0, ...lists.map((list) => list.length)) }, (_, index) => lists.map((list) => list[index])),
    sumBy: (collection, spec) => sum(valuesOf(collection).map(iteratee(spec))),
    mean: (values) => sum(values) / valuesOf(values).length,
    min: (values) => (valuesOf(values).length ? Math.min(...valuesOf(values)) : undefined),
    max: (values) => (valuesOf(values).length ? Math.max(...valuesOf(values)) : undefined),
    minBy: (collection, spec) => orderBy(collection, spec)[0],
    maxBy: (collection, spec) => orderBy(collection, spec, 'desc')[0],
    times: (count, step = (index) => index) => Array.from({ length: Math.max(count, 0) }, (_, index) => step(index)),
    random: (low = 0, high = 1) => low + Math.floor(Math.random() * (high - low + 1)),
    snakeCase: (text) => words(text).map((word) => word.toLowerCase()).join('_'),
    kebabCase: (text) => words(text).map((word) => word.toLowerCase()).join('-'),
    upperFirst: (text) => String(text).charAt(0).toUpperCase() + String(text).slice(1),
    trim: (text) => String(text).trim(),
    identity: (value) => value,
    noop: () => undefined,
  }
  return lodash
}
