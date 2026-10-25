import { useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { SectionLabel } from "./ui/panel"
import { TabCount } from "./ui/tabs"
import { MethodTag } from "./MethodTag"
import { formatTime } from "../lib/i18n/format"
import { MOCK_TEXT } from "../lib/mockText"
import { statusVariant } from "../lib/response"

const LOG_COLUMNS = "grid grid-cols-[4.5rem_4rem_minmax(0,1.5fr)_minmax(0,1fr)_2.5rem_3.5rem] items-center gap-2 px-3"
const CELL = "truncate font-mono text-xs"
const CLOCK_OPTIONS = { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }

function EntryDetails({ entry }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-3 py-2 text-xs">
      <SectionLabel>{MOCK_TEXT.logHeaders}</SectionLabel>
      <dl dir="ltr" className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-x-3 font-mono">
        {entry.headers.map((header, index) => (
          <div key={index} className="contents">
            <dt className="truncate text-muted-foreground" title={header.key}>{header.key}</dt>
            <dd className="truncate" title={header.value}>{header.value}</dd>
          </div>
        ))}
      </dl>
      {entry.bodyBytes > 0 && (
        <>
          <SectionLabel>{MOCK_TEXT.logBody(entry.bodyBytes)}</SectionLabel>
          <pre dir="ltr" className="max-h-32 overflow-auto whitespace-pre-wrap font-mono">{entry.body}</pre>
        </>
      )}
    </div>
  )
}

function RouteCell({ entry }) {
  const label = entry.noExample ? MOCK_TEXT.logNoExample(entry.route) : entry.rule || entry.route || MOCK_TEXT.noMatch
  const title = entry.noExample ? MOCK_TEXT.logNoExampleHint(entry.route) : entry.route || MOCK_TEXT.noMatch
  return <span title={title} className="truncate text-xs text-muted-foreground">{label}</span>
}

function LogRow({ entry, isOpen, onToggle }) {
  return (
    <li>
      <button type="button" aria-expanded={isOpen} onClick={onToggle} className={`${LOG_COLUMNS} h-7 w-full border-b border-border text-start hover:bg-accent`}>
        <span className={`${CELL} text-muted-foreground`}>{formatTime(entry.time, CLOCK_OPTIONS)}</span>
        <MethodTag method={entry.method} />
        <span title={entry.path} className={`${CELL} text-foreground`}>{entry.path}</span>
        <RouteCell entry={entry} />
        <Badge variant={statusVariant({ statusCode: entry.status })} className="justify-self-start font-mono">{entry.status || entry.fault}</Badge>
        <span className={`${CELL} text-end text-muted-foreground`}>{MOCK_TEXT.logDuration(entry.durationMs)}</span>
      </button>
      {isOpen && <EntryDetails entry={entry} />}
    </li>
  )
}

export function MockLogTab({ log, isRunning, onClear }) {
  const [openId, setOpenId] = useState(0)
  return (
    <>
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border ps-3 pe-1.5">
        <SectionLabel>{MOCK_TEXT.logCount}</SectionLabel>
        <TabCount>{log.length}</TabCount>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{MOCK_TEXT.logMasked}</span>
        <Button variant="ghost" size="sm" disabled={log.length === 0} onClick={onClear}>{MOCK_TEXT.clear}</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {log.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">{isRunning ? MOCK_TEXT.logEmptyRunning : MOCK_TEXT.logEmptyStopped}</p>
        ) : (
          <ul aria-label={MOCK_TEXT.logLabel}>
            {log.map((entry) => (
              <LogRow key={entry.id} entry={entry} isOpen={openId === entry.id} onToggle={() => setOpenId(openId === entry.id ? 0 : entry.id)} />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
