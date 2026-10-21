import { isPlainObject } from '../../dataUtils'

const MAX_DEPTH = 64

const TYPE_CHECKS = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  integer: (value) => Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  null: (value) => value === null,
  array: Array.isArray,
  object: isPlainObject,
}

const FORMAT_CHECKS = {
  email: (value) => value.includes('@') && !value.startsWith('@') && !value.endsWith('@'),
  uuid: (value) => value.length === 36 && value.split('-').map((part) => part.length).join() === '8,4,4,4,12',
  'date-time': (value) => value.includes('T') && !Number.isNaN(Date.parse(value)),
  date: (value) => value.length === 10 && !Number.isNaN(Date.parse(value)),
  uri: (value) => value.includes(':'),
}

const sameValue = (first, second) => JSON.stringify(first) === JSON.stringify(second)

function resolveReference(root, reference) {
  if (!reference.startsWith('#')) throw new Error(`Only local references are supported, not "${reference}".`)
  return reference.slice(1).split('/').filter(Boolean).reduce((node, key) => node?.[decodeURIComponent(key).replaceAll('~1', '/').replaceAll('~0', '~')], root)
}

function check(root, schema, data, path, errors, depth) {
  if (depth > MAX_DEPTH) throw new Error('The schema nests or references itself too deeply.')
  if (schema === true || schema === undefined) return
  if (schema === false) {
    errors.push(failure(path, 'false', 'boolean schema is false'))
    return
  }
  if (!isPlainObject(schema)) throw new Error('A schema must be an object or a boolean.')
  const fail = (keyword, message, params = {}) => errors.push(failure(path, keyword, message, params))
  const descend = (inner, value, innerPath) => check(root, inner, value, innerPath, errors, depth + 1)

  if (schema.$ref !== undefined) descend(resolveReference(root, schema.$ref), data, path)
  checkTypes(schema, data, fail)
  if (schema.enum !== undefined && !schema.enum.some((item) => sameValue(item, data))) fail('enum', 'must be equal to one of the allowed values', { allowedValues: schema.enum })
  if ('const' in schema && !sameValue(schema.const, data)) fail('const', 'must be equal to constant', { allowedValue: schema.const })
  checkNumber(schema, data, fail)
  checkString(schema, data, fail)
  if (Array.isArray(data)) checkArray(schema, data, path, fail, descend)
  if (isPlainObject(data)) checkObject(schema, data, path, fail, descend)
  checkCombinators(schema, data, path, fail, (inner) => {
    const found = []
    check(root, inner, data, path, found, depth + 1)
    return found
  })
}

const failure = (path, keyword, message, params = {}) => ({ instancePath: path, keyword, message, params })

function checkTypes(schema, data, fail) {
  if (schema.type === undefined) return
  const types = [].concat(schema.type)
  if (!types.some((type) => TYPE_CHECKS[type]?.(data))) fail('type', `must be ${types.join(',')}`, { type: schema.type })
}

function checkNumber(schema, data, fail) {
  if (typeof data !== 'number') return
  if (schema.minimum !== undefined && data < schema.minimum) fail('minimum', `must be >= ${schema.minimum}`, { limit: schema.minimum })
  if (schema.maximum !== undefined && data > schema.maximum) fail('maximum', `must be <= ${schema.maximum}`, { limit: schema.maximum })
  if (typeof schema.exclusiveMinimum === 'number' && data <= schema.exclusiveMinimum) fail('exclusiveMinimum', `must be > ${schema.exclusiveMinimum}`)
  if (typeof schema.exclusiveMaximum === 'number' && data >= schema.exclusiveMaximum) fail('exclusiveMaximum', `must be < ${schema.exclusiveMaximum}`)
  if (schema.multipleOf !== undefined && data % schema.multipleOf !== 0) fail('multipleOf', `must be multiple of ${schema.multipleOf}`)
}

function checkString(schema, data, fail) {
  if (typeof data !== 'string') return
  if (schema.minLength !== undefined && [...data].length < schema.minLength) fail('minLength', `must NOT have fewer than ${schema.minLength} characters`)
  if (schema.maxLength !== undefined && [...data].length > schema.maxLength) fail('maxLength', `must NOT have more than ${schema.maxLength} characters`)
  if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(data)) fail('pattern', `must match pattern "${schema.pattern}"`)
  if (schema.format !== undefined && FORMAT_CHECKS[schema.format] && !FORMAT_CHECKS[schema.format](data)) fail('format', `must match format "${schema.format}"`)
}

function checkArray(schema, data, path, fail, descend) {
  if (schema.minItems !== undefined && data.length < schema.minItems) fail('minItems', `must NOT have fewer than ${schema.minItems} items`)
  if (schema.maxItems !== undefined && data.length > schema.maxItems) fail('maxItems', `must NOT have more than ${schema.maxItems} items`)
  if (schema.uniqueItems && data.some((item, index) => data.findIndex((other) => sameValue(item, other)) !== index)) fail('uniqueItems', 'must NOT have duplicate items')
  if (Array.isArray(schema.items)) data.forEach((item, index) => descend(schema.items[index], item, `${path}/${index}`))
  else if (schema.items !== undefined) data.forEach((item, index) => descend(schema.items, item, `${path}/${index}`))
}

function checkObject(schema, data, path, fail, descend) {
  const known = schema.properties ?? {}
  ;(schema.required ?? []).filter((key) => !Object.hasOwn(data, key)).forEach((key) => fail('required', `must have required property '${key}'`, { missingProperty: key }))
  Object.entries(known).filter(([key]) => Object.hasOwn(data, key)).forEach(([key, inner]) => descend(inner, data[key], `${path}/${key}`))
  const extra = Object.keys(data).filter((key) => !Object.hasOwn(known, key))
  if (schema.additionalProperties === false) extra.forEach((key) => fail('additionalProperties', 'must NOT have additional properties', { additionalProperty: key }))
  else if (isPlainObject(schema.additionalProperties)) extra.forEach((key) => descend(schema.additionalProperties, data[key], `${path}/${key}`))
}

function checkCombinators(schema, data, path, fail, attempt) {
  if (schema.allOf) schema.allOf.forEach((inner) => attempt(inner).forEach((error) => fail(error.keyword, error.message, error.params)))
  if (schema.anyOf && !schema.anyOf.some((inner) => attempt(inner).length === 0)) fail('anyOf', 'must match a schema in anyOf')
  if (schema.oneOf && schema.oneOf.filter((inner) => attempt(inner).length === 0).length !== 1) fail('oneOf', 'must match exactly one schema in oneOf')
  if (schema.not !== undefined && attempt(schema.not).length === 0) fail('not', 'must NOT be valid')
}

export function createAjv() {
  class Ajv {
    compile(schema) {
      const validate = (data) => {
        const errors = []
        check(schema, schema, data, '', errors, 0)
        validate.errors = errors.length > 0 ? errors : null
        return errors.length === 0
      }
      validate.errors = null
      validate.schema = schema
      return validate
    }

    validate(schema, data) {
      return this.compile(schema)(data)
    }

    errorsText(errors, { separator = ', ', dataVar = 'data' } = {}) {
      return (errors ?? []).map((error) => `${dataVar}${error.instancePath} ${error.message}`).join(separator)
    }
  }
  return Ajv
}
