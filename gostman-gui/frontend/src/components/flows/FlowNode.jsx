import { memo } from "react"
import {
  AlertTriangle, Check, Flag, GitBranch, LoaderCircle, NotebookText, Repeat, Repeat2, RotateCw, Send, Split, Timer, Variable, Workflow, X,
} from "lucide-react"
import { MethodTag } from "../MethodTag"
import { ScopeMark } from "../ScopeMark"
import { FLOW_CANVAS_TEXT as TEXT } from "../../lib/flowsText"
import { stepLines } from "../../lib/flows/describe"
import { EVENT_FAILED, EVENT_HANDLED, EVENT_PASSED } from "../../lib/flows/engine"
import { NODE_RUNNING } from "../../lib/flows/flowRunner"
import {
  OUTCOME_FAILED, STEP_DELAY, STEP_END, STEP_FLOW, STEP_FOR_EACH, STEP_IF, STEP_REPEAT, STEP_REQUEST, STEP_SET, STEP_SWITCH,
} from "../../lib/flows/model"
import { kindText, stepTitle } from "../../lib/flows/validate"
import { formatMs } from "../../lib/timeline"
import { cn } from "../../lib/utils"

const KIND_LOOKS = {
  [STEP_REQUEST]: { icon: Send, tone: "text-info" },
  [STEP_SET]: { icon: Variable, tone: "text-syntax-key" },
  [STEP_IF]: { icon: GitBranch, tone: "text-syntax-boolean" },
  [STEP_SWITCH]: { icon: Split, tone: "text-syntax-boolean" },
  [STEP_FOR_EACH]: { icon: Repeat, tone: "text-syntax-number", frame: "loopBody" },
  [STEP_REPEAT]: { icon: Repeat2, tone: "text-syntax-number", frame: "repeatBody" },
  [STEP_FLOW]: { icon: Workflow, tone: "text-primary" },
  [STEP_DELAY]: { icon: Timer, tone: "text-muted-foreground" },
  [STEP_END]: { icon: Flag, tone: "text-success" },
}

const UNKNOWN_LOOK = { icon: AlertTriangle, tone: "text-muted-foreground" }

const lookOf = (kind) => KIND_LOOKS[kind] || UNKNOWN_LOOK

export const iconOf = (kind) => lookOf(kind).icon

export const frameLabelOf = (kind) => TEXT[lookOf(kind).frame]

const toneOf = (step) => (step.kind === STEP_END && step.outcome === OUTCOME_FAILED ? "text-destructive" : lookOf(step.kind).tone)

const tagOf = (kind) => TEXT.tags[kind] || kindText(kind).label

const STATE_LOOKS = {
  [NODE_RUNNING]: { border: "border-primary", icon: LoaderCircle, tone: "text-primary motion-safe:animate-spin" },
  [EVENT_PASSED]: { border: "border-success", icon: Check, tone: "text-success" },
  [EVENT_FAILED]: { border: "border-destructive", icon: X, tone: "text-destructive" },
  [EVENT_HANDLED]: { border: "border-warning", icon: RotateCw, tone: "text-warning" },
}

export const MAX_LINES = 3

const TOLD_KINDS = [STEP_IF, STEP_SWITCH, STEP_FOR_EACH, STEP_REPEAT]

const isWorthTelling = (step, node) => (
  node?.summary && node.state !== NODE_RUNNING && (node.state !== EVENT_PASSED || node.attempts > 1 || TOLD_KINDS.includes(step.kind))
)

const hasNote = (step) => typeof step.note === "string" && step.note.trim() !== ""

function Counts({ node }) {
  if (node.attempts > 1) return <span>{TEXT.attempt(node.attempt, node.attempts)}</span>
  if (node.visits > 1) return <span>{TEXT.visits(node.visits)}</span>
  return null
}

