import { formatSize, pluralize } from './dataUtils'

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
}

const failureLabels = Object.fromEntries(PHASES.flatMap((phase) => phase.failures.map((failure) => [failure, phase.label])))

export const failureLabel = (failure) => failureLabels[failure] || failure

export function formatMs(ms) {
  if (ms >= MS_PER_SECOND) return `${(ms / MS_PER_SECOND).toFixed(2)} s`
  if (ms >= FINE_MS) return `${Math.round(ms)} ms`
  if (ms < NEGLIGIBLE_MS) return '0 ms'
  return `${ms.toFixed(1)} ms`
}

export function timelineScale(timeline) {
  const lastEnd = Math.max(...timeline.hops.map((hop) => hop.startMs + hop.totalMs))
  return Math.max(timeline.totalMs, lastEnd, 1)
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

export function phaseTotals(timeline) {
  return PHASES.map((phase) => ({
    phase,
    ms: timeline.hops.reduce((sum, hop) => sum + hop.phases[phase.key], 0),
  }))
}

export function breakdownTitle(timeline) {
  if (!timeline) return ''
  const lines = phaseTotals(timeline).map(({ phase, ms }) => `${phase.short} ${formatMs(ms)}`)
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
