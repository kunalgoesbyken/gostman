import { SCHEMA_TEXT } from './checksText'
import { isPlainObject, lookup, parseJSON } from './dataUtils'
import { FORMAT_CHECKS } from './schemaFormats'

const MAX_DEPTH = 96
const MAX_SHOWN = 20
const FRACTION_TOLERANCE = 1e-9
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const NUMBER_LIMITS = [
  ['minimum', 'exclusiveMinimum', (value, limit) => value < limit, (value, limit) => value <= limit],
  ['maximum', 'exclusiveMaximum', (value, limit) => value > limit, (value, limit) => value >= limit],
]

const TYPE_CHECKS = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  integer: (value) => Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  null: (value) => value === null,
  array: Array.isArray,
  object: isPlainObject,
}

export const isSchemaType = (type) => Object.hasOwn(TYPE_CHECKS, type)

function isEqual(first, second) {
  if (first === second) return true
  if (Array.isArray(first) && Array.isArray(second)) {
    return first.length === second.length && first.every((item, index) => isEqual(item, second[index]))
  }
  if (!isPlainObject(first) || !isPlainObject(second)) return false
  const keys = Object.keys(first)
  return keys.length === Object.keys(second).length && keys.every((key) => Object.hasOwn(second, key) && isEqual(first[key], second[key]))
}

function decodeToken(token) {
  try {
    return decodeURIComponent(token)
  } catch {
    return token
  }
}

const unescapeToken = (token) => decodeToken(token).replaceAll('~1', '/').replaceAll('~0', '~')

function resolveReference(root, reference) {
  if (!reference.startsWith('#')) throw new Error(SCHEMA_TEXT.external(reference))
  const pointer = reference.slice(1)
  if (pointer !== '' && !pointer.startsWith('/')) throw new Error(SCHEMA_TEXT.unresolved(reference))
  const tokens = pointer.split('/').slice(1).map(unescapeToken)
  const target = tokens.reduce((node, token) => (node !== null && typeof node === 'object' && Object.hasOwn(node, token) ? node[token] : undefined), root)
  if (target === undefined) throw new Error(SCHEMA_TEXT.unresolved(reference))
  return target
}

function patternOf(pattern) {
  try {
    return new RegExp(pattern, 'u')
  } catch {
    throw new Error(SCHEMA_TEXT.badPattern(pattern))
  }
}

const problem = (path, keyword, params = {}) => ({ path, keyword, params })

const isNullable = (schema) => schema.nullable === true || schema['x-nullable'] === true

function checkType(schema, data, path) {
  if (schema.type === undefined) return []
  const expected = [].concat(schema.type)
  return expected.some((type) => lookup(TYPE_CHECKS, type)?.(data)) ? [] : [problem(path, 'type', { expected, actual: data })]
}

function checkValue(schema, data, path) {
  const found = []
  if (Array.isArray(schema.enum) && !schema.enum.some((item) => isEqual(item, data))) found.push(problem(path, 'enum', { allowed: schema.enum, actual: data }))
  if (Object.hasOwn(schema, 'const') && !isEqual(schema.const, data)) found.push(problem(path, 'const', { expected: schema.const, actual: data }))
  return found
}

function checkNumber(schema, data, path) {
  if (typeof data !== 'number') return []
  const found = []
  for (const [inclusive, exclusive, below, atOrBelow] of NUMBER_LIMITS) {
    const legacyExclusive = schema[exclusive] === true
    if (typeof schema[inclusive] === 'number' && (legacyExclusive ? atOrBelow(data, schema[inclusive]) : below(data, schema[inclusive]))) {
      found.push(problem(path, legacyExclusive ? exclusive : inclusive, { limit: schema[inclusive], actual: data }))
    }
    if (typeof schema[exclusive] === 'number' && atOrBelow(data, schema[exclusive])) found.push(problem(path, exclusive, { limit: schema[exclusive], actual: data }))
  }
  if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) {
    const quotient = data / schema.multipleOf
    if (Math.abs(quotient - Math.round(quotient)) > FRACTION_TOLERANCE) found.push(problem(path, 'multipleOf', { limit: schema.multipleOf, actual: data }))
  }
  return found
}

