import { CONTRACT_TEXT } from './checksText'
import { parseJSON } from './dataUtils'
import { schemaMismatches } from './jsonSchema'
import { textBody } from './response'

export const CONTRACT_KIND = 'contract'

const HTTP_METHODS = ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE']
const SCHEME_MARK = '://'
const ANY_TYPE = '*/*'
const JSON_TYPE = 'application/json'
const JSON_SUFFIX = '+json'
const DEFAULT_RESPONSE = 'default'
const NO_OPERATION = { operation: null, note: '' }
const NOT_JSON = Symbol('not json')

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function pathOf(address) {
  const text = String(address ?? '')
  const scheme = text.indexOf(SCHEME_MARK)
  const start = scheme >= 0 ? text.indexOf('/', scheme + SCHEME_MARK.length) : text.indexOf('/')
  if (start < 0) return '/'
  const rest = text.slice(start)
  return rest.split('?')[0].split('#')[0]
}

const segmentsOf = (path) => path.split('/').filter(Boolean).map(decodeSegment)

function matchesSegment(template, actual) {
  const [head, ...rest] = template.split('{')
  if (rest.length === 0) return template === actual
  if (!actual.startsWith(head)) return false
  const literals = rest.map((part) => part.slice(part.indexOf('}') + 1))
  let cursor = head.length
  for (const [index, literal] of literals.entries()) {
    if (index === literals.length - 1) return actual.length - literal.length > cursor && actual.endsWith(literal)
    const found = actual.indexOf(literal, cursor + 1)
    if (found < 0) return false
    cursor = found + literal.length
  }
  return true
}

const isLiteral = (segment) => !segment.includes('{')

function fit(template, segments, bases) {
  const parts = segmentsOf(template)
  const offset = segments.length - parts.length
  if (offset < 0 || !parts.every((part, index) => matchesSegment(part, segments[offset + index]))) return null
  const prefix = segments.slice(0, offset).join('/')
  const isAnchored = bases.some((base) => segmentsOf(base).join('/') === prefix)
  const literals = parts.filter(isLiteral).length
  if (!isAnchored && literals === 0) return null
  return [isAnchored ? 1 : 0, parts.length, literals]
}

const isBetter = (score, best) => {
  const index = score.findIndex((value, at) => value !== best[at])
  return index >= 0 && score[index] > best[index]
}

export function findOperation(contract, method, address) {
  const verb = String(method || '').toUpperCase()
  if (!HTTP_METHODS.includes(verb)) return NO_OPERATION
  const path = pathOf(address)
  const segments = segmentsOf(path)
  const bases = contract.basePaths?.length ? contract.basePaths : ['']
  let best = null
  for (const operation of contract.operations) {
    const score = operation.method === verb ? fit(operation.path, segments, bases) : null
    if (score && (!best || isBetter(score, best.score))) best = { operation, score }
  }
  return best ? { operation: best.operation, note: '' } : { operation: null, note: CONTRACT_TEXT.unmatched(verb, path) }
}

const bareType = (value) => String(value || '').split(';')[0].trim().toLowerCase()

const isJsonType = (type) => type === JSON_TYPE || type.endsWith(JSON_SUFFIX)

function documentedResponse(responses, status) {
  const codes = Object.keys(responses)
  const family = `${Math.floor(status / 100)}xx`
  const code = codes.find((candidate) => candidate === String(status))
    ?? codes.find((candidate) => candidate.toLowerCase() === family)
    ?? codes.find((candidate) => candidate === DEFAULT_RESPONSE)
  return code === undefined ? null : responses[code]
}

function documentedType(types, actual) {
  const family = `${actual.split('/')[0]}/*`
  return types.find((type) => bareType(type) === actual)
    ?? types.find((type) => bareType(type) === family)
    ?? types.find((type) => type === ANY_TYPE)
}

const result = (name, message) => ({ name, passed: message === '', message, kind: CONTRACT_KIND })

function bodyResult(schema, root, text) {
  const value = parseJSON(text, NOT_JSON)
  if (value === NOT_JSON) return result(CONTRACT_TEXT.body, CONTRACT_TEXT.notJson)
  try {
    return result(CONTRACT_TEXT.body, schemaMismatches(schema, value, root).join('\n'))
  } catch (error) {
    return result(CONTRACT_TEXT.body, error.message)
  }
}

export function contractChecks(operation, root, response) {
  const responses = operation.responses || {}
  const status = response.statusCode
  const entry = documentedResponse(responses, status)
  const statusResult = result(CONTRACT_TEXT.status(status, operation.key), entry ? '' : CONTRACT_TEXT.statusMissing(Object.keys(responses)))
  const content = entry?.content || {}
  const types = Object.keys(content)
  const actual = bareType(response.contentType)
  const text = textBody(response)
  if (types.length === 0 || (actual === '' && text === '')) return [statusResult]
  const documented = documentedType(types, actual)
  const typeResult = result(CONTRACT_TEXT.contentType(actual), documented === undefined ? CONTRACT_TEXT.contentTypeMissing(types) : '')
  const schema = documented === undefined ? null : content[documented]
  if (schema === null || schema === undefined || !isJsonType(actual)) return [statusResult, typeResult]
  return [statusResult, typeResult, bodyResult(schema, root, text)]
}

export const operationKey = (contract, method, address) => {
  const { operation, note } = findOperation(contract, method, address)
  return { key: operation?.key ?? '', note }
}
