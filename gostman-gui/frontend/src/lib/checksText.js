import english from '../../../../locales/en/checks.json'
import { hasMessage, messages } from './i18n/core'
import { formatList } from './i18n/format'

const PREVIEW_LENGTH = 40
const ASSERTION_VARIABLE_EXAMPLE = '{{variables}}'
const SCHEMA_VARIABLE_EXAMPLE = '{{variable}}'
const SCHEMA_NAME_EXAMPLE = '{{name}}'

const quoted = (text) => `"${text}"`
const literal = (value) => (typeof value === 'string' ? quoted(value) : JSON.stringify(value))

const text = messages('checks', english, (t) => {
  const kindName = (type) => (hasMessage('checks', `schema.kinds.${type}`) ? t(`schema.kinds.${type}`) : type)
  const typeKey = (expected) => (expected.length === 1 && hasMessage('checks', `schema.typeOnly.${expected[0]}`) ? `schema.typeOnly.${expected[0]}` : 'schema.type')

  function preview(value) {
    if (value === null || value === undefined) return String(value)
    if (Array.isArray(value)) return t('schema.previewArray', { count: value.length })
    if (typeof value === 'object') return t('schema.previewObject')
    if (typeof value !== 'string') return String(value)
    return t('schema.previewText', { text: value.length > PREVIEW_LENGTH ? `${value.slice(0, PREVIEW_LENGTH)}...` : value })
  }

  const withLimit = (key) => (where, limit, actual) => t(key, { where, limit, actual })
  const withCount = (key) => (where, count, actual) => t(key, { where, count, actual })
  const withPreview = (key, name) => (where, value, actual) => t(key, { where, [name]: value, actual: preview(actual) })

  return {
    schema: {
      get notJson() {
        return t('schema.notJson', { example: SCHEMA_VARIABLE_EXAMPLE })
      },
      get editorHint() {
        return t('schema.editorHint', { example: SCHEMA_NAME_EXAMPLE })
      },
      type: (where, expected, actual) => t(typeKey(expected), { where, expected: formatList(expected.map(kindName), 'disjunction'), actual: preview(actual) }),
      enum: (where, allowed, actual) => t('schema.enum', { where, allowed: formatList(allowed.map(literal), 'unit'), actual: preview(actual) }),
      const: (where, expected, actual) => t('schema.const', { where, expected: literal(expected), actual: preview(actual) }),
      minimum: withLimit('schema.minimum'),
      maximum: withLimit('schema.maximum'),
      exclusiveMinimum: withLimit('schema.exclusiveMinimum'),
      exclusiveMaximum: withLimit('schema.exclusiveMaximum'),
      multipleOf: (where, step, actual) => t('schema.multipleOf', { where, step, actual }),
      minLength: withCount('schema.minLength'),
      maxLength: withCount('schema.maxLength'),
      pattern: withPreview('schema.pattern', 'pattern'),
      format: withPreview('schema.format', 'format'),
      minItems: withCount('schema.minItems'),
      maxItems: withCount('schema.maxItems'),
      uniqueItems: (where, first, second) => t('schema.uniqueItems', { where, first, second }),
      contains: (where, count) => t('schema.contains', { where, count }),
      maxContains: (where, count) => t('schema.maxContains', { where, count }),
      minProperties: withCount('schema.minProperties'),
      maxProperties: withCount('schema.maxProperties'),
      dependentRequired: (where, present, needed) => t('schema.dependentRequired', { where, present, needed }),
      propertyNames: (where, name) => t('schema.propertyNames', { where, name }),
      oneOfMany: (where, count) => t('schema.oneOfMany', { where, count }),
      mismatch: (lines) => t('schema.mismatch', { problems: lines.join('\n') }),
    },
    contract: {
      status: (status, key) => t('contract.status', { status, key }),
      statusMissing: (codes) => (codes.length === 0 ? t('contract.statusMissingNone') : t('contract.statusMissing', { codes: formatList(codes) })),
      contentType: (type) => t('contract.contentType', { type: type || t('contract.noContentType') }),
      contentTypeMissing: (types) => t('contract.contentTypeMissing', { types: formatList(types) }),
      unmatched: (method, path) => t('contract.unmatched', { method, path }),
    },
    responseChecks: {
      add: (count) => (count === 0 ? t('responseChecks.add') : t('responseChecks.addCount', { count })),
      added: (count, name) => t('responseChecks.added', { count, name }),
    },
    tests: {
      hints: {
        get assertions() {
          return t('tests.hints.assertions', { example: ASSERTION_VARIABLE_EXAMPLE })
        },
      },
      expectedPlaceholder: '200',
      schemaPlaceholder: '{"type": "object"}',
    },
    checkRun: {
      resolvedValue: (value, written) => t('checkRun.resolvedValue', { value, written }),
      outsideResponse: (expression, suggestion) => t('checkRun.outsideResponse', { expression, suggestion }),
      unknownOperator: (name, names) => t('checkRun.unknownOperator', { name, names }),
    },
    jsonPath: {
      blocked: (name) => (name ? t('jsonPath.blocked', { name }) : t('jsonPath.blockedUnnamed')),
    },
  }
})

export const SCHEMA_TEXT = text.schema
export const CONTRACT_TEXT = text.contract
export const RESPONSE_CHECKS_TEXT = text.responseChecks
export const TESTS_TEXT = text.tests
export const CHECK_RUN_TEXT = text.checkRun
export const JSON_PATH_TEXT = text.jsonPath
export const OPERATOR_TEXT = text.operators
