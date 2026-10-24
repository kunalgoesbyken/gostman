import { JSONPath } from 'jsonpath-plus'
import { isPlainObject, parseJSON } from '../dataUtils'
import { substitutePlaceholders, variableMap } from '../placeholders'

const isPrimitive = (value) => value === null || typeof value !== 'object'

const sameValue = (actual, expected) => (
  isPrimitive(actual) && isPrimitive(expected)
    ? String(actual) === String(expected)
    : JSON.stringify(actual) === JSON.stringify(expected)
)

const includes = (actual, expected) => (
  Array.isArray(actual) ? actual.some((item) => sameValue(item, expected)) : String(actual).includes(String(expected))
)

const sizeOf = (value) => (isPlainObject(value) ? Object.keys(value).length : value?.length)

const isEmpty = (value) => value === null || value === undefined || sizeOf(value) === 0

const asList = (expected) => (Array.isArray(expected) ? expected : String(expected).split(',').map((item) => item.trim()))

const compare = (accepts) => (actual, expected) => (
  !Number.isNaN(Number(actual)) && !Number.isNaN(Number(expected)) && accepts(Number(actual), Number(expected))
)

export const OPERATORS = [
  { value: 'eq', label: 'equals', test: sameValue },
  { value: 'neq', label: 'does not equal', test: (actual, expected) => !sameValue(actual, expected) },
  { value: 'gt', label: 'is greater than', test: compare((actual, expected) => actual > expected) },
  { value: 'gte', label: 'is at least', test: compare((actual, expected) => actual >= expected) },
  { value: 'lt', label: 'is less than', test: compare((actual, expected) => actual < expected) },
  { value: 'lte', label: 'is at most', test: compare((actual, expected) => actual <= expected) },
  { value: 'contains', label: 'contains', test: includes },
  { value: 'notContains', label: 'does not contain', test: (actual, expected) => !includes(actual, expected) },
  { value: 'startsWith', label: 'starts with', test: (actual, expected) => String(actual).startsWith(String(expected)) },
  { value: 'endsWith', label: 'ends with', test: (actual, expected) => String(actual).endsWith(String(expected)) },
  { value: 'matches', label: 'matches regex', test: (actual, expected) => new RegExp(String(expected)).test(String(actual)) },
  { value: 'in', label: 'is one of', test: (actual, expected) => asList(expected).some((item) => sameValue(actual, item)) },
  { value: 'length', label: 'has length', test: (actual, expected) => sameValue(sizeOf(actual), expected) },
  { value: 'isDefined', label: 'is defined', unary: true, test: (actual) => actual !== undefined },
  { value: 'isUndefined', label: 'is undefined', unary: true, test: (actual) => actual === undefined },
  { value: 'isNull', label: 'is null', unary: true, test: (actual) => actual === null },
  { value: 'isEmpty', label: 'is empty', unary: true, test: isEmpty },
  { value: 'isNotEmpty', label: 'is not empty', unary: true, test: (actual) => !isEmpty(actual) },
  { value: 'isTrue', label: 'is true', unary: true, test: (actual) => actual === true },
  { value: 'isFalse', label: 'is false', unary: true, test: (actual) => actual === false },
  { value: 'isNumber', label: 'is a number', unary: true, test: (actual) => typeof actual === 'number' },
  { value: 'isString', label: 'is a string', unary: true, test: (actual) => typeof actual === 'string' },
  { value: 'isBoolean', label: 'is a boolean', unary: true, test: (actual) => typeof actual === 'boolean' },
  { value: 'isArray', label: 'is an array', unary: true, test: Array.isArray },
  { value: 'isObject', label: 'is an object', unary: true, test: isPlainObject },
]

const DEFAULT_OPERATOR = OPERATORS[0]

export const BLANK_ASSERTION = { expression: '', operator: DEFAULT_OPERATOR.value, value: '', enabled: true }

const OPERATOR_NAMES = OPERATORS.map((operator) => operator.value).join(', ')

const unknownOperator = (name) => ({
  value: name,
  label: name,
  test: () => {
    throw new Error(`"${name}" is not a check. Use one of: ${OPERATOR_NAMES}`)
  },
})

export const operatorOf = (assertion) => (
  assertion.operator
    ? OPERATORS.find((operator) => operator.value === assertion.operator) || unknownOperator(assertion.operator)
    : DEFAULT_OPERATOR
)

const asText = (value) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

const toAssertion = (raw) => ({
  expression: asText(raw.expression),
  operator: asText(raw.operator) || DEFAULT_OPERATOR.value,
  value: asText(raw.value),
  enabled: raw.enabled !== false,
})

export function parseAssertions(json) {
  const parsed = parseJSON(json, [])
  return Array.isArray(parsed) ? parsed.filter(isPlainObject).map(toAssertion) : []
}

export const serializeAssertions = (assertions) => (assertions.length > 0 ? JSON.stringify(assertions) : '')

export const isBlankAssertion = (assertion) => (
  assertion.expression === '' && assertion.value === '' && assertion.operator === DEFAULT_OPERATOR.value
)

export const countActiveAssertions = (json) => (
  parseAssertions(json).filter((assertion) => assertion.enabled && assertion.expression.trim() !== '').length
)

const describe = (value) => (value === undefined ? 'undefined' : JSON.stringify(value))

const titleOf = (assertion, operator) => (
  [assertion.expression.trim(), operator.label, ...(operator.unary ? [] : [assertion.value])].join(' ')
)

function resolve(expression, response) {
  const path = expression.startsWith('$') ? expression : `$.${expression}`
  return JSONPath({ path, json: { res: response }, wrap: false })
}

function evaluate(assertion, response, variables) {
  const operator = operatorOf(assertion)
  const name = titleOf(assertion, operator)
  try {
    const actual = resolve(assertion.expression.trim(), response)
    const expected = substitutePlaceholders(assertion.value, variables)
    const passed = Boolean(operator.test(actual, parseJSON(expected, expected)))
    return { name, passed, message: passed ? '' : `The value was ${describe(actual)}` }
  } catch (error) {
    return { name, passed: false, message: error.message }
  }
}

export function evaluateAssertions(json, response, variables = {}) {
  const values = variableMap(variables)
  return parseAssertions(json)
    .filter((assertion) => assertion.enabled && assertion.expression.trim() !== '')
    .map((assertion) => evaluate(assertion, response, values))
}
