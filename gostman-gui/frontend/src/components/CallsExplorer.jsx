import { useMemo, useRef, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "./ui/button"
import { Checkbox } from "./ui/checkbox"
import { Input } from "./ui/input"
import { CallStatus } from "./CallStatus"
import {
  CLASS_CLIENT_ERROR, CLASS_NONE, CLASS_OTHER, CLASS_REDIRECT, CLASS_SERVER_ERROR, CLASS_SUCCESS, STATUS_CLASSES,
  countByClass, countByReason, filterCalls, paddedSpan, statusClassOf, summarizeCalls, timeOf, timeSpan,
} from "../lib/callHistory"
import { ALL_REASONS, REASON_NAMES } from "../lib/noResponse"
import { callLabel, durationText, momentText, sizeText } from "../lib/callDisplay"
import { formatNumber, formatPercent } from "../lib/i18n/format"
import { RESPONSE_TEXT } from "../lib/responseText"
import { HISTORY_TEXT } from "../lib/sidebarText"

const TEXT = HISTORY_TEXT.calls
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

const CLASS_FILL = {
  [CLASS_SUCCESS]: "fill-success",
  [CLASS_REDIRECT]: "fill-info",
  [CLASS_CLIENT_ERROR]: "fill-warning",
  [CLASS_SERVER_ERROR]: "fill-destructive",
  [CLASS_OTHER]: "fill-muted-foreground",
  [CLASS_NONE]: "fill-destructive/40",
}

const ALL_CLASSES = new Set(STATUS_CLASSES)

const pad = (number) => String(number).padStart(2, "0")
const toLocalInput = (time) => {
  const date = new Date(time)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
const fromLocalInput = (value) => {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isNaN(time) ? null : time
}
const millisecondsOf = (value) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null)

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

function CheckFilter({ legend, names, selected, counts, labelOf, fillOf, onChange }) {
  const toggle = (name) => (event) => {
    const next = new Set(selected)
    if (event.target.checked) next.add(name)
    else next.delete(name)
    onChange(next)
  }
  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <legend className="sr-only">{legend}</legend>
      {names.filter((name) => counts[name] > 0).map((name) => (
        <Checkbox key={name} checked={selected.has(name)} onChange={toggle(name)} className="h-7">
          <span className="flex items-center gap-1.5">
            {fillOf && <svg aria-hidden="true" viewBox="0 0 8 8" className="h-2 w-2"><rect width="8" height="8" rx="1" className={fillOf(name)} /></svg>}
            {labelOf(name)}
            <span className="text-muted-foreground tabular-nums">{formatNumber(counts[name])}</span>
          </span>
        </Checkbox>
      ))}
    </fieldset>
  )
}

function RangeFilters({ duration, onDuration, view, onView, isZoomed, onReset, onExport }) {
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
      {onExport && <Button variant="outline" size="sm" className="ms-auto" onClick={onExport}><Download />{TEXT.exportCsv}</Button>}
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
              <title>{callLabel(call)}</title>
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
              <td className="py-1"><CallStatus call={call} /></td>
              <td className="py-1 text-end">{durationText(call.durationMs)}</td>
              <td className="py-1 text-end">{sizeText(call.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CallsExplorer({ calls, entry, onExport }) {
  const fullView = useMemo(() => paddedSpan(timeSpan(calls) ?? { from: Date.now(), to: Date.now() }), [calls])
  const [classes, setClasses] = useState(ALL_CLASSES)
  const [reasons, setReasons] = useState(ALL_REASONS)
  const [duration, setDuration] = useState({ min: "", max: "" })
  const [zoom, setZoom] = useState(null)
  const view = zoom ?? fullView
  const counts = useMemo(() => countByClass(calls), [calls])
  const reasonCounts = useMemo(() => countByReason(calls), [calls])
  const shown = useMemo(
    () => filterCalls(calls, { classes, reasons, minMs: millisecondsOf(duration.min), maxMs: millisecondsOf(duration.max), from: view.from, to: view.to }),
    [calls, classes, reasons, duration, view],
  )
  const hasLegacy = calls.some((call) => call.durationMs === null && !call.noResponse)
  const setEdge = (edge, time) => {
    if (time === null) return
    const next = { ...view, [edge]: time }
    if (next.to > next.from) setZoom(next)
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <Summary calls={shown} />
      <CheckFilter legend={TEXT.status} names={STATUS_CLASSES} selected={classes} counts={counts} labelOf={(name) => TEXT.classes[name]} fillOf={(name) => CLASS_FILL[name]} onChange={setClasses} />
      {counts.none > 0 && <CheckFilter legend={TEXT.reasonLegend} names={REASON_NAMES} selected={reasons} counts={reasonCounts} labelOf={(name) => TEXT.reasons[name]} onChange={setReasons} />}
      <RangeFilters duration={duration} onDuration={setDuration} view={view} onView={setEdge} isZoomed={zoom !== null} onReset={() => setZoom(null)} onExport={onExport && (() => onExport(shown.map((call) => ({ entry, call }))))} />
      <CallsChart calls={shown} view={view} onZoom={setZoom} />
      {hasLegacy && <p className="text-2xs text-muted-foreground">{TEXT.legacy}</p>}
      {shown.length === 0 ? <p className="text-xs text-muted-foreground">{TEXT.noMatches}</p> : <CallsTable calls={shown} />}
    </div>
  )
}
