import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, FileCode, Info } from 'lucide-react'
import { ConsoleLine } from './ConsolePanel'
import { TestRow, countPassed } from './TestResults'
import { Badge } from './ui/badge'
import { IconButton } from './ui/button'
import { Notice, SectionLabel } from './ui/panel'
import { cn } from '../lib/utils'
import { statusVariant } from '../lib/response'
import {
  ENTRY_KINDS, TIMELINE_TEXT, failureLabel, formatMs, hopFacts, hopSegments, phaseTotals, timelineHops, timelineRows,
  timelineScale, timelineTotalMs,
} from '../lib/timeline'

function Legend({ hops }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-2xs text-muted-foreground">
      {phaseTotals(hops).map(({ phase, ms }) => (
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
    <div className="flex min-w-0 items-start gap-1 py-0.5 font-mono text-2xs">
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
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5 text-2xs">
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
  return <p className="font-mono text-2xs text-muted-foreground">{parts.join(' · ')}</p>
}

const rowClass = (entry) => cn('border-b border-border py-2 pr-3', entry.kind === ENTRY_KINDS.SEND ? 'pl-8' : 'pl-3')

function RowToggle({ open, onToggle, children }) {
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? TIMELINE_TEXT.expanded : TIMELINE_TEXT.collapsed}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center gap-2 text-left text-xs"
    >
      <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {children}
    </button>
  )
}

function RequestLabel({ number, method, url }) {
  return (
    <>
      <span className="shrink-0 font-mono text-muted-foreground">{number}</span>
      <span className="shrink-0 font-mono font-medium text-foreground">{method}</span>
      <span dir="auto" title={url} className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{url}</span>
    </>
  )
}

function Duration({ ms }) {
  return <span className="shrink-0 font-mono text-2xs text-foreground">{formatMs(ms)}</span>
}

function HopRow({ entry, hop, number, scale }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={rowClass(entry)}>
      <RowToggle open={open} onToggle={() => setOpen((current) => !current)}>
        <RequestLabel number={number} method={hop.method} url={hop.url} />
        <HopStatus hop={hop} />
        <Duration ms={hop.totalMs} />
      </RowToggle>
      <div className="mt-1.5 flex flex-col gap-1 pl-5">
        <Waterfall hop={hop} scale={scale} />
        <HopCaption hop={hop} />
        {open && <HopDetails hop={hop} />}
      </div>
    </li>
  )
}

function PlainRow({ entry, number }) {
  const { summary } = entry
  return (
    <li className={rowClass(entry)}>
      <div className="flex w-full min-w-0 items-center gap-2 text-xs">
        <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <RequestLabel number={number} method={summary.method} url={summary.url} />
        <Badge variant={summary.failed ? 'serverError' : statusVariant(summary)} className="font-mono">{summary.status}</Badge>
        <Duration ms={entry.totalMs} />
      </div>
      {summary.detail && <p dir="auto" className="mt-1.5 break-words pl-5 text-2xs text-muted-foreground">{summary.detail}</p>}
    </li>
  )
}

function ScriptOutcome({ entry }) {
  const passed = countPassed(entry.tests)
  const failed = entry.tests.length - passed
  return (
    <>
      {entry.failed && <Badge variant="serverError">{TIMELINE_TEXT.scriptFailed}</Badge>}
      {passed > 0 && <Badge variant="success">{TIMELINE_TEXT.passed(passed)}</Badge>}
      {failed > 0 && <Badge variant="serverError">{TIMELINE_TEXT.failed(failed)}</Badge>}
    </>
  )
}

function ScriptDetails({ entry }) {
  if (entry.logs.length === 0 && entry.tests.length === 0) {
    return <p className="text-2xs text-muted-foreground">{TIMELINE_TEXT.noOutput}</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {entry.logs.length > 0 && <ul>{entry.logs.map((line, index) => <ConsoleLine key={index} line={line} />)}</ul>}
      {entry.tests.length > 0 && <ul>{entry.tests.map((result, index) => <TestRow key={index} result={result} />)}</ul>}
    </div>
  )
}

function ScriptRow({ entry }) {
  const [open, setOpen] = useState(false)
  return (
    <li className={rowClass(entry)}>
      <RowToggle open={open} onToggle={() => setOpen((current) => !current)}>
        <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-foreground">{entry.label}</span>
        <ScriptOutcome entry={entry} />
        <Duration ms={entry.totalMs} />
      </RowToggle>
      {(open || entry.logs.length > 0) && (
        <div className="mt-1.5 flex flex-col gap-1 pl-5">
          {entry.logs.length > 0 && <p className="font-mono text-2xs text-muted-foreground">{TIMELINE_TEXT.consoleLines(entry.logs.length)}</p>}
          {open && <ScriptDetails entry={entry} />}
        </div>
      )}
    </li>
  )
}

function TimelineRow({ row, scale }) {
  if (row.entry.kind === ENTRY_KINDS.SCRIPT) return <ScriptRow entry={row.entry} />
  if (row.hop) return <HopRow entry={row.entry} hop={row.hop} number={row.number} scale={scale} />
  return <PlainRow entry={row.entry} number={row.number} />
}

export function TimelineTab({ timeline }) {
  const scale = timelineScale(timeline)
  const hops = timelineHops(timeline)
  const rows = timelineRows(timeline)
  const requests = rows.filter((row) => row.number).length
  const scripts = rows.length - requests
  return (
    <div className="flex flex-col">
      {timeline.proxied && <Notice icon={Info}>{TIMELINE_TEXT.proxied}</Notice>}
      <div className="flex flex-wrap items-baseline gap-x-3 px-3 pt-2 text-xs">
        <SectionLabel>{TIMELINE_TEXT.total}</SectionLabel>
        <span className="font-mono text-foreground">{formatMs(timelineTotalMs(timeline))}</span>
        <span className="text-muted-foreground">{TIMELINE_TEXT.requests(requests)}</span>
        {scripts > 0 && <span className="text-muted-foreground">{TIMELINE_TEXT.scripts(scripts)}</span>}
      </div>
      {hops.length > 0 && <Legend hops={hops} />}
      <ol>
        {rows.map((row) => <TimelineRow key={row.key} row={row} scale={scale} />)}
      </ol>
      {timeline.omitted > 0 && <Notice>{TIMELINE_TEXT.omitted(timeline.omitted)}</Notice>}
    </div>
  )
}
