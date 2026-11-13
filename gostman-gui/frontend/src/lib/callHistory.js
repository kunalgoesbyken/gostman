import { REASONS, REASON_NAMES, REASON_UNKNOWN, noResponseReason } from './noResponse'

export const CLASS_SUCCESS = 'success'
export const CLASS_REDIRECT = 'redirect'
export const CLASS_CLIENT_ERROR = 'clientError'
export const CLASS_SERVER_ERROR = 'serverError'
export const CLASS_OTHER = 'other'
export const CLASS_NONE = 'none'
export const STATUS_CLASSES = [CLASS_SUCCESS, CLASS_REDIRECT, CLASS_CLIENT_ERROR, CLASS_SERVER_ERROR, CLASS_OTHER, CLASS_NONE]

const isMeasure = (value) => Number.isFinite(value) && value >= 0
const measureOf = (value) => (isMeasure(value) ? Math.round(value) : null)
const statusOf = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0)
const isTime = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const reasonOf = (raw) => {
  if (raw.noResponse !== true) return ''
  return REASONS.includes(raw.reason) ? raw.reason : REASON_UNKNOWN
}

function normalizeCall(raw) {
  if (!raw || !isTime(raw.at)) return null
  return {
    at: raw.at,
    statusCode: statusOf(raw.statusCode),
    noResponse: raw.noResponse === true,
    reason: reasonOf(raw),
    durationMs: measureOf(raw.durationMs),
    size: measureOf(raw.size),
  }
}

export function callsOf(entry) {
  const calls = Array.isArray(entry?.calls) ? entry.calls.map(normalizeCall).filter(Boolean) : []
  if (calls.length > 0 || !isTime(entry?.timestamp)) return calls
  return [normalizeCall({ at: entry.timestamp, statusCode: entry.statusCode, noResponse: entry.noResponse })]
}

export function callFromResponse(response, statusCode, noResponse, at) {
  return normalizeCall({ at, statusCode, noResponse, reason: noResponse ? noResponseReason(response) : '', durationMs: response?.durationMs, size: noResponse ? null : response?.size })
}

export const recordCall = (calls, call, limit) => [call, ...calls].slice(0, Math.max(1, limit))

export function compactCall({ at, statusCode, noResponse, reason, durationMs, size }) {
  return {
    at,
    ...(statusCode > 0 && { statusCode }),
    ...(noResponse && { noResponse }),
    ...(REASONS.includes(reason) && { reason }),
    ...(durationMs !== null && { durationMs }),
    ...(size !== null && { size }),
  }
}

export function statusClassOf(call) {
  if (call.noResponse) return CLASS_NONE
  const hundreds = Math.floor(call.statusCode / 100)
  return [null, null, CLASS_SUCCESS, CLASS_REDIRECT, CLASS_CLIENT_ERROR, CLASS_SERVER_ERROR][hundreds] || CLASS_OTHER
}

export const timeOf = (call) => Date.parse(call.at)

export function filterCalls(calls, { classes, reasons = null, minMs = null, maxMs = null, from = null, to = null }) {
  return calls.filter((call) => {
    const time = timeOf(call)
    if (from !== null && time < from) return false
    if (to !== null && time > to) return false
    if (!classes.has(statusClassOf(call))) return false
    if (reasons && call.noResponse && !reasons.has(call.reason)) return false
    if (minMs === null && maxMs === null) return true
    if (call.durationMs === null) return false
    return (minMs === null || call.durationMs >= minMs) && (maxMs === null || call.durationMs <= maxMs)
  })
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return null
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[index]
}

export function summarizeCalls(calls) {
  const durations = calls.map((call) => call.durationMs).filter((value) => value !== null).sort((first, second) => first - second)
  const sizes = calls.map((call) => call.size).filter((value) => value !== null)
  const answered = calls.filter((call) => [CLASS_SUCCESS, CLASS_REDIRECT].includes(statusClassOf(call))).length
  return {
    count: calls.length,
    successRate: calls.length === 0 ? null : answered / calls.length,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations.at(-1) ?? null,
    averageSize: sizes.length === 0 ? null : Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length),
  }
}

export function countByClass(calls) {
  const counts = Object.fromEntries(STATUS_CLASSES.map((name) => [name, 0]))
  for (const call of calls) counts[statusClassOf(call)] += 1
  return counts
}

export function countByReason(calls) {
  const counts = Object.fromEntries(REASON_NAMES.map((name) => [name, 0]))
  for (const call of calls) if (call.noResponse) counts[call.reason] += 1
  return counts
}

export function timeSpan(calls) {
  if (calls.length === 0) return null
  const times = calls.map(timeOf)
  return { from: Math.min(...times), to: Math.max(...times) }
}

export function paddedSpan(span, minimumMs = 60 * 1000) {
  const width = span.to - span.from
  if (width >= minimumMs) return { from: span.from - width * 0.02, to: span.to + width * 0.02 }
  const middle = (span.from + span.to) / 2
  return { from: middle - minimumMs / 2, to: middle + minimumMs / 2 }
}