function checkString(schema, data, path) {
  if (typeof data !== 'string') return []
  const found = []
  const length = [...data].length
  if (typeof schema.minLength === 'number' && length < schema.minLength) found.push(problem(path, 'minLength', { limit: schema.minLength, actual: length }))
  if (typeof schema.maxLength === 'number' && length > schema.maxLength) found.push(problem(path, 'maxLength', { limit: schema.maxLength, actual: length }))
  if (typeof schema.pattern === 'string' && !patternOf(schema.pattern).test(data)) found.push(problem(path, 'pattern', { pattern: schema.pattern, actual: data }))
  const format = lookup(FORMAT_CHECKS, schema.format)
  if (format && !format(data)) found.push(problem(path, 'format', { format: schema.format, actual: data }))
  return found
}

function firstRepeat(items) {
  for (let second = 1; second < items.length; second += 1) {
    const first = items.findIndex((item, index) => index < second && isEqual(item, items[second]))
    if (first >= 0) return [first, second]
  }
  return null
}

function checkArray(schema, data, path, inner) {
  if (!Array.isArray(data)) return []
  const found = []
  const prefix = Array.isArray(schema.prefixItems) ? schema.prefixItems : (Array.isArray(schema.items) ? schema.items : [])
  const rest = Array.isArray(schema.items) ? schema.additionalItems : schema.items
  data.forEach((item, index) => {
    const itemSchema = index < prefix.length ? prefix[index] : rest
    if (itemSchema !== undefined) found.push(...inner(itemSchema, item, [...path, index]))
  })
  if (typeof schema.minItems === 'number' && data.length < schema.minItems) found.push(problem(path, 'minItems', { limit: schema.minItems, actual: data.length }))
  if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) found.push(problem(path, 'maxItems', { limit: schema.maxItems, actual: data.length }))
  const repeat = schema.uniqueItems === true ? firstRepeat(data) : null
  if (repeat) found.push(problem(path, 'uniqueItems', { first: repeat[0], second: repeat[1] }))
  if (schema.contains !== undefined) {
    const matching = data.filter((item, index) => inner(schema.contains, item, [...path, index]).length === 0).length
    const least = typeof schema.minContains === 'number' ? schema.minContains : 1
    if (matching < least) found.push(problem(path, 'contains', { limit: least }))
    if (typeof schema.maxContains === 'number' && matching > schema.maxContains) found.push(problem(path, 'maxContains', { limit: schema.maxContains }))
  }
  return found
}

function requiredBy(schema, data) {
  const required = Array.isArray(schema.required) ? schema.required : []
  const dependent = { ...(isPlainObject(schema.dependencies) ? schema.dependencies : {}), ...(isPlainObject(schema.dependentRequired) ? schema.dependentRequired : {}) }
  const pairs = Object.entries(dependent)
    .filter(([present, needed]) => Object.hasOwn(data, present) && Array.isArray(needed))
    .flatMap(([present, needed]) => needed.map((name) => [present, name]))
  return { required, pairs }
}

const dependentSchemasOf = (schema) => ({
  ...(isPlainObject(schema.dependencies) ? schema.dependencies : {}),
  ...(isPlainObject(schema.dependentSchemas) ? schema.dependentSchemas : {}),
})

