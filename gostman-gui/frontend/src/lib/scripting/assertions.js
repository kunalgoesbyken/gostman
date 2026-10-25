import { CHECK_RUN_TEXT, SCHEMA_TEXT } from '../checksText'
import { isPlainObject, parseJSON } from '../dataUtils'
import { queryJson } from '../jsonPath'
import { schemaMismatches } from '../jsonSchema'
import { substitutePlaceholders, variableMap } from '../placeholders'
import { PATTERN_TIMEOUT_MS } from './limits'

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

function matchesPattern(actual, expected) {
  const started = Date.now()
  const matched = new RegExp(String(expected)).test(String(actual))
  if (Date.now() - started >= PATTERN_TIMEOUT_MS) throw new Error(CHECK_RUN_TEXT.patternTooSlow(PATTERN_TIMEOUT_MS / 1000))
  return matched
}

const compare = (accepts) => (actual, expected) => (
  !Number.isNaN(Number(actual)) && !Number.isNaN(Number(expected)) && accepts(Number(actual), Number(expected))
)

export const SCHEMA_OPERATOR = 'schema'

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
  { value: 'matches', label: 'matches regex', test: matchesPattern },
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
  { value: SCHEMA_OPERATOR, label: SCHEMA_TEXT.operator, hidesValue: true, verify: (actual, expected) => schemaMismatches(expected, actual).join('\n') },
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

const sameAssertion = (first, second) => (
  first.expression.trim() === second.expression.trim() && first.operator === second.operator && first.value.trim() === second.value.trim()
)

export const isKnownAssertion = (json, candidate) => parseAssertions(json).some((assertion) => sameAssertion(assertion, candidate))

export const withAddedAssertions = (json, additions) => serializeAssertions([...parseAssertions(json), ...additions])

export const countActiveAssertions = (json) => (
  parseAssertions(json).filter((assertion) => assertion.enabled && assertion.expression.trim() !== '').length
)

const describe = (value) => (value === undefined ? 'undefined' : JSON.stringify(value))

export const titleOf = (assertion, operator = operatorOf(assertion)) => (
  [assertion.expression.trim(), operator.label, ...(operator.unary || operator.hidesValue ? [] : [assertion.value])].join(' ')
)

const verdict = (operator, actual, expected) => {
  if (operator.verify) return operator.verify(actual, expected)
  return operator.test(actual, expected) ? '' : `The value was ${describe(actual)}`
}

const RESPONSE_ROOT = 'res'
const RESPONSE_PATHS = ['res', '$.res', "$['res']", '$["res"]']
const DESCENT = '$..'

const pathOf = (expression) => (expression.startsWith('$') ? expression : `$.${expression}`)

const startsAtResponse = (expression) => (
  expression.startsWith(DESCENT) || RESPONSE_PATHS.some((root) => (
    expression === root || expression.startsWith(`${root}.`) || expression.startsWith(`${root}[`)
  ))
)

const BODY_FIELD = 'body'
const RESPONSE_FIELDS = ['status', 'statusText', 'headers', BODY_FIELD, 'responseTime', 'size', 'url']
const FIELD_END = /[.[]/

const joinPath = (root, rest) => {
  if (rest === '') return root
  return rest.startsWith('[') ? `${root}${rest}` : `${root}.${rest}`
}

const isResponseField = (rest) => RESPONSE_FIELDS.includes(rest.split(FIELD_END, 1)[0])

function responsePath(expression) {
  const relative = expression.startsWith('$') ? expression.slice(1) : expression
  const rest = relative.startsWith('.') ? relative.slice(1) : relative
  return joinPath(RESPONSE_ROOT, isResponseField(rest) ? rest : joinPath(BODY_FIELD, rest))
}

function resolve(expression, response) {
  if (!startsAtResponse(expression)) throw new Error(CHECK_RUN_TEXT.outsideResponse(expression, responsePath(expression)))
  return queryJson(pathOf(expression), { [RESPONSE_ROOT]: response })
}

const resolvedTitle = (assertion, operator, expected) => (
  expected === assertion.value ? {} : { resolvedName: titleOf({ ...assertion, value: CHECK_RUN_TEXT.resolvedValue(expected, assertion.value) }, operator) }
)

function evaluate(assertion, response, variables) {
  const operator = operatorOf(assertion)
  const name = titleOf(assertion, operator)
  try {
    const actual = resolve(assertion.expression.trim(), response)
    const expected = substitutePlaceholders(assertion.value, variables)
    const message = verdict(operator, actual, parseJSON(expected, expected))
    return { name, passed: message === '', message, ...resolvedTitle(assertion, operator, expected) }
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
