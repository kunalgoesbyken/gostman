import { looksLikeCredential } from '../credentialLook'
import { isPlainObject, parseJSON } from '../dataUtils'
import { MONITORS_TEXT } from '../monitorsText'
import { parseVariableMap, placeholderNames } from '../placeholders'
import { redactText } from '../redact'
import { parseRows } from '../rows'
import { resolvedSecretValues } from '../resolvedSecrets'
import { summarize } from '../runReport'
import { AUTH_INHERIT, inheritedAuthSource, lineageOf } from '../inheritance'
import { isDefined, looksSecret } from '../variables'
import { variableTextFor } from '../../store/appStore'

export const RECORD_VERSION = 1
export const KIND_FOLDER = 'folder'
export const KIND_FLOW = 'flow'
export const EVENT_FAILED = 'run.failed'
export const EVENT_PASSED = 'run.passed'
export const EVENT_RECOVERED = 'run.recovered'

const RESOLVED_SECRET = 'secret'
const MAX_TEXT_LENGTH = 300
const MAX_LISTED_FAILURES = 8
const PASS_RATE_WINDOW = 10
const SLOW_PERCENTILE = 95
const EDGE_PUNCTUATION = new Set(['"', "'", '(', ')', '<', '>', ',', ';'])
const WEB_PROTOCOLS = new Set(['http:', 'https:'])

function collectLabelled(found, values) {
  if (!isPlainObject(values)) return
  Object.entries(values).forEach(([label, value]) => {
    if (typeof value === 'string') found.push({ label, value })
  })
}

function leavesOf(node, key = '') {
  if (typeof node === 'string') return [[key, node]]
  if (!isPlainObject(node)) return []
  return Object.entries(node).flatMap(([name, child]) => leavesOf(child, name))
}

const isCredentialField = (key, value) => value !== '' && (looksSecret(key) || looksLikeCredential(key, value))

function credentialLeaves(auth, variables) {
  return leavesOf(auth).filter(([key, value]) => isCredentialField(key, value))
    .map(([key, value]) => {
      const unresolved = placeholderNames(value).some((name) => !isDefined(name, variables))
      if (unresolved) throw new Error(MONITORS_TEXT.withheld)
      return { label: key, value }
    })
}

function effectiveAuth(state, request) {
  const lineage = lineageOf(state, request.folderId)
  const source = request.auth?.type === AUTH_INHERIT ? inheritedAuthSource(request.auth, lineage) : null
  return source ? source.settings.auth : request.auth
}

function headerLeaves(state, request) {
  const lineage = lineageOf(state, request.folderId)
  return [request.headers, ...lineage.map(({ settings }) => settings.headers)]
    .flatMap(parseRows)
    .filter((row) => row.enabled && isCredentialField(row.key, row.value))
    .map((row) => ({ label: row.key, value: row.value }))
}

function queryLeaves(request) {
  const start = request.url.indexOf('?')
  if (start < 0) return []
  return [...new URLSearchParams(request.url.slice(start + 1))]
    .filter(([name, value]) => isCredentialField(name, value))
    .map(([name, value]) => ({ label: name, value }))
}

export function hiddenValues(state, requests, rows) {
  const found = resolvedSecretValues().map((value) => ({ label: RESOLVED_SECRET, value }))
  collectLabelled(found, state.sessionVariables)
  requests.forEach((request) => {
    const text = variableTextFor(state, request)
    collectLabelled(found, parseJSON(text, {}))
    found.push(...credentialLeaves(effectiveAuth(state, request), parseVariableMap(text) || new Map()), ...headerLeaves(state, request), ...queryLeaves(request))
  })
  rows.forEach((row) => collectLabelled(found, row))
  return found
}

const isEdge = (character) => EDGE_PUNCTUATION.has(character)

function trimEdges(piece) {
  let start = 0
  let end = piece.length
  while (start < end && isEdge(piece[start])) start += 1
  while (end > start && isEdge(piece[end - 1])) end -= 1
  return piece.slice(start, end)
}

function plainAddress(piece) {
  const core = trimEdges(piece)
  if (!URL.canParse(core)) return piece
  const address = new URL(core)
  if (!WEB_PROTOCOLS.has(address.protocol)) return piece
  Object.assign(address, { search: '', hash: '', username: '', password: '' })
  return piece.replace(core, address.href)
}

const withoutAddressDetails = (text) => text.split(/(\s+)/u).map(plainAddress).join('')

const clipped = (text) => (text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}...` : text)

export const cleanerFor = (secrets) => (text) => clipped(redactText(withoutAddressDetails(String(text ?? '')).trim(), secrets))

const pathOf = (result) => `${result.folder ? `${result.folder}/` : ''}${result.name}`

const entryOf = (result, clean) => ({
  name: result.iteration > 0 ? `${pathOf(result)} [iteration ${result.iteration}]` : pathOf(result),
  method: result.method,
  status: clean(result.status || ''),
  statusCode: result.statusCode || 0,
  durationMs: Math.round(result.durationMs || 0),
  skipped: Boolean(result.skipped),
  handled: Boolean(result.handled),
  failed: Boolean(result.hasFailed) && !result.handled && !result.skipped,
  error: result.hasFailed ? clean(result.error || '') : '',
  checks: (result.tests || []).length,
  failedChecks: (result.tests || []).filter((test) => !test.passed).map((test) => ({ name: clean(test.name || ''), message: clean(test.message || '') })),
})

const recordId = (startedAt) => startedAt.toISOString().replace(/[-:]/g, '')

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

const answeredDurations = (record) => record.requests.filter((entry) => !entry.skipped && entry.statusCode > 0).map((entry) => entry.durationMs)

const slowestOf = (durations) => percentile(durations, SLOW_PERCENTILE)

export function trendOf(records) {
  const passed = records.filter((record) => record.passed).length
  const points = records.map((record, index) => {
    const window = records.slice(Math.max(0, index - PASS_RATE_WINDOW + 1), index + 1)
    return {
      id: record.id,
      passed: record.passed,
      passRate: window.filter((entry) => entry.passed).length / window.length,
      p95Ms: slowestOf(answeredDurations(record)),
    }
  })
  return {
    runs: records.length,
    passRate: records.length > 0 ? passed / records.length : 0,
    last: records.at(-1) || null,
    p95Ms: slowestOf(records.flatMap(answeredDurations)),
    points,
  }
}