function checkObject(schema, data, path, inner, isWriteOnly) {
  if (!isPlainObject(data)) return []
  const found = []
  const keys = Object.keys(data)
  const { required, pairs } = requiredBy(schema, data)
  required.filter((key) => !Object.hasOwn(data, key) && !isWriteOnly(key)).forEach((key) => found.push(problem([...path, key], 'required')))
  pairs.filter(([, needed]) => !Object.hasOwn(data, needed)).forEach(([present, needed]) => found.push(problem(path, 'dependentRequired', { present, needed })))
  const properties = isPlainObject(schema.properties) ? schema.properties : {}
  const patterns = Object.entries(isPlainObject(schema.patternProperties) ? schema.patternProperties : {}).map(([pattern, patternSchema]) => [patternOf(pattern), patternSchema])
  keys.forEach((key) => {
    const at = [...path, key]
    if (Object.hasOwn(properties, key)) found.push(...inner(properties[key], data[key], at))
    const matched = patterns.filter(([pattern]) => pattern.test(key))
    matched.forEach(([, patternSchema]) => found.push(...inner(patternSchema, data[key], at)))
    if (Object.hasOwn(properties, key) || matched.length > 0 || schema.additionalProperties === undefined) return
    if (schema.additionalProperties === false) found.push(problem(at, 'additionalProperties'))
    else found.push(...inner(schema.additionalProperties, data[key], at))
  })
  if (schema.propertyNames !== undefined) {
    keys.filter((key) => inner(schema.propertyNames, key, path).length > 0).forEach((key) => found.push(problem(path, 'propertyNames', { name: key })))
  }
  Object.entries(dependentSchemasOf(schema))
    .filter(([key, dependent]) => Object.hasOwn(data, key) && !Array.isArray(dependent))
    .forEach(([, dependent]) => found.push(...inner(dependent, data, path)))
  if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties) found.push(problem(path, 'minProperties', { limit: schema.minProperties, actual: keys.length }))
  if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) found.push(problem(path, 'maxProperties', { limit: schema.maxProperties, actual: keys.length }))
  return found
}

const samePath = (first, second) => first.length === second.length && first.every((segment, index) => segment === second[index])

function unmatched(keyword, path, branches, data) {
  const onlyTypes = branches.every((found) => found.length === 1 && found[0].keyword === 'type' && samePath(found[0].path, path))
  if (onlyTypes) return [problem(path, 'type', { expected: [...new Set(branches.flatMap((found) => found[0].params.expected))], actual: data })]
  const closest = branches.reduce((best, found) => (found.length < best.length ? found : best))
  return [problem(path, keyword), ...closest]
}

function checkAlternatives(schema, data, path, inner, chosen) {
  if (chosen) return inner(chosen, data, path)
  const found = []
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const branches = schema.anyOf.map((part) => inner(part, data, path))
    if (!branches.some((branch) => branch.length === 0)) found.push(...unmatched('anyOf', path, branches, data))
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const branches = schema.oneOf.map((part) => inner(part, data, path))
    const passing = branches.filter((branch) => branch.length === 0).length
    if (passing === 0) found.push(...unmatched('oneOf', path, branches, data))
    if (passing > 1) found.push(problem(path, 'oneOfMany', { count: passing }))
  }
  return found
}

function checkCombinators(schema, data, path, inner, chosen) {
  const found = []
  if (Array.isArray(schema.allOf)) schema.allOf.forEach((part) => found.push(...inner(part, data, path)))
  found.push(...checkAlternatives(schema, data, path, inner, chosen))
  if (schema.not !== undefined && inner(schema.not, data, path).length === 0) found.push(problem(path, 'not'))
  if (schema.if !== undefined) {
    const branch = inner(schema.if, data, path).length === 0 ? schema.then : schema.else
    if (branch !== undefined) found.push(...inner(branch, data, path))
  }
  return found
}

function referenced(root, schema) {
  if (!isPlainObject(schema) || typeof schema.$ref !== 'string') return schema
  try {
    return resolveReference(root, schema.$ref)
  } catch {
    return schema
  }
}

function writeOnlyCheck(context, schema) {
  if (!context.isResponse || !isPlainObject(schema.properties)) return () => false
  return (key) => [lookup(schema.properties, key), referenced(context.root, lookup(schema.properties, key))]
    .some((property) => isPlainObject(property) && property.writeOnly === true)
}

const refName = (reference) => reference.split('/').pop()

