import { useMemo, useRef, useState } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { Input } from "./ui/input"
import { TabCount } from "./ui/tabs"
import { MethodTag } from "./MethodTag"
import {
  CLASS_CLIENT_ERROR, CLASS_NONE, CLASS_OTHER, CLASS_REDIRECT, CLASS_SERVER_ERROR, CLASS_SUCCESS, STATUS_CLASSES,
  callsOf, countByClass, filterCalls, paddedSpan, statusClassOf, summarizeCalls, timeOf, timeSpan,
} from "../lib/callHistory"
import { formatBytes } from "../lib/byteSize"
import { toolWindow } from "../lib/dialogWindows"
import { formatDateTime, formatNumber, formatPercent } from "../lib/i18n/format"
import { RESPONSE_TEXT } from "../lib/responseText"
import { HISTORY_TEXT } from "../lib/sidebarText"
import { useAppStore } from "../store/appStore"

const TEXT = HISTORY_TEXT.calls
const CALLS_WINDOW = toolWindow("calls", "wide")
const WIDTH = 720
const HEIGHT = 200
const PAD_LEFT = 52
const PAD_RIGHT = 8
const PAD_TOP = 8
const PAD_BOTTOM = 22
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM
const UNKNOWN_HEIGHT = 3
const MIN_ZOOM_PX = 4
const SHOWN_ROWS = 200
const SECOND_OPTIONS = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }

const CLASS_FILL = {
  [CLASS_SUCCESS]: "fill-success",
  [CLASS_REDIRECT]: "fill-info",
  [CLASS_CLIENT_ERROR]: "fill-warning",
  [CLASS_SERVER_ERROR]: "fill-destructive",
  [CLASS_OTHER]: "fill-muted-foreground",
  [CLASS_NONE]: "fill-destructive/40",
}

const BADGE_VARIANT = {
  [CLASS_SUCCESS]: "success",
  [CLASS_REDIRECT]: "redirect",
  [CLASS_CLIENT_ERROR]: "clientError",
  [CLASS_SERVER_ERROR]: "serverError",
  [CLASS_OTHER]: "default",
  [CLASS_NONE]: "serverError",
}

const ALL_CLASSES = new Set(STATUS_CLASSES)

const durationText = (value) => (value === null ? TEXT.unknown : RESPONSE_TEXT.milliseconds(value))
const sizeText = (value) => (value === null ? TEXT.unknown : formatBytes(value))
const statusText = (call) => (call.statusCode > 0 ? String(call.statusCode) : TEXT.classes[statusClassOf(call)])
const momentText = (time) => formatDateTime(new Date(time), SECOND_OPTIONS)

const pad = (number) => String(number).padStart(2, "0")
const toLocalInput = (time) => {
  const date = new Date(time)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const fromLocalInput = (value) => {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isNaN(time) ? null : time
}
const millisecondsOf = (value) => (value.trim() === "" || !/^\d+$/.test(value.trim()) ? null : Number(value.trim()))

function useEntry() {
  const id = useAppStore((s) => s.callHistoryId)
  return useAppStore((s) => s.requestHistory.find((entry) => entry.id === id))
}

function Summary({ calls }) {
  const summary = summarizeCalls(calls)
  const items = [
    [TEXT.count, formatNumber(summary.count)],
    [TEXT.successRate, summary.successRate === null ? "–" : formatPercent(summary.successRate)],
    [TEXT.p50, durationText(summary.p50Ms)],
    [TEXT.p95, durationText(summary.p95Ms)],
    [TEXT.slowest, durationText(summary.maxMs)],
    [TEXT.averageSize, sizeText(summary.averageSize)],
  ]
  return (
    <dl aria-label={TEXT.summary} className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-2xs text-muted-foreground">{label}</dt>
          <dd className="truncate font-mono tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ClassFilters({ classes, counts, onChange }) {
  const toggle = (name) => (event) => {
    const next = new Set(classes)
    if (event.target.checked) next.add(name)
    else next.delete(name)
    onChange(next)
  }
  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <legend className="sr-only">{TEXT.status}</legend>
      {STATUS_CLASSES.filter((name) => counts[name] > 0).map((name) => (
        <Checkbox key={name} checked={classes.has(name)} onChange={toggle(name)} className="h-7">
          <span className="flex items-center gap-1.5">
            <svg aria-hidden="true" viewBox="0 0 8 8" className="h-2 w-2"><rect width="8" height="8" rx="1" className={CLASS_FILL[name]} /></svg>
            {TEXT.classes[name]}
            <span className="text-muted-foreground tabular-nums">{formatNumber(counts[name])}</span>
          </span>
        </Checkbox>
      ))}
    </fieldset>
  )
}

function RangeFilters({ duration, onDuration, view, onView, isZoomed, onReset }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{TEXT.duration}</span>
      <Input inputMode="numeric" aria-label={TEXT.minDuration} placeholder={TEXT.minPlaceholder} value={duration.min} onChange={(event) => onDuration({ ...duration, min: event.target.value })} className="h-7 w-20" />
      <span aria-hidden="true">–</span>
      <Input inputMode="numeric" aria-label={TEXT.maxDuration} placeholder={TEXT.maxPlaceholder} value={duration.max} onChange={(event) => onDuration({ ...duration, max: event.target.value })} className="h-7 w-20" />
      <span className="ms-2 text-muted-foreground">{TEXT.from}</span>
      <Input type="datetime-local" step="1" aria-label={TEXT.from} value={toLocalInput(view.from)} onChange={(event) => onView("from", fromLocalInput(event.target.value))} className="h-7 w-auto" />
      <span className="text-muted-foreground">{TEXT.to}</span>
      <Input type="datetime-local" step="1" aria-label={TEXT.to} value={toLocalInput(view.to)} onChange={(event) => onView("to", fromLocalInput(event.target.value))} className="h-7 w-auto" />
      <Button variant="outline" size="sm" disabled={!isZoomed} onClick={onReset}>{TEXT.resetZoom}</Button>
    </div>
  )
}

