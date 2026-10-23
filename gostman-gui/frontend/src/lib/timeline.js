import { formatSize, lookup, pluralize } from './dataUtils'
import { ERROR_TITLES } from './response'

const MS_PER_SECOND = 1000
const FINE_MS = 10
const NEGLIGIBLE_MS = 0.05
const MIN_SEGMENT_PERCENT = 0.4

export const PHASES = [
  { key: 'dnsMs', label: 'DNS lookup', short: 'DNS', color: 'bg-info', failures: ['dns'] },
  { key: 'connectMs', label: 'TCP connect', short: 'Connect', color: 'bg-warning', failures: ['connect'] },
  { key: 'tlsMs', label: 'TLS handshake', short: 'TLS', color: 'bg-syntax-boolean', failures: ['tls'] },
  { key: 'firstByteMs', label: 'Waiting for first byte', short: 'TTFB', color: 'bg-success', failures: ['request', 'response'] },
  { key: 'downloadMs', label: 'Content download', short: 'Download', color: 'bg-primary', failures: ['download'] },
]

export const TIMELINE_TEXT = {
  proxied: 'Timings were measured by the Gostman proxy, from the proxy to the target. They do not include the trip from your browser to the proxy.',
  reused: 'Reused connection',
  newConnection: 'New connection',
  omitted: (count) => `${pluralize(count, 'more request')} not shown.`,
  failedBefore: 'Failed before connecting',
  failedAt: (label) => `Failed at: ${label}`,
  requestHeaders: 'Request headers',
  responseHeaders: 'Response headers',
  reveal: 'Reveal value',
  hide: 'Hide value',
  expanded: 'Hide details',
  collapsed: 'Show details',
  total: 'Total',
  breakdown: 'Time breakdown',
  expired: 'expired',
  requests: (count) => pluralize(count, 'request'),
  scripts: (count) => pluralize(count, 'script'),
  consoleLines: (count) => pluralize(count, 'console line'),
  passed: (count) => `${count} passed`,
  failed: (count) => `${count} failed`,
  scriptFailed: 'Failed',
  noOutput: 'No console output or test results.',
}

export const ENTRY_KINDS = { SCRIPT: 'script', SEND: 'send', REQUEST: 'request' }

const EMPTY_TIMELINE = { hops: [], totalMs: 0 }

const failureLabels = Object.fromEntries(PHASES.flatMap((phase) => phase.failures.map((failure) => [failure, phase.label])))

export const failureLabel = (failure) => failureLabels[failure] || failure

export function formatMs(ms) {
  if (ms >= MS_PER_SECOND) return `${(ms / MS_PER_SECOND).toFixed(2)} s`
  if (ms >= FINE_MS) return `${Math.round(ms)} ms`
  if (ms < NEGLIGIBLE_MS) return '0 ms'
  return `${ms.toFixed(1)} ms`
}

const timelineEntries = (timeline) => timeline.activity ?? [{ kind: ENTRY_KINDS.REQUEST, hops: timeline.hops }]

const isScript = (entry) => entry.kind === ENTRY_KINDS.SCRIPT

export const timelineHops = (timeline) => timelineEntries(timeline).flatMap((entry) => entry.hops ?? [])

const isSend = (entry) => entry.kind === ENTRY_KINDS.SEND

export function timelineTotalMs(timeline) {
  if (!timeline.activity) return timeline.totalMs
  return timeline.activity.filter((entry) => !isSend(entry)).reduce((sum, entry) => sum + entry.totalMs, 0)
}

export function timelineScale(timeline) {
  const lastEnd = Math.max(0, ...timelineHops(timeline).map((hop) => hop.startMs + hop.totalMs))
  return Math.max(timeline.totalMs, lastEnd, 1)
}

function entryRows(entry, position) {
  if (isScript(entry) || entry.hops.length === 0) return [{ key: `${position}`, entry }]
  return entry.hops.map((hop, index) => ({ key: `${position}-${index}`, entry, hop }))
}

export function timelineRows(timeline) {
  let number = 0
  return timelineEntries(timeline).flatMap(entryRows).map((row) => {
    if (isScript(row.entry)) return row
    number += 1
    return { ...row, number }
  })
}

export const scriptEntry = (label) => (run, startMs, endMs) => ({
  kind: ENTRY_KINDS.SCRIPT,
  label,
  startMs,
  totalMs: endMs - startMs,
  logs: run.logs,
  tests: run.tests,
  failed: Boolean(run.error),
})

const exchangeSummary = (request, response) => ({
  method: request.method,
  url: response.url || request.url,
  status: response.error ? lookup(ERROR_TITLES, response.error) || response.status : response.status,
  statusCode: response.statusCode,
  protocol: response.protocol,
  failed: Boolean(response.error),
  detail: response.error ? response.body : '',
})

export const exchangeEntry = (kind, request) => (response, startMs, endMs) => ({
  kind,
  startMs,
  totalMs: endMs - startMs,
  hops: response.timeline?.hops ?? [],
  summary: exchangeSummary(request, response),
})

const byStart = (first, second) => first.startMs - second.startMs

export function withActivity(response, entries) {
  if (!entries.some((entry) => entry.kind !== ENTRY_KINDS.REQUEST)) return response
  const timeline = response.timeline ?? EMPTY_TIMELINE
  return { ...response, timeline: { ...timeline, activity: [...entries].sort(byStart) } }
}

export function hopSegments(hop, scale) {
  let offset = hop.startMs
  return PHASES.map((phase) => {
    const ms = hop.phases[phase.key]
    const segment = { phase, ms, left: (offset / scale) * 100, width: Math.max((ms / scale) * 100, ms > 0 ? MIN_SEGMENT_PERCENT : 0) }
    offset += ms
    return segment
  })
}

export function phaseTotals(hops) {
  return PHASES.map((phase) => ({
    phase,
    ms: hops.reduce((sum, hop) => sum + hop.phases[phase.key], 0),
  }))
}

export function breakdownTitle(timeline) {
  if (!timeline?.hops.length) return ''
  const lines = phaseTotals(timeline.hops).map(({ phase, ms }) => `${phase.short} ${formatMs(ms)}`)
  const heading = timeline.proxied ? `${TIMELINE_TEXT.breakdown} (measured by the Gostman proxy)` : TIMELINE_TEXT.breakdown
  return [heading, ...lines].join('\n')
}

export function isExpired(notAfter) {
  return Date.parse(notAfter) < Date.now()
}

function tlsSummary(tls) {
  const expiry = tls.notAfter ? ` · expires ${tls.notAfter.slice(0, 10)}${isExpired(tls.notAfter) ? ` (${TIMELINE_TEXT.expired})` : ''}` : ''
  return `${tls.version} · ${tls.cipher}${tls.protocol ? ` · ALPN ${tls.protocol}` : ''}${expiry}`
}

export function hopFacts(hop) {
  return [
    ['Remote address', hop.remote],
    ['Protocol', hop.proto],
    ['Connection', hop.remote && (hop.reused ? TIMELINE_TEXT.reused : TIMELINE_TEXT.newConnection)],
    ['TLS', hop.tls && tlsSummary(hop.tls)],
    ['Certificate subject', hop.tls?.subject],
    ['Certificate issuer', hop.tls?.issuer],
    ['Request body', hop.requestBytes > 0 && formatSize(hop.requestBytes)],
    ['Redirects to', hop.location],
    ['Cookies set', hop.cookiesSet?.length > 0 && hop.cookiesSet.join(', ')],
  ].filter(([, value]) => value)
}