function RunFooter({ node }) {
  const look = node && STATE_LOOKS[node.state]
  if (!look) return null
  const Icon = look.icon
  return (
    <span className="mt-0.5 flex items-center gap-1.5 border-t border-border pt-1.5 text-2xs text-muted-foreground">
      <Icon aria-hidden="true" className={cn("h-3 w-3 shrink-0", look.tone)} />
      <span className="truncate">{TEXT.states[node.state]}</span>
      <span className="ms-auto flex shrink-0 items-center gap-1.5 font-mono tabular-nums">
        <Counts node={node} />
        {Number.isFinite(node.durationMs) && node.state !== NODE_RUNNING && <span>{formatMs(node.durationMs)}</span>}
      </span>
    </span>
  )
}

function Line({ line }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5 text-2xs", line.muted ? "text-muted-foreground" : "text-foreground/80")}>
      {line.method && <MethodTag method={line.method} compact className="shrink-0" />}
      {line.scope && <ScopeMark source={line.scope} />}
      <span dir="auto" className={cn("truncate", line.mono && "font-mono")} title={line.text}>{line.text}</span>
    </span>
  )
}

function Lines({ step, context }) {
  const lines = stepLines(step, context)
  const shown = lines.length > MAX_LINES ? lines.slice(0, MAX_LINES - 1) : lines
  return (
    <>
      {shown.map((line, index) => <Line key={index} line={line} />)}
      {shown.length < lines.length && <span className="text-2xs text-muted-foreground">{TEXT.moreLines(lines.length - shown.length)}</span>}
    </>
  )
}

export const FlowNode = memo(function FlowNode({ step, box, position, count, context, node, problem, endNotes, isSelected, describedBy, onSelect, onOpen, onKeyDown, onFocus, onHint }) {
  const Icon = iconOf(step.kind)
  const title = stepTitle(step, context.requests)
  const look = node && STATE_LOOKS[node.state]
  const stateText = node ? TEXT.states[node.state] : ""
  const noted = hasNote(step)
  return (
    <button
      type="button"
      data-step-node={step.id}
      aria-label={TEXT.stepLabel(position, count, kindText(step.kind).label, title, [stateText, problem && TEXT.problem].filter(Boolean).join(", "))}
      aria-pressed={isSelected}
      aria-describedby={describedBy}
      onClick={() => onSelect(step.id)}
      onDoubleClick={() => onOpen(step.id)}
      onKeyDown={(event) => onKeyDown(event, step.id)}
      onFocus={() => onFocus(step.id, noted)}
      onBlur={() => onHint(null)}
      onPointerEnter={(event) => noted && event.pointerType !== "touch" && onHint(step.id, event.currentTarget)}
      onPointerLeave={() => noted && onHint(null)}
      style={{ left: box.x, top: box.y, width: box.width }}
      className={cn(
        "absolute flex flex-col gap-1 rounded-md border bg-card px-3 py-2 text-start text-card-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        look ? look.border : "border-border",
        isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-background"
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", toneOf(step))} />
        <span className={cn("min-w-0 truncate text-3xs font-semibold uppercase tracking-wider", toneOf(step))}>{tagOf(step.kind)}</span>
        <span className="ms-auto flex shrink-0 items-center gap-1">
          {noted && <NotebookText aria-label={TEXT.note} className="h-3.5 w-3.5 text-muted-foreground" />}
          {problem && <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-warning" />}
        </span>
      </span>
      <span dir="auto" className="truncate text-xs font-medium" title={title}>{title}</span>
      <Lines step={step} context={context} />
      {endNotes.map((field) => (
        <span key={field} className="text-2xs text-muted-foreground">{TEXT.toEnd(TEXT.edges[field] || field)}</span>
      ))}
      {isWorthTelling(step, node) && (
        <span dir="auto" className="truncate text-2xs text-muted-foreground" title={node.summary}>{node.summary}</span>
      )}
      <RunFooter node={node} />
    </button>
  )
})
