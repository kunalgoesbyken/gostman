import { Plus } from "lucide-react"
import { frameLabelOf } from "./FlowNode"
import { FLOW_CANVAS_TEXT as TEXT, FLOW_VIEW_TEXT } from "../../lib/flowsText"
import { jumpsOf } from "../../lib/flows/describe"
import { END_NODE, START_NODE, pairKey, roundedPath } from "../../lib/flows/layout"
import { STEP_SWITCH } from "../../lib/flows/model"
import { stepTitle } from "../../lib/flows/validate"
import { cn } from "../../lib/utils"

const CASE_PREFIX = "case:"
const ARROW_LENGTH = 6
const ARROW_SPREAD = 3.5
const SLOT_RADIUS = 10
const RETRY_BULGE = 16
const RETRY_INSET = 12
const FIELD_TONES = { then: "success", onFailure: "failure" }
const TONES = {
  success: { stroke: "stroke-success", fill: "fill-success", text: "text-success" },
  failure: { stroke: "stroke-destructive", fill: "fill-destructive", text: "text-destructive" },
  muted: { stroke: "stroke-muted-foreground", fill: "fill-muted-foreground", text: "text-muted-foreground" },
  taken: { stroke: "stroke-primary", fill: "fill-primary", text: "text-primary" },
}
const LABEL_STYLE = { paintOrder: "stroke", stroke: "hsl(var(--background))", strokeWidth: 4, fontSize: 10, letterSpacing: "0.06em" }

const jumpOf = (step, field) => jumpsOf(step).find((jump) => jump.field === field)

const toneOf = (step, field) => TONES[jumpOf(step, field)?.tone || FIELD_TONES[field]] || TONES.muted

function branchLabel(step, field) {
  if (field.startsWith(CASE_PREFIX)) {
    const position = Number(field.slice(CASE_PREFIX.length))
    return step.cases?.[position]?.label || TEXT.caseNumber(position + 1)
  }
  if (field === "else" && step.kind === STEP_SWITCH) return TEXT.branches.otherwise
  return TEXT.branches[field] || jumpOf(step, field)?.label || field
}

const sideLabel = (step, field) => jumpOf(step, field)?.label || branchLabel(step, field)

const arrowAt = (point, pointsLeft) => {
  const back = pointsLeft ? ARROW_LENGTH : -ARROW_LENGTH
  return `${point.x},${point.y} ${point.x + back},${point.y - ARROW_SPREAD} ${point.x + back},${point.y + ARROW_SPREAD}`
}

const strokeWidthOf = (isTaken) => (isTaken ? 2 : 1.25)

function Wire({ wire, isTaken }) {
  const tone = wire.idle ? "stroke-border" : "stroke-muted-foreground/60"
  return (
    <path
      d={roundedPath(wire.points)}
      fill="none"
      strokeWidth={strokeWidthOf(isTaken)}
      strokeDasharray={wire.idle ? "3 4" : undefined}
      className={isTaken ? TONES.taken.stroke : tone}
    />
  )
}

function Jump({ edge, step, isTaken }) {
  const tone = isTaken ? TONES.taken : toneOf(step, edge.field)
  const [source, , , target] = edge.points
  const isRight = edge.side === "right"
  return (
    <g className={tone.stroke}>
      <path d={roundedPath(edge.points)} fill="none" strokeWidth={strokeWidthOf(isTaken)} />
      <polygon points={arrowAt(target, isRight)} className={tone.fill} stroke="none" />
      <text x={source.x + (isRight ? ARROW_LENGTH : -ARROW_LENGTH)} y={source.y - 4} textAnchor={isRight ? "start" : "end"} className={tone.fill} style={LABEL_STYLE}>
        {sideLabel(step, edge.field)}
      </text>
    </g>
  )
}

function Loop({ loop, isTaken }) {
  const end = loop.points[loop.points.length - 1]
  return (
    <g className={isTaken ? TONES.taken.stroke : "stroke-muted-foreground/60"}>
      <path d={roundedPath(loop.points)} fill="none" strokeWidth={strokeWidthOf(isTaken)} strokeDasharray="3 3" />
      <polygon points={arrowAt({ x: end.x - 1, y: end.y }, false)} className={isTaken ? TONES.taken.fill : "fill-muted-foreground/60"} stroke="none" />
    </g>
  )
}

