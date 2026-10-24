import { schemaErrors } from '../../jsonSchema'

const FIELD_KEYWORDS = ['required', 'additionalProperties']

const pointerOf = (path) => path.map((segment) => `/${String(segment).replaceAll('~', '~0').replaceAll('/', '~1')}`).join('')

const AJV_ERRORS = {
  type: ({ expected }) => [`must be ${expected.join(',')}`, { type: expected.length === 1 ? expected[0] : expected }],
  enum: ({ allowed }) => ['must be equal to one of the allowed values', { allowedValues: allowed }],
  const: ({ expected }) => ['must be equal to constant', { allowedValue: expected }],
  minimum: ({ limit }) => [`must be >= ${limit}`, { comparison: '>=', limit }],
  maximum: ({ limit }) => [`must be <= ${limit}`, { comparison: '<=', limit }],
  exclusiveMinimum: ({ limit }) => [`must be > ${limit}`, { comparison: '>', limit }],
  exclusiveMaximum: ({ limit }) => [`must be < ${limit}`, { comparison: '<', limit }],
  multipleOf: ({ limit }) => [`must be multiple of ${limit}`, { multipleOf: limit }],
  minLength: ({ limit }) => [`must NOT have fewer than ${limit} characters`, { limit }],
  maxLength: ({ limit }) => [`must NOT have more than ${limit} characters`, { limit }],
  pattern: ({ pattern }) => [`must match pattern "${pattern}"`, { pattern }],
  format: ({ format }) => [`must match format "${format}"`, { format }],
  minItems: ({ limit }) => [`must NOT have fewer than ${limit} items`, { limit }],
  maxItems: ({ limit }) => [`must NOT have more than ${limit} items`, { limit }],
  uniqueItems: ({ first, second }) => [`must NOT have duplicate items (items ## ${second} and ${first} are identical)`, { i: second, j: first }],
  contains: ({ limit }) => [`must contain at least ${limit} valid item(s)`, { minContains: limit }],
  maxContains: ({ limit }) => [`must contain at most ${limit} valid item(s)`, { maxContains: limit }],
  minProperties: ({ limit }) => [`must NOT have fewer than ${limit} properties`, { limit }],
  maxProperties: ({ limit }) => [`must NOT have more than ${limit} properties`, { limit }],
  dependentRequired: ({ present, needed }) => [`must have property ${needed} when property ${present} is present`, { property: present, missingProperty: needed }],
  propertyNames: ({ name }) => ['property name must be valid', { propertyName: name }],
  required: (_, key) => [`must have required property '${key}'`, { missingProperty: key }],
  additionalProperties: (_, key) => ['must NOT have additional properties', { additionalProperty: key }],
  anyOf: () => ['must match a schema in anyOf', {}],
  oneOf: () => ['must match exactly one schema in oneOf', { passingSchemas: null }],
  oneOfMany: ({ count }) => ['must match exactly one schema in oneOf', { passingSchemas: count }],
  not: () => ['must NOT be valid', {}],
  false: () => ['boolean schema is false', {}],
}

function toAjvError({ path, keyword, params }) {
  const isField = FIELD_KEYWORDS.includes(keyword)
  const where = isField ? path.slice(0, -1) : path
  const [message, details] = AJV_ERRORS[keyword](params, path[path.length - 1])
  return { instancePath: pointerOf(where), keyword: keyword === 'oneOfMany' ? 'oneOf' : keyword, message, params: details }
}

export function createAjv() {
  class Ajv {
    compile(schema) {
      const validate = (data) => {
        const errors = schemaErrors(schema, data).map(toAjvError)
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