function discriminatedBranch(context, schema, data) {
  const propertyName = schema.discriminator?.propertyName
  if (!context.isResponse || typeof propertyName !== 'string' || !isPlainObject(data) || typeof data[propertyName] !== 'string') return null
  const value = data[propertyName]
  const mapping = isPlainObject(schema.discriminator.mapping) ? schema.discriminator.mapping : {}
  const target = lookup(mapping, value)
  const branches = [schema.oneOf, schema.anyOf].filter(Array.isArray).flat()
  const matches = (branch) => isPlainObject(branch) && typeof branch.$ref === 'string' && (target ? branch.$ref === target : refName(branch.$ref) === value)
  return branches.find(matches) ?? (typeof target === 'string' ? { $ref: target } : null)
}

function validate(context, schema, data, path, depth) {
  if (depth > MAX_DEPTH) throw new Error(SCHEMA_TEXT.tooDeep)
  if (schema === true || schema === undefined || schema === null) return []
  if (schema === false) return [problem(path, 'false')]
  if (!isPlainObject(schema)) throw new Error(SCHEMA_TEXT.notSchema)
  if (data === null && isNullable(schema)) return []
  const inner = (part, value, at) => validate(context, part, value, at, depth + 1)
  return [
    ...(typeof schema.$ref === 'string' ? inner(resolveReference(context.root, schema.$ref), data, path) : []),
    ...checkType(schema, data, path),
    ...checkValue(schema, data, path),
    ...checkNumber(schema, data, path),
    ...checkString(schema, data, path),
    ...checkArray(schema, data, path, inner),
    ...checkObject(schema, data, path, inner, writeOnlyCheck(context, schema)),
    ...checkCombinators(schema, data, path, inner, discriminatedBranch(context, schema, data)),
  ]
}

function readSchema(value) {
  if (typeof value !== 'string') return value
  const parsed = parseJSON(value, null)
  if (!isPlainObject(parsed) && typeof parsed !== 'boolean') throw new Error(SCHEMA_TEXT.notJson)
  return parsed
}

export function schemaText(value, indent) {
  const parsed = parseJSON(value, null)
  return isPlainObject(parsed) || typeof parsed === 'boolean' ? JSON.stringify(parsed, null, indent) : value.trim()
}

export function schemaErrors(schema, data, root, isResponse = false) {
  const parsed = readSchema(schema)
  return validate({ root: root ?? parsed, isResponse }, parsed, data, [], 0)
}

const segmentText = (segment) => {
  if (typeof segment === 'number') return `[${segment}]`
  return IDENTIFIER.test(segment) ? `.${segment}` : `[${JSON.stringify(segment)}]`
}

const formatPath = (path) => (path.length === 0 ? SCHEMA_TEXT.root : `$${path.map(segmentText).join('')}`)

const DESCRIPTIONS = {
  type: (where, { expected, actual }) => SCHEMA_TEXT.type(where, expected, actual),
  enum: (where, { allowed, actual }) => SCHEMA_TEXT.enum(where, allowed, actual),
  const: (where, { expected, actual }) => SCHEMA_TEXT.const(where, expected, actual),
  pattern: (where, { pattern, actual }) => SCHEMA_TEXT.pattern(where, pattern, actual),
  format: (where, { format, actual }) => SCHEMA_TEXT.format(where, format, actual),
  uniqueItems: (where, { first, second }) => SCHEMA_TEXT.uniqueItems(where, first, second),
  dependentRequired: (where, { present, needed }) => SCHEMA_TEXT.dependentRequired(where, present, needed),
  propertyNames: (where, { name }) => SCHEMA_TEXT.propertyNames(where, name),
  oneOfMany: (where, { count }) => SCHEMA_TEXT.oneOfMany(where, count),
}

const describeLimit = (keyword) => (where, { limit, actual }) => SCHEMA_TEXT[keyword](where, limit, actual)

function describeProblem({ path, keyword, params }) {
  return (DESCRIPTIONS[keyword] ?? describeLimit(keyword))(formatPath(path), params)
}

function describeSchemaErrors(errors) {
  const lines = errors.slice(0, MAX_SHOWN).map(describeProblem)
  return errors.length > MAX_SHOWN ? [...lines, SCHEMA_TEXT.more(errors.length - MAX_SHOWN)] : lines
}

export const schemaMismatches = (schema, data, root, isResponse) => describeSchemaErrors(schemaErrors(schema, data, root, isResponse))
