import { isPlainObject, parseJSON } from './dataUtils'
import { NEGATIVE_TEXT } from './negativeText'

const AUTH_NONE = 'none'
const MAX_VARIANTS_PER_REQUEST = 40
const OVERSIZED_BYTES = 1024 * 1024
const LONG_TEXT = 10000
const DEFAULT_SEVERITY = 'medium'
const REJECT = 'reject'
const SURVIVE = 'survive'
const GARBAGE_CREDENTIAL = 'gostman-invalid-credential'
const AUTH_HEADERS = ['authorization', 'proxy-authorization']

export const INJECTIONS = [
  { id: 'sql', payload: "' OR '1'='1' --" },
  { id: 'xss', payload: '<script>alert(1)</script>' },
  { id: 'traversal', payload: '../../../../etc/passwd' },
  { id: 'header', payload: 'gostman\r\nX-Injected: 1' },
  { id: 'expression', payload: '${7*7}' },
]

const SEVERITY_BY_KIND = {
  'auth-missing': 'high',
  'auth-invalid': 'high',
  'body-malformed': 'medium',
  'body-oversized': 'medium',
  'body-wrong-type': 'medium',
  'body-missing-field': 'low',
}

const STACK_TRACES = [
  /Traceback \(most recent call last\)/,
  /\bat [\w.$<>]+\([\w.$ -]+\.(?:java|kt|scala):\d+\)/,
  /\bat [\w.$<>\s]+\((?:file:\/\/)?[^\s()]+\.(?:js|ts|mjs|cjs):\d+:\d+\)/,
  /goroutine \d+ \[/,
  /System\.[A-Za-z.]+Exception/,
  /Exception in thread "/,
  /#\d+ [^\s]+\.php\(\d+\)/,
  /\.rb:\d+:in `/,
]

const SQL_ERRORS = [
  /You have an error in your SQL syntax/i,
  /SQLSTATE\[\w+\]/,
  /\bORA-\d{5}\b/,
  /PG::\w+Error|psycopg2\.\w+|org\.postgresql\./,
  /sqlite3?\.(?:Operational|Programming)Error|SQLITE_ERROR/i,
  /unterminated quoted string at or near/i,
  /syntax error at or near/i,
  /Unclosed quotation mark after the character string/i,
  /com\.mysql\.jdbc|java\.sql\.SQLException/,
]

const parseRows = (text) => {
  const rows = parseJSON(text, [])
  return Array.isArray(rows) ? rows.filter(isPlainObject) : []
}

const withRows = (request, rows) => ({ ...request, headers: JSON.stringify(rows) })

const isAuthRow = (row) => AUTH_HEADERS.includes(String(row.key).toLowerCase())

export const definesAuth = (request, inherited) => {
  const type = request.auth?.type || ''
  return (type !== '' && type !== AUTH_NONE) || inherited || parseRows(request.headers).some((row) => row.enabled !== false && isAuthRow(row))
}

function authVariants(request, inherited) {
  if (!definesAuth(request, inherited) || request.auth?.type === AUTH_NONE) return []
  const rows = parseRows(request.headers)
  const unauthenticated = withRows({ ...request, auth: { ...request.auth, type: AUTH_NONE } }, rows.filter((row) => !isAuthRow(row)))
  const hasHeader = rows.some(isAuthRow)
  const garbled = hasHeader
    ? withRows({ ...request }, rows.map((row) => (isAuthRow(row) ? { ...row, value: `Bearer ${GARBAGE_CREDENTIAL}` } : row)))
    : { ...request, auth: { ...request.auth, token: GARBAGE_CREDENTIAL, password: GARBAGE_CREDENTIAL, value: GARBAGE_CREDENTIAL } }
  return [
    { kind: 'auth-missing', label: NEGATIVE_TEXT.variant.credentialsMissing, expect: REJECT, request: unauthenticated },
    { kind: 'auth-invalid', label: NEGATIVE_TEXT.variant.credentialsInvalid, expect: REJECT, request: garbled },
  ]
}

const wrongType = (value) => (typeof value === 'string' ? 12345 : 'gostman')

const BOUNDARY_NUMBERS = [0, -1, 2147483648, 1e308]

function bodyVariants(request) {
  if (request.bodyType !== 'json' || request.body.trim() === '') return []
  const parsed = parseJSON(request.body, undefined)
  if (!isPlainObject(parsed)) return []
  const withBody = (body) => ({ ...request, body: typeof body === 'string' ? body : JSON.stringify(body) })
  const variants = [{ kind: 'body-malformed', label: NEGATIVE_TEXT.variant.bodyTruncated, expect: REJECT, request: withBody(request.body.slice(0, Math.max(1, Math.floor(request.body.length / 2)))) }]
  for (const [key, value] of Object.entries(parsed)) {
    const replace = (replacement) => withBody({ ...parsed, [key]: replacement })
    const rest = Object.fromEntries(Object.entries(parsed).filter(([other]) => other !== key))
    variants.push({ kind: 'body-missing-field', label: NEGATIVE_TEXT.variant.fieldRemoved({ name: key }), expect: REJECT, request: withBody(rest) })
    if (value !== null && typeof value !== 'object') variants.push({ kind: 'body-wrong-type', label: NEGATIVE_TEXT.variant.fieldWrongType({ name: key }), expect: REJECT, request: replace(wrongType(value)) })
    if (typeof value === 'number') BOUNDARY_NUMBERS.forEach((number) => variants.push({ kind: 'boundary', label: NEGATIVE_TEXT.variant.fieldValue({ name: key, value: String(number) }), expect: SURVIVE, request: replace(number) }))
    if (typeof value === 'string') {
      variants.push({ kind: 'boundary', label: NEGATIVE_TEXT.variant.fieldEmpty({ name: key }), expect: SURVIVE, request: replace('') })
      variants.push({ kind: 'boundary', label: NEGATIVE_TEXT.variant.fieldLong({ name: key, count: LONG_TEXT }), expect: SURVIVE, request: replace('A'.repeat(LONG_TEXT)) })
      INJECTIONS.forEach(({ id, payload }) => variants.push({ kind: `injection-${id}`, label: NEGATIVE_TEXT.variant.injectionField({ name: key, injection: NEGATIVE_TEXT.injection[id] }), expect: SURVIVE, payload, request: replace(payload) }))
    }
  }
  variants.push({ kind: 'body-oversized', label: NEGATIVE_TEXT.variant.bodyLarge, expect: REJECT, request: withBody({ ...parsed, gostman: 'A'.repeat(OVERSIZED_BYTES) }) })
  return variants
}

const SCHEME_END = '://'

function queryParts(address) {
  const hashAt = address.indexOf('#')
  const base = hashAt < 0 ? address : address.slice(0, hashAt)
  const fragment = hashAt < 0 ? '' : address.slice(hashAt)
  const queryAt = base.indexOf('?')
  if (queryAt < 0 || base.indexOf(SCHEME_END) > queryAt) return null
  return { path: base.slice(0, queryAt), pairs: base.slice(queryAt + 1).split('&').filter(Boolean), fragment }
}

function queryVariants(request) {
  const parts = queryParts(request.url)
  if (!parts) return []
  const variants = []
  parts.pairs.forEach((pair, index) => {
    const name = pair.split('=')[0]
    if (name.includes('{{')) return
    INJECTIONS.forEach(({ id, payload }) => {
      const pairs = parts.pairs.map((other, at) => (at === index ? `${name}=${encodeURIComponent(payload)}` : other))
      variants.push({ kind: `injection-${id}`, label: NEGATIVE_TEXT.variant.injectionParameter({ name, injection: NEGATIVE_TEXT.injection[id] }), expect: SURVIVE, payload, request: { ...request, url: `${parts.path}?${pairs.join('&')}${parts.fragment}` } })
    })
  })
  return variants
}

export function negativeVariants(request, inherited = false) {
  return [...authVariants(request, inherited), ...bodyVariants(request), ...queryVariants(request)]
    .slice(0, MAX_VARIANTS_PER_REQUEST)
    .map((variant, index) => ({ ...variant, id: `${request.id}:${index}`, severity: SEVERITY_BY_KIND[variant.kind] || DEFAULT_SEVERITY }))
}

const firstMatch = (patterns, text) => patterns.find((pattern) => pattern.test(text))

const finding = (rule, severity, message) => ({ rule, severity, message })

export function negativeFindings(variant, response) {
  const found = []
  const status = response.statusCode
  const body = String(response.body || '')
  const label = variant.label
  const text = NEGATIVE_TEXT.finding
  if (variant.expect === REJECT && status >= 200 && status < 400) {
    found.push(finding('accepted', variant.severity, text.accepted({ label, status })))
  }
  if (status >= 500) found.push(finding('server-error', 'medium', text.serverError({ label, status })))
  if (firstMatch(STACK_TRACES, body)) found.push(finding('stack-trace', 'high', text.stackTrace({ label })))
  if (firstMatch(SQL_ERRORS, body)) found.push(finding('sql-error', 'high', text.sqlError({ label })))
  if (variant.payload && body.includes(variant.payload)) found.push(finding('reflected', 'medium', text.reflected({ label })))
  return found
}
