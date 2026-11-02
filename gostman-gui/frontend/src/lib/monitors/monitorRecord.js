import { isPlainObject, parseJSON } from '../dataUtils'
import { summarize } from '../runReport'
import { variableTextFor } from '../../store/appStore'

export const RECORD_VERSION = 1
export const KIND_FOLDER = 'folder'
export const KIND_FLOW = 'flow'
export const EVENT_FAILED = 'run.failed'
export const EVENT_PASSED = 'run.passed'
export const EVENT_RECOVERED = 'run.recovered'

const MAX_TEXT = 300
const MIN_HIDDEN_LENGTH = 4
const MAX_LISTED_FAILURES = 8
const QUERY_PATTERN = /(https?:\/\/[^\s"'?#]+)\?[^\s"'#]*/g
const AUTH_FIELDS = ['password', 'token', 'value', 'clientSecret', 'accessToken', 'refreshToken', 'idToken']

const isHideable = (value) => typeof value === 'string' && value.trim().length >= MIN_HIDDEN_LENGTH

function collectInto(found, values) {
  if (!isPlainObject(values)) return
  Object.entries(values).forEach(([name, value]) => {
    if (isHideable(value)) found.set(value.trim(), name)
  })
}

function authValues(auth) {
  if (!isPlainObject(auth)) return {}
  const nested = isPlainObject(auth.oauth2) ? auth.oauth2 : {}
  return Object.fromEntries([...AUTH_FIELDS.map((field) => [field, auth[field]]), ...AUTH_FIELDS.map((field) => [field, nested[field]])])
}

export function hiddenValues(state, requests, rows) {
  const found = new Map()
  collectInto(found, state.sessionVariables)
  requests.forEach((request) => {
    collectInto(found, parseJSON(variableTextFor(state, request), {}))
    collectInto(found, authValues(request.auth))
  })
  rows.forEach((row) => collectInto(found, row))
  return found
}

export function cleanerFor(found) {
  const ordered = [...found.entries()].sort((first, second) => second[0].length - first[0].length)
  return (text) => {
    let cleaned = String(text ?? '').replace(QUERY_PATTERN, '$1').trim()
    ordered.forEach(([value, name]) => {
      cleaned = cleaned.split(value).join(`{{${name}}}`)
    })
    return cleaned.length > MAX_TEXT ? `${cleaned.slice(0, MAX_TEXT)}...` : cleaned
  }
}

const entryOf = (result, clean) => {
  const failedChecks = (result.tests || []).filter((test) => !test.passed)
  const failed = Boolean(result.hasFailed) && !result.handled && !result.skipped
  return {
    name: result.iteration > 0 ? `${result.folder ? `${result.folder}/` : ''}${result.name} [iteration ${result.iteration}]` : `${result.folder ? `${result.folder}/` : ''}${result.name}`,
    method: result.method,
    status: clean(result.status || ''),
    statusCode: result.statusCode || 0,
    durationMs: Math.round(result.durationMs || 0),
    skipped: Boolean(result.skipped),
    handled: Boolean(result.handled),
    failed,
    error: result.hasFailed ? clean(result.error || '') : '',
    checks: (result.tests || []).length,
    failedChecks: failedChecks.map((test) => ({ name: clean(test.name || ''), message: clean(test.message || '') })),
  }
}

export const recordId = (startedAt) => startedAt.toISOString().replace(/[-:]/g, '')

export function buildRecord({ monitor, target, environment, startedAt, finishedAt, results, planned, outcome, clean }) {
  const summary = summarize(results, planned)
  const passed = outcome ? outcome === 'passed' : summary.failed === 0
  return {
    version: RECORD_VERSION,
    id: recordId(startedAt),
    startedAt: startedAt.toISOString(),
    kind: monitor.kind === KIND_FLOW ? 'flow' : 'run',
    target: clean(target),
    environment: clean(environment || ''),
    durationMs: Math.max(0, finishedAt - startedAt),
    passed,
    exitCode: passed ? 0 : 1,
    outcome: outcome || '',
    summary,
    requests: results.map((result) => entryOf(result, clean)),
  }
}

export function noticeFor(record, event) {
  const failures = record.requests
    .filter((entry) => entry.failed)
    .slice(0, MAX_LISTED_FAILURES)
    .map((entry) => ({
      request: entry.name,
      error: entry.error,
      checks: entry.failedChecks.map((check) => `${check.name}: ${check.message}`.trim()),
    }))
  return {
    event,
    target: record.target,
    kind: record.kind,
    environment: record.environment,
    startedAt: record.startedAt,
    durationMs: record.durationMs,
    passed: record.passed,
    requests: record.summary.requests,
    failedRequests: record.summary.failed,
    failedChecks: record.summary.failedTests,
    failures,
  }
}

export const eventFor = (passed, previousFailed) => {
  if (!passed) return EVENT_FAILED
  return previousFailed ? EVENT_RECOVERED : EVENT_PASSED
}

export function percentile(values, percent) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((first, second) => first - second)
  const rank = Math.ceil((percent / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]
}

const answered = (record) => record.requests.filter((entry) => !entry.skipped && entry.statusCode > 0).map((entry) => entry.durationMs)

export const runP95 = (record) => percentile(answered(record), 95)

const WINDOW = 10

export function trendOf(records) {
  const passed = records.filter((record) => record.passed).length
  const points = records.map((record, index) => {
    const window = records.slice(Math.max(0, index - WINDOW + 1), index + 1)
    return {
      id: record.id,
      at: Date.parse(record.startedAt),
      passed: record.passed,
      passRate: window.filter((entry) => entry.passed).length / window.length,
      p95Ms: runP95(record),
    }
  })
  return {
    runs: records.length,
    passed,
    passRate: records.length > 0 ? passed / records.length : 0,
    last: records.at(-1) || null,
    p95Ms: percentile(records.flatMap(answered), 95),
    points,
  }
}