function svgX(svg, clientX) {
  const box = svg.getBoundingClientRect()
  if (box.width === 0) return PAD_LEFT
  return Math.min(WIDTH - PAD_RIGHT, Math.max(PAD_LEFT, ((clientX - box.left) / box.width) * WIDTH))
}

function CallsChart({ calls, view, onZoom }) {
  const svgRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const slowest = Math.max(1, ...calls.filter((call) => !call.noResponse).map((call) => call.durationMs ?? 0))
  const span = view.to - view.from || 1
  const xOf = (time) => PAD_LEFT + ((time - view.from) / span) * PLOT_WIDTH
  const timeAt = (x) => view.from + ((x - PAD_LEFT) / PLOT_WIDTH) * span
  const barWidth = Math.max(1, Math.min(8, (PLOT_WIDTH / Math.max(1, calls.length)) * 0.7))

  const start = (event) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const x = svgX(svgRef.current, event.clientX)
    setDrag({ from: x, to: x })
  }
  const move = (event) => {
    if (drag) setDrag({ ...drag, to: svgX(svgRef.current, event.clientX) })
  }
  const end = () => {
    if (!drag) return
    const [left, right] = [Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)]
    setDrag(null)
    if (right - left >= MIN_ZOOM_PX) onZoom({ from: timeAt(left), to: timeAt(right) })
  }

  return (
    <figure className="m-0">
      <svg
        ref={svgRef}
        role="img"
        aria-label={TEXT.chartLabel(calls.length)}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => setDrag(null)}
        className="h-auto w-full max-w-full cursor-crosshair touch-none select-none"
      >
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={PAD_TOP + PLOT_HEIGHT} y2={PAD_TOP + PLOT_HEIGHT} className="stroke-border" strokeWidth="1" />
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={PAD_TOP} y2={PAD_TOP} className="stroke-border" strokeDasharray="2 3" strokeWidth="1" />
        <text x={PAD_LEFT - 4} y={PAD_TOP + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">{RESPONSE_TEXT.milliseconds(slowest)}</text>
        <text x={PAD_LEFT - 4} y={PAD_TOP + PLOT_HEIGHT} textAnchor="end" className="fill-muted-foreground text-[10px]">0</text>
        <text x={PAD_LEFT} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]">{momentText(view.from)}</text>
        <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">{momentText(view.to)}</text>
        {calls.map((call, index) => {
          const height = call.noResponse ? PLOT_HEIGHT : call.durationMs === null ? UNKNOWN_HEIGHT : Math.max(1, (call.durationMs / slowest) * PLOT_HEIGHT)
          const time = timeOf(call)
          return (
            <rect
              key={`${call.at}-${index}`}
              x={xOf(time) - barWidth / 2}
              y={PAD_TOP + PLOT_HEIGHT - height}
              width={barWidth}
              height={height}
              className={CLASS_FILL[statusClassOf(call)]}
            >
              <title>{TEXT.barLabel({ time: momentText(time), status: statusText(call), duration: durationText(call.durationMs), size: sizeText(call.size) })}</title>
            </rect>
          )
        })}
        {drag && (
          <rect
            x={Math.min(drag.from, drag.to)}
            y={PAD_TOP}
            width={Math.abs(drag.to - drag.from)}
            height={PLOT_HEIGHT}
            className="fill-primary/15 stroke-primary"
            strokeWidth="1"
          />
        )}
      </svg>
      <figcaption className="text-2xs text-muted-foreground">{TEXT.zoomHint}</figcaption>
    </figure>
  )
}

