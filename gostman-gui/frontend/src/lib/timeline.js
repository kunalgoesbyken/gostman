import { lookup } from './dataUtils'
import { formatBytes } from './byteSize'
import { ERROR_TITLES } from './response'
import { errorBodyOf } from './responseError'
import { TIMELINE_TEXT } from './timelineText'

const MS_PER_SECOND = 1000
const FINE_MS = 10
const NEGLIGIBLE_MS = 0.05
const MIN_SEGMENT_PERCENT = 0.4

const phase = (name, key, color, failures) => ({
  key,
  get label() {
    return TIMELINE_TEXT.phases[name].label
  },
  get short() {
    return TIMELINE_TEXT.phases[name].short
  },
  color,
  failures,
})

export const PHASES = [
  phase('dns', 'dnsMs', 'bg-info', ['dns']),
  phase('connect', 'connectMs', 'bg-warning', ['connect']),
  phase('tls', 'tlsMs', 'bg-syntax-boolean', ['tls']),
  phase('firstByte', 'firstByteMs', 'bg-success', ['request', 'response']),
  phase('download', 'downloadMs', 'bg-primary', ['download']),
]

export const ENTRY_KINDS = { SCRIPT: 'script', SECRETS: 'secrets', SEND: 'send', REQUEST: 'request' }

const EMPTY_TIMELINE = { hops: [], totalMs: 0 }

export const failureLabel = (failure) => PHASES.find((candidate) => candidate.failures.includes(failure))?.label || failure

export function formatMs(ms) {
  if (ms >= MS_PER_SECOND) return TIMELINE_TEXT.seconds((ms / MS_PER_SECOND).toFixed(2))
  if (ms >= FINE_MS) return TIMELINE_TEXT.milliseconds(Math.round(ms))
  if (ms < NEGLIGIBLE_MS) return TIMELINE_TEXT.milliseconds(0)
  return TIMELINE_TEXT.milliseconds(ms.toFixed(1))
}

const timelineEntries = (timeline) => timeline.activity ?? [{ kind: ENTRY_KINDS.REQUEST, hops: timeline.hops }]

const isExchange = (entry) => entry.kind === ENTRY_KINDS.SEND || entry.kind === ENTRY_KINDS.REQUEST

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
  if (!isExchange(entry) || entry.hops.length === 0) return [{ key: `${position}`, entry }]
  return entry.hops.map((hop, index) => ({ key: `${position}-${index}`, entry, hop }))
}

export function timelineRows(timeline) {
  let number = 0
  return timelineEntries(timeline).flatMap(entryRows).map((row) => {
    if (!isExchange(row.entry)) return row
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

export const secretsEntry = (targets) => (resolved, startMs, endMs) => ({
  kind: ENTRY_KINDS.SECRETS,
  startMs,
  totalMs: endMs - startMs,
  read: Object.keys(resolved).length,
  skipped: Object.entries(targets).filter(([name]) => !(name in resolved)).map(([name, ref]) => ({ name, connection: ref.provider })),
})

const exchangeSummary = (request, response) => ({
  method: request.method,
  url: response.url || request.url,
  status: response.error ? lookup(ERROR_TITLES, response.error) || response.status : response.status,
  statusCode: response.statusCode,
  protocol: response.protocol,
  failed: Boolean(response.error),
  detail: response.error ? errorBodyOf(response) : '',
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
  const heading = timeline.proxied ? TIMELINE_TEXT.breakdownProxied : TIMELINE_TEXT.breakdown
  return [heading, ...lines].join('\n')
}

export function isExpired(notAfter) {
  return Date.parse(notAfter) < Date.now()
}

const CERTIFICATE_DATE_LENGTH = 10
const FACT_SEPARATOR = ' · '

const expiryOf = (notAfter) => {
  const date = notAfter.slice(0, CERTIFICATE_DATE_LENGTH)
  return isExpired(notAfter) ? TIMELINE_TEXT.tlsExpired({ date }) : TIMELINE_TEXT.tlsExpires({ date })
}

const tlsSummary = (tls) => [
  tls.version,
  tls.cipher,
  tls.protocol && TIMELINE_TEXT.tlsAlpn(tls.protocol),
  tls.notAfter && expiryOf(tls.notAfter),
].filter(Boolean).join(FACT_SEPARATOR)

export function hopFacts(hop) {
  const labels = TIMELINE_TEXT.facts
  return [
    [labels.remoteAddress, hop.remote],
    [labels.protocol, hop.proto],
    [labels.connection, hop.remote && (hop.reused ? TIMELINE_TEXT.reused : TIMELINE_TEXT.newConnection)],
    [labels.tls, hop.tls && tlsSummary(hop.tls)],
    [labels.certificateSubject, hop.tls?.subject],
    [labels.certificateIssuer, hop.tls?.issuer],
    [labels.requestBody, hop.requestBytes > 0 && formatBytes(hop.requestBytes)],
    [labels.redirectsTo, hop.location],
    [labels.cookiesSet, hop.cookiesSet?.length > 0 && hop.cookiesSet.join(', ')],
  ].filter(([, value]) => value)
}
