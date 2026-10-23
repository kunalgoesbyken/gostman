const keyOf = (item) => (typeof item === 'object' && item !== null ? item.key : item)

export function createPropertyList({ read, sameKey, format, separator }) {
  const all = () => read().map((item) => ({ ...item }))
  const one = (key) => all().find((item) => sameKey(item.key, keyOf(key)))
  return {
    all,
    one,
    get: (key) => one(key)?.value,
    has: (key, value) => {
      const found = one(key)
      return Boolean(found) && (value === undefined || found.value === value)
    },
    count: () => read().length,
    idx: (index) => all()[index],
    indexOf: (item) => read().findIndex((entry) => sameKey(entry.key, keyOf(item))),
    each: (visit) => all().forEach(visit),
    find: (test) => all().find(test),
    filter: (test) => all().filter(test),
    map: (transform) => all().map(transform),
    reduce: (combine, initial) => all().reduce(combine, initial),
    toObject: () => Object.fromEntries(read().map(({ key, value }) => [key, value])),
    toString: () => read().map(format).join(separator),
    toJSON: all,
  }
}

const sameHeader = (first, second) => String(first).toLowerCase() === String(second).toLowerCase()

const HEADER_PAIR = ': '

export const headerEntries = (headers) => Object.entries(headers).map(([key, value]) => ({ key, value }))

export function createHeaderList(readHeaders) {
  return createPropertyList({
    read: () => headerEntries(readHeaders()),
    sameKey: sameHeader,
    format: ({ key, value }) => `${key}${HEADER_PAIR}${value}`,
    separator: '\n',
  })
}

function headerPair(nameOrItem, value) {
  if (typeof nameOrItem === 'object' && nameOrItem !== null) return [nameOrItem.key, nameOrItem.value]
  if (value !== undefined || !String(nameOrItem).includes(':')) return [nameOrItem, value]
  const text = String(nameOrItem)
  const split = text.indexOf(':')
  return [text.slice(0, split).trim(), text.slice(split + 1).trim()]
}

export function createEditableHeaderList(readHeaders, { setHeader, deleteHeader }) {
  const list = createHeaderList(readHeaders)
  const keys = () => Object.keys(readHeaders())
  const remove = (target) => {
    const matches = typeof target === 'function'
      ? (key) => target({ key, value: readHeaders()[key] })
      : (key) => sameHeader(key, keyOf(target))
    keys().filter(matches).forEach(deleteHeader)
  }
  return {
    ...list,
    add: (nameOrItem, value) => setHeader(...headerPair(nameOrItem, value)),
    upsert: (nameOrItem, value) => {
      if (nameOrItem === null || nameOrItem === undefined) return null
      const [name, text] = headerPair(nameOrItem, value)
      const added = !list.has(name)
      setHeader(name, text)
      return added
    },
    remove,
    clear: () => keys().forEach(deleteHeader),
  }
}
