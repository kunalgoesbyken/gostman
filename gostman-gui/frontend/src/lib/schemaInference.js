import { isPlainObject, lookup } from './dataUtils'

const MAX_DEPTH = 32
const MAX_ITEMS = 100
const NULL_TYPE = 'null'

const typeOf = (value) => {
  if (value === null) return NULL_TYPE
  if (Array.isArray(value)) return 'array'
  return isPlainObject(value) ? 'object' : typeof value
}

function mergeProperties(first, second) {
  if (!first || !second) return first || second
  const keys = [...new Set([...Object.keys(first.properties), ...Object.keys(second.properties)])]
  return {
    properties: Object.fromEntries(keys.map((key) => [key, merge(lookup(first.properties, key), lookup(second.properties, key))])),
    required: first.required.filter((key) => second.required.includes(key)),
  }
}

function merge(first, second) {
  if (!first || !second) return first || second
  return {
    types: [...new Set([...first.types, ...second.types])],
    shape: mergeProperties(first.shape, second.shape),
    items: merge(first.items, second.items),
  }
}

function infer(value, depth) {
  const type = typeOf(value)
  const node = { types: [type], shape: null, items: null }
  if (depth >= MAX_DEPTH) return node
  if (type === 'array') {
    return { ...node, items: value.slice(0, MAX_ITEMS).map((item) => infer(item, depth + 1)).reduce(merge, null) }
  }
  if (type === 'object') {
    const keys = Object.keys(value)
    return { ...node, shape: { properties: Object.fromEntries(keys.map((key) => [key, infer(value[key], depth + 1)])), required: keys } }
  }
  return node
}

function toSchema(node) {
  const known = node.types.filter((type) => type !== NULL_TYPE)
  if (known.length === 0) return {}
  const types = known.length === node.types.length ? known : [...known, NULL_TYPE]
  const schema = { type: types.length === 1 ? types[0] : types }
  if (node.shape) {
    schema.properties = Object.fromEntries(Object.entries(node.shape.properties).map(([key, inner]) => [key, toSchema(inner)]))
    if (node.shape.required.length > 0) schema.required = node.shape.required
  }
  if (node.items) schema.items = toSchema(node.items)
  return schema
}

export const inferSchema = (value) => toSchema(infer(value, 0))
