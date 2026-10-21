import { memo, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, Pause, Play, Radio, Search, Trash2 } from "lucide-react"
import { Badge } from "./ui/badge"
import { IconButton } from "./ui/button"
import { EmptyState } from "./ui/emptyState"
import { Input } from "./ui/input"
import { Notice, SectionLabel, Toolbar } from "./ui/panel"
import { Select } from "./ui/select"
import { VirtualList } from "./ui/VirtualList"
import { useClipboardCopy } from "../hooks/useClipboardCopy"
import { useDebouncedValue } from "../hooks/useDebouncedValue"
import { cn } from "../lib/utils"
import {
  SSE_TEXT, STATUS_TEXT, STREAM_ENDED, STREAM_RECONNECTING,
  endSummary, eventsToText, filterEvents, formatEventTime, prettyEventData,
} from "../lib/sse"
import { clearEvents, selectSession, useSseStore } from "../lib/sseSessions"

const ROW_HEIGHT_PX = 28
const PREVIEW_LIMIT = 240
const DETAIL_LIMIT = 200_000
const SEARCH_DEBOUNCE_MS = 150
const ALL_TYPES = ""
const MS_PER_SECOND = 1000

const firstLine = (data) => data.split("\n", 1)[0].slice(0, PREVIEW_LIMIT)

function typeOptions(types) {
  return Object.entries(types).sort(([first], [second]) => first.localeCompare(second))
}

function StatusBadge({ session }) {
  const variant = session.status === STREAM_ENDED ? "default" : "success"
  return <Badge variant={variant}>{STATUS_TEXT[session.status]}</Badge>
}

function Counters({ session, shown }) {
  const text = `${SSE_TEXT.shown(shown, session.events.length)} · ${SSE_TEXT.received(session.total)}`
  return <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={text}>{text}</span>
}

function CopyShown({ events }) {
  const text = useMemo(() => eventsToText(events), [events])
  const { copied, copy } = useClipboardCopy(text)
  return <IconButton label={copied ? SSE_TEXT.copied : SSE_TEXT.copyAll} icon={copied ? Check : Copy} onClick={copy} disabled={events.length === 0} />
}

function EventRow({ event, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event.index)}
      aria-pressed={isSelected}
      style={{ height: ROW_HEIGHT_PX }}
      className={cn(
        "flex w-full items-center gap-2 px-3 text-left text-xs hover:bg-accent",
        isSelected && "bg-accent"
      )}
    >
      <span className="w-12 shrink-0 text-right font-mono text-muted-foreground">{event.index}</span>
      <span className="w-24 shrink-0 font-mono text-muted-foreground">{formatEventTime(event.time)}</span>
      <Badge variant="outline" className="max-w-[8rem] shrink-0"><span className="truncate">{event.type}</span></Badge>
      {event.id && <span className="max-w-[6rem] shrink-0 truncate font-mono text-muted-foreground" title={event.id}>{event.id}</span>}
      <span className="min-w-0 flex-1 truncate font-mono text-foreground">{firstLine(event.data)}</span>
    </button>
  )
}

function EventDetail({ event }) {
  const text = useMemo(() => prettyEventData(event.data), [event])
  const { copied, copy } = useClipboardCopy(text)
  return (
    <>
      <Toolbar className="h-8 border-t">
        <SectionLabel className="min-w-0 flex-1 truncate">{event.type}{event.id ? ` · ${event.id}` : ""}</SectionLabel>
        <IconButton label={copied ? SSE_TEXT.copied : SSE_TEXT.copyEvent} icon={copied ? Check : Copy} onClick={copy} />
      </Toolbar>
      {event.truncated && <Notice tone="warning">{SSE_TEXT.clipped}</Notice>}
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {text.slice(0, DETAIL_LIMIT)}
      </pre>
    </>
  )
}

function Notices({ session }) {
  return (
    <>
      {session.status === STREAM_RECONNECTING && (
        <Notice tone="warning">{SSE_TEXT.reconnecting(Math.ceil(session.retryMs / MS_PER_SECOND), session.attempt)}</Notice>
      )}
      {session.status === STREAM_ENDED && <Notice>{endSummary(session)}</Notice>}
      {session.dropped > 0 && <Notice tone="warning">{SSE_TEXT.dropped(session.dropped)}</Notice>}
    </>
  )
}

function EventList({ events, scrollRef, selected, onSelect, hasEvents }) {
  if (events.length === 0) {
    return hasEvents
      ? <EmptyState icon={Search} title={SSE_TEXT.noMatches} description={SSE_TEXT.noMatchesHint} />
      : <EmptyState icon={Radio} title={SSE_TEXT.noEvents} description={SSE_TEXT.waiting} />
  }
  const renderRow = (event) => <EventRow key={event.index} event={event} isSelected={event.index === selected} onSelect={onSelect} />
  return <VirtualList scrollRef={scrollRef} items={events} rowHeight={ROW_HEIGHT_PX} renderRow={renderRow} className="h-full py-1" />
}

export const SseView = memo(function SseView({ streamId }) {
  const session = useSseStore(selectSession(streamId))
  const [type, setType] = useState(ALL_TYPES)
  const [query, setQuery] = useState("")
  const [isPaused, setIsPaused] = useState(false)
  const [selected, setSelected] = useState(null)
  const scrollRef = useRef(null)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)

  const events = session?.events
  const shown = useMemo(() => (events ? filterEvents(events, type, debouncedQuery) : []), [events, type, debouncedQuery])
  const selectedEvent = useMemo(() => shown.find((event) => event.index === selected) || null, [shown, selected])

  useEffect(() => {
    if (!isPaused && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [shown.length, isPaused])

  if (!session) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toolbar>
        <StatusBadge session={session} />
        <Counters session={session} shown={shown.length} />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Select value={type} onChange={(event) => setType(event.target.value)} aria-label={SSE_TEXT.allTypes} className="w-36">
            <option value={ALL_TYPES}>{SSE_TEXT.allTypes}</option>
            {typeOptions(session.types).map(([name, count]) => <option key={name} value={name}>{`${name} (${count})`}</option>)}
          </Select>
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={SSE_TEXT.searchPlaceholder}
            aria-label={SSE_TEXT.searchLabel}
            spellCheck={false}
            className="w-40"
          />
          <IconButton
            label={isPaused ? SSE_TEXT.resume : SSE_TEXT.pause}
            icon={isPaused ? Play : Pause}
            aria-pressed={isPaused}
            onClick={() => setIsPaused(!isPaused)}
          />
          <CopyShown events={shown} />
          <IconButton label={SSE_TEXT.clear} icon={Trash2} onClick={() => clearEvents(streamId)} />
        </div>
      </Toolbar>
      <Notices session={session} />
      <div className="min-h-0 flex-[3]">
        <EventList events={shown} scrollRef={scrollRef} selected={selected} onSelect={(index) => setSelected(index === selected ? null : index)} hasEvents={session.events.length > 0} />
      </div>
      {selectedEvent && (
        <div className="flex min-h-0 flex-[2] flex-col">
          <EventDetail event={selectedEvent} />
        </div>
      )}
    </div>
  )
})