function RetryMark({ mark }) {
  const low = mark.y + mark.height - RETRY_INSET
  const high = mark.y + RETRY_INSET
  return (
    <g className="stroke-muted-foreground/70">
      <path d={`M ${mark.x} ${low} C ${mark.x - RETRY_BULGE} ${low} ${mark.x - RETRY_BULGE} ${high} ${mark.x - 5} ${high}`} fill="none" strokeWidth={1.25} />
      <polygon points={arrowAt({ x: mark.x, y: high }, false)} className="fill-muted-foreground/70" stroke="none" />
    </g>
  )
}

export function Lines({ layout, index, pairs }) {
  const isTaken = (line) => line.pairs.some(([from, to]) => pairs.has(pairKey(from, to)))
  const wires = [...layout.wires].sort((first, second) => Number(isTaken(first)) - Number(isTaken(second)))
  return (
    <svg aria-hidden="true" width={layout.width} height={layout.height} className="pointer-events-none absolute left-0 top-0 overflow-visible">
      {wires.map((wire, at) => <Wire key={at} wire={wire} isTaken={isTaken(wire)} />)}
      {layout.loops.map((loop, at) => <Loop key={at} loop={loop} isTaken={isTaken(loop)} />)}
      {layout.retries.map((mark) => <RetryMark key={mark.id} mark={mark} />)}
      {layout.edges.map((edge) => (
        <Jump key={`${edge.from}-${edge.field}-${edge.to}`} edge={edge} step={index.get(edge.from).step} isTaken={pairs.has(pairKey(edge.from, edge.to))} />
      ))}
    </svg>
  )
}

export function BranchLabel({ label, step }) {
  const text = label.fields.map((field) => branchLabel(step, field)).join(" · ")
  return (
    <span
      aria-hidden="true"
      dir="auto"
      title={text}
      style={{ left: label.x, top: label.y, maxWidth: label.width }}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2 truncate rounded-full border border-border bg-background px-1.5 text-3xs font-semibold uppercase leading-4 tracking-wider",
        toneOf(step, label.fields[0]).text
      )}
    >
      {text}
    </span>
  )
}

export function Frame({ frame }) {
  return (
    <div
      aria-hidden="true"
      style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
      className="pointer-events-none absolute rounded-lg border border-border bg-background/50"
    >
      <span dir="auto" className="absolute inset-x-3 top-1.5 truncate text-3xs font-semibold uppercase tracking-wider text-muted-foreground">
        {frameLabelOf(frame.kind)}
      </span>
    </div>
  )
}

function isTerminalTaken(terminal, pairs) {
  if (terminal.start) return [...pairs].some((key) => key.startsWith(pairKey(START_NODE, "")))
  if (terminal.end) return [...pairs].some((key) => key.endsWith(pairKey("", END_NODE)))
  return pairs.has(pairKey(terminal.source, END_NODE))
}

export function Terminal({ terminal, pairs }) {
  const text = terminal.start ? FLOW_VIEW_TEXT.start : TEXT.endPill
  return (
    <span
      aria-hidden="true"
      title={text}
      style={{ left: terminal.x, top: terminal.y, width: terminal.width, height: terminal.height }}
      className={cn(
        "absolute flex items-center justify-center rounded-full border bg-background px-2 text-2xs font-medium",
        isTerminalTaken(terminal, pairs) ? "border-primary text-foreground" : "border-border text-muted-foreground"
      )}
    >
      <span className="truncate">{text}</span>
    </span>
  )
}

function slotLabel(slot, index, requests) {
  if (slot.first) return TEXT.addFirst
  if (slot.parent) return TEXT.insertInto(stepTitle(index.get(slot.parent).step, requests))
  return TEXT.insert
}

export function Slot({ slot, index, requests, onAdd }) {
  const label = slotLabel(slot, index, requests)
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => onAdd(event.currentTarget, { parent: slot.parent, position: slot.position })}
      style={{ left: slot.x - SLOT_RADIUS, top: slot.y - SLOT_RADIUS }}
      className="absolute flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Plus aria-hidden="true" className="h-3 w-3" />
    </button>
  )
}