function CallsTable({ calls }) {
  const shown = calls.slice(0, SHOWN_ROWS)
  return (
    <div className="min-h-0">
      {calls.length > SHOWN_ROWS && <p className="pb-1 text-2xs text-muted-foreground">{TEXT.shownRows({ shown: formatNumber(SHOWN_ROWS), total: formatNumber(calls.length) })}</p>}
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background text-2xs text-muted-foreground">
          <tr className="text-start">
            <th scope="col" className="py-1 text-start font-medium">{TEXT.time}</th>
            <th scope="col" className="py-1 text-start font-medium">{TEXT.status}</th>
            <th scope="col" className="py-1 text-end font-medium">{TEXT.duration}</th>
            <th scope="col" className="py-1 text-end font-medium">{TEXT.size}</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {shown.map((call, index) => (
            <tr key={`${call.at}-${index}`} className="border-t border-border">
              <td className="py-1">{momentText(timeOf(call))}</td>
              <td className="py-1"><Badge variant={BADGE_VARIANT[statusClassOf(call)]} className="px-1 py-0">{statusText(call)}</Badge></td>
              <td className="py-1 text-end">{durationText(call.durationMs)}</td>
              <td className="py-1 text-end">{sizeText(call.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CallHistoryView({ entry, onClose }) {
  const calls = useMemo(() => callsOf(entry), [entry])
  const fullWindow = useMemo(() => paddedSpan(timeSpan(calls) ?? { from: Date.now(), to: Date.now() }), [calls])
  const [classes, setClasses] = useState(ALL_CLASSES)
  const [duration, setDuration] = useState({ min: "", max: "" })
  const [zoom, setZoom] = useState(null)
  const view = zoom ?? fullWindow
  const counts = useMemo(() => countByClass(calls), [calls])
  const shown = useMemo(
    () => filterCalls(calls, { classes, minMs: millisecondsOf(duration.min), maxMs: millisecondsOf(duration.max), from: view.from, to: view.to }),
    [calls, classes, duration, view],
  )
  const hasLegacy = calls.some((call) => call.durationMs === null && !call.noResponse)
  const setEdge = (edge, time) => {
    if (time === null) return
    const next = { ...view, [edge]: time }
    if (next.to > next.from) setZoom(next)
  }

  return (
    <Dialog label={TEXT.title} size="lg" floating={CALLS_WINDOW} onClose={onClose}>
      <DialogHeader onClose={onClose}>
        <DialogTitle>{TEXT.title}</DialogTitle>
        <TabCount>{calls.length}</TabCount>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          <MethodTag compact method={entry.method} />
          <span className="truncate" title={entry.url}>{entry.url}</span>
        </span>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <Summary calls={shown} />
        <ClassFilters classes={classes} counts={counts} onChange={setClasses} />
        <RangeFilters duration={duration} onDuration={setDuration} view={view} onView={setEdge} isZoomed={zoom !== null} onReset={() => setZoom(null)} />
        <CallsChart calls={shown} view={view} onZoom={setZoom} />
        {hasLegacy && <p className="text-2xs text-muted-foreground">{TEXT.legacy}</p>}
        {shown.length === 0 ? <p className="text-xs text-muted-foreground">{TEXT.noMatches}</p> : <CallsTable calls={shown} />}
      </div>
    </Dialog>
  )
}

export function CallHistoryDialog() {
  const entry = useEntry()
  const close = useAppStore((s) => s.closeCallHistory)
  if (!entry) return null
  return <CallHistoryView entry={entry} onClose={close} />
}
