import { memo } from "react"
import { AlertTriangle, Check, Flag, GitBranch, LoaderCircle, Repeat, RotateCw, Send, Timer, Variable, X } from "lucide-react"
import { MethodTag } from "../MethodTag"
import { FLOW_CANVAS_TEXT as TEXT } from "../../lib/flowsText"
import { jumpsOf, stepLines } from "../../lib/flows/describe"
import { EVENT_FAILED, EVENT_HANDLED, EVENT_PASSED } from "../../lib/flows/engine"
import { NODE_RUNNING } from "../../lib/flows/flowRunner"
import { OUTCOME_FAILED, STEP_DELAY, STEP_END, STEP_FOR_EACH, STEP_IF, STEP_REQUEST, STEP_SET } from "../../lib/flows/model"
import { kindText, stepTitle } from "../../lib/flows/validate"
import { cn } from "../../lib/utils"

export const KIND_ICONS = {
  [STEP_REQUEST]: Send,
  [STEP_SET]: Variable,
  [STEP_IF]: GitBranch,
  [STEP_FOR_EACH]: Repeat,
  [STEP_DELAY]: Timer,
  [STEP_END]: Flag,
}

export const iconOf = (kind) => KIND_ICONS[kind] || AlertTriangle

const STATE_LOOKS = {
  [NODE_RUNNING]: { border: "border-primary", icon: LoaderCircle, tone: "text-primary animate-spin" },
  [EVENT_PASSED]: { border: "border-success", icon: Check, tone: "text-success" },
  [EVENT_FAILED]: { border: "border-destructive", icon: X, tone: "text-destructive" },
  [EVENT_HANDLED]: { border: "border-warning", icon: RotateCw, tone: "text-warning" },
}

const TOLD_KINDS = [STEP_IF, STEP_FOR_EACH]

const isWorthTelling = (step, node) => (
  node?.summary && node.state !== NODE_RUNNING && (node.state !== EVENT_PASSED || node.attempts > 1 || TOLD_KINDS.includes(step.kind))
)

const kindTone = (step) => (step.kind === STEP_END && step.outcome === OUTCOME_FAILED ? "text-destructive" : "text-muted-foreground")

function RunMark({ node }) {
  const look = node && STATE_LOOKS[node.state]
  if (!look) return null
  const Icon = look.icon
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-2xs text-muted-foreground">
      {node.attempts > 1 && <span>{TEXT.attempt(node.attempt, node.attempts)}</span>}
      {node.visits > 1 && node.attempts <= 1 && <span>{TEXT.visits(node.visits)}</span>}
      <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", look.tone)} />
    </span>
  )
}

function Line({ line }) {
  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-2xs", line.muted ? "text-muted-foreground" : "text-foreground/80")}>
      {line.method && <MethodTag method={line.method} compact className="shrink-0" />}
      <span className={cn("truncate", line.mono && "font-mono")} title={line.text}>{line.text}</span>
    </p>
  )
}

export const FlowNode = memo(function FlowNode({ step, position, count, context, node, problem, isSelected, onSelect, onOpen, onKeyDown }) {
  const Icon = iconOf(step.kind)
  const title = stepTitle(step, context.requests)
  const look = node && STATE_LOOKS[node.state]
  const endJumps = jumpsOf(step).filter((jump) => jump.toEnd && jump.field !== "next")
  const stateText = node ? TEXT.states[node.state] : ""
  return (
    <button
      type="button"
      data-step-node={step.id}
      aria-label={TEXT.stepLabel(position, count, kindText(step.kind).label, title, [stateText, problem && TEXT.problem].filter(Boolean).join(", "))}
      aria-pressed={isSelected}
      onClick={() => onSelect(step.id)}
      onDoubleClick={() => onOpen(step.id)}
      onKeyDown={(event) => onKeyDown(event, step.id)}
      className={cn(
        "flex w-[17rem] max-w-full flex-col gap-1 rounded-md border bg-card px-3 py-2 text-left text-card-foreground transition-colors hover:bg-accent",
        look ? look.border : "border-border",
        isSelected && "ring-2 ring-ring ring-offset-1 ring-offset-background"
      )}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", kindTone(step))} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={title}>{title}</span>
        {problem && <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-warning" />}
        <RunMark node={node} />
      </span>
      {stepLines(step, context).map((line, index) => <Line key={index} line={line} />)}
      {endJumps.map((jump) => (
        <span key={jump.field} className="text-2xs text-muted-foreground">{TEXT.toEnd(jump.label)}</span>
      ))}
      {isWorthTelling(step, node) && (
        <span className="truncate text-2xs text-muted-foreground" title={node.summary}>{node.summary}</span>
      )}
    </button>
  )
})
