import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, Info } from 'lucide-react'
import { Badge } from './ui/badge'
import { IconButton } from './ui/button'
import { Notice, SectionLabel } from './ui/panel'
import { cn } from '../lib/utils'
import { pluralize } from '../lib/dataUtils'
import { statusVariant } from '../lib/response'
import {
  PHASES, TIMELINE_TEXT, failureLabel, formatMs, hopFacts, hopSegments, phaseTotals, timelineScale,
} from '../lib/timeline'

function Legend({ timeline }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
      {phaseTotals(timeline).map(({ phase, ms }) => (
        <li key={phase.key} className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-sm', phase.color)} aria-hidden="true" />
          {phase.short}
          <span className="font-mono text-foreground">{formatMs(ms)}</span>
        </li>
      ))}
    </ul>
  )
}

function Waterfall({ hop, scale }) {
  return (
    <div className="relative h-2.5 rounded-sm bg-muted" role="img" aria-label={TIMELINE_TEXT.breakdown}>
      {hopSegments(hop, scale).map(({ phase, ms, left, width }) => (
        <span
          key={phase.key}
          title={`${phase.label}: ${formatMs(ms)}`}
          className={cn('absolute top-0 h-full', phase.color, hop.failedPhase && phase.failures.includes(hop.failedPhase) && 'bg-destructive')}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      ))}
    </div>
  )
}

function HopStatus({ hop }) {
  if (hop.status) return <Badge variant={statusVariant({ statusCode: hop.status })} className="font-mono">{hop.status}</Badge>
  return <Badge variant="serverError">{hop.failedPhase ? TIMELINE_TEXT.failedAt(failureLabel(hop.failedPhase)) : TIMELINE_TEXT.failedBefore}</Badge>
}

function HeaderValue({ header }) {
  const [shown, setShown] = useState(false)
  const canReveal = header.masked && header.secret !== undefined
  return (
    <div className="flex min-w-0 items-start gap-1 py-0.5 font-mono text-[11px]">
      <span className="shrink-0 text-foreground">{header.key}:</span>
      <span dir="auto" className="min-w-0 flex-1 break-all text-muted-foreground">{shown ? header.secret : header.value}</span>
      {canReveal && (
        <IconButton
          label={shown ? TIMELINE_TEXT.hide : TIMELINE_TEXT.reveal}
          icon={shown ? EyeOff : Eye}
          onClick={() => setShown((current) => !current)}
        />
      )}
    </div>
  )
}

function HeaderList({ title, headers }) {
  if (!headers?.length) return null
  return (
    <section className="min-w-0">
      <SectionLabel>{title}</SectionLabel>
      {headers.map((header, index) => <HeaderValue key={index} header={header} />)}
    </section>
  )
}

function HopDetails({ hop }) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-[11px]">
        {hopFacts(hop).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd dir="auto" className="break-all font-mono text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <HeaderList title={TIMELINE_TEXT.requestHeaders} headers={hop.sent} />
      <HeaderList title={TIMELINE_TEXT.responseHeaders} headers={hop.received} />
    </div>
  )
}

function HopCaption({ hop }) {
  const parts = hopSegments(hop, 1).filter(({ ms }) => ms > 0).map(({ phase, ms }) => `${phase.short} ${formatMs(ms)}`)
  if (hop.reused) parts.unshift(TIMELINE_TEXT.reused)
  return <p className="font-mono text-[11px] text-muted-foreground">{parts.join(' · ')}</p>
}

function HopRow({ hop, index, scale }) {
  const [open, setOpen] = useState(false)
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <li className="border-b border-border px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? TIMELINE_TEXT.expanded : TIMELINE_TEXT.collapsed}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full min-w-0 items-center gap-2 text-left text-xs"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="shrink-0 font-mono text-muted-foreground">{index + 1}</span>
        <span className="shrink-0 font-mono font-medium text-foreground">{hop.method}</span>
        <span dir="auto" title={hop.url} className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{hop.url}</span>
        <HopStatus hop={hop} />
        <span className="shrink-0 font-mono text-[11px] text-foreground">{formatMs(hop.totalMs)}</span>
      </button>
      <div className="mt-1.5 flex flex-col gap-1 pl-5">
        <Waterfall hop={hop} scale={scale} />
        <HopCaption hop={hop} />
        {open && <HopDetails hop={hop} />}
      </div>
    </li>
  )
}

export function TimelineTab({ timeline }) {
  const scale = timelineScale(timeline)
  return (
    <div className="flex flex-col">
      {timeline.proxied && <Notice icon={Info}>{TIMELINE_TEXT.proxied}</Notice>}
      <div className="flex items-baseline gap-3 px-3 pt-2 text-xs">
        <SectionLabel>{TIMELINE_TEXT.total}</SectionLabel>
        <span className="font-mono text-foreground">{formatMs(timeline.totalMs)}</span>
        <span className="text-muted-foreground">{pluralize(timeline.hops.length, 'request')}</span>
      </div>
      <Legend timeline={timeline} />
      <ol>
        {timeline.hops.map((hop, index) => <HopRow key={index} hop={hop} index={index} scale={scale} />)}
      </ol>
      {timeline.omitted > 0 && <Notice>{TIMELINE_TEXT.omitted(timeline.omitted)}</Notice>}
    </div>
  )
}
