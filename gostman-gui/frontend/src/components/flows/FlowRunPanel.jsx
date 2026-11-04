import { memo } from "react"
import { Check, Download, Play, X } from "lucide-react"
import { Button } from "../ui/button"
import { EmptyState } from "../ui/emptyState"
import { ResultRow } from "../RunnerDialog"
import { FlowMetrics } from "./FlowMetrics"
import { iconOf } from "./FlowNode"
import { PanelSection } from "./PanelSection"
import { FLOW_EDITOR_TEXT, FLOW_RUN_TEXT as TEXT } from "../../lib/flowsText"
import { EVENT_FAILED } from "../../lib/flows/engine"
import { STEP_IF, STEP_PARALLEL, STEP_REPEAT, STEP_SWITCH } from "../../lib/flows/model"
import { RUN_RUNNING, runResults } from "../../lib/flows/flowRunner"
import { isSensitiveName } from "../../lib/sensitiveNames"
import { cn } from "../../lib/utils"

const STATUS_TONES = { passed: "text-success", failed: "text-destructive", running: "text-primary", stopped: "text-muted-foreground" }

const shownValue = (name, value) => (isSensitiveName(name) ? TEXT.hidden : value)

function Writes({ writes }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pb-1.5 ps-[1.375rem] font-mono text-2xs">
      {Object.entries(writes).map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="truncate text-foreground" title={isSensitiveName(name) ? "" : value}>{shownValue(name, value)}</dd>
        </div>
      ))}
    </dl>
  )
}

const TABLE_KINDS = [STEP_IF, STEP_SWITCH, STEP_REPEAT, STEP_PARALLEL]

function TruthTable({ checks }) {
  return (
    <ul aria-label={TEXT.truthTable} className="flex flex-col gap-0.5 pb-1.5 ps-[1.375rem] pe-3 font-mono text-2xs">
      {checks.map((check, position) => {
        const Mark = check.passed ? Check : X
        return (
          <li key={position} className="flex items-start gap-1.5">
            <Mark aria-label={check.passed ? TEXT.checkTrue : TEXT.checkFalse} className={cn("mt-px h-3 w-3 shrink-0", check.passed ? "text-success" : "text-muted-foreground")} />
            <span className="min-w-0 text-foreground">{check.name}</span>
          </li>
        )
      })}
    </ul>
  )
}

function VariableList({ rows }) {
  return (
    <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-2 gap-y-0.5 font-mono text-2xs">
      {rows.map(({ name, type, value }) => (
        <div key={name} className="contents">
          <dt className="text-foreground">{name}</dt>
          <span className="font-sans text-muted-foreground">{type ? FLOW_EDITOR_TEXT.typeLabels[type] : type === null ? "" : TEXT.sessionValue}</span>
          <dd className="truncate text-foreground" title={isSensitiveName(name) ? "" : value}>{shownValue(name, value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function variableRows(run) {
  const types = run.types || {}
  const declared = Object.keys(types).map((name) => ({ name, type: types[name], value: run.variables?.[name] ?? "" }))
  const outputs = run.outputs || {}
  const isShownElsewhere = (name) => Object.hasOwn(types, name) || Object.hasOwn(outputs, name)
  const written = Object.entries(run.written || {}).filter(([name]) => !isShownElsewhere(name)).map(([name, value]) => ({ name, type: "", value }))
  return [...declared, ...written]
}

function RunVariables({ run }) {
  const rows = variableRows(run)
  const outputs = Object.entries(run.outputs || {}).map(([name, value]) => ({ name, type: null, value }))
  if (rows.length === 0 && outputs.length === 0) return null
  return (
    <div className="max-h-56 shrink-0 overflow-y-auto border-b border-border [overflow-wrap:anywhere]">
      {rows.length > 0 && (
        <PanelSection id="run:variables" title={TEXT.variables}>
          <VariableList rows={rows} />
        </PanelSection>
      )}
      {outputs.length > 0 && (
        <PanelSection id="run:outputs" title={TEXT.outputs}>
          <VariableList rows={outputs} />
        </PanelSection>
      )}
    </div>
  )
}

const NEST_INDENT_REM = 0.75

function Nested({ depth, children }) {
  if (!depth) return children
  return (
    <li style={{ paddingInlineStart: `${depth * NEST_INDENT_REM}rem` }}>
      <ul className="border-s border-border">{children}</ul>
    </li>
  )
}

const StepEntry = memo(function StepEntry({ entry, onSelectStep }) {
  const Icon = iconOf(entry.event.kind)
  const isFailed = entry.event.status === EVENT_FAILED
  return (
    <li className="border-b border-border">
      <button type="button" onClick={() => onSelectStep(entry.root || entry.step)} className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-accent">
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", isFailed ? "text-destructive" : "text-muted-foreground")} />
        <span className="shrink-0 text-xs text-foreground">{entry.title}</span>
        <span className={cn("min-w-0 flex-1 truncate text-2xs", isFailed ? "text-destructive" : "text-muted-foreground")} title={entry.event.summary}>{entry.event.summary}</span>
      </button>
      {entry.event.writes && <Writes writes={entry.event.writes} />}
      {TABLE_KINDS.includes(entry.event.kind) && entry.event.checks?.length > 0 && <TruthTable checks={entry.event.checks} />}
    </li>
  )
})

export function FlowRunPanel({ run, canRun, onRun, onReport, onSelectStep }) {
  if (!run) {
    return (
      <EmptyState
        icon={Play}
        title={TEXT.idle}
        description={TEXT.idleHint}
        action={<Button size="sm" disabled={!canRun} onClick={onRun}><Play />{TEXT.run}</Button>}
      />
    )
  }
  const sent = runResults(run).length
  const isRunning = run.status === RUN_RUNNING
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start gap-2 border-b border-border px-3 py-2">
        <div role="status" className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium", STATUS_TONES[run.status])}>{TEXT.status[run.status]}</p>
          <p className="text-2xs text-muted-foreground">{TEXT.sent(sent)}</p>
          {run.message && <p className="whitespace-pre-line pt-1 text-xs text-foreground">{run.message}</p>}
        </div>
        <Button variant="ghost" size="sm" disabled={isRunning || sent === 0} onClick={onReport}>
          <Download />
          {TEXT.report}
        </Button>
      </div>
      <FlowMetrics metrics={run.metrics} />
      <RunVariables run={run} />
      <ul aria-label={TEXT.resultsLabel} className="min-h-0 flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {run.entries.map((entry) => (
          <Nested key={entry.key} depth={entry.depth}>
            {entry.result ? <ResultRow result={entry.result} /> : <StepEntry entry={entry} onSelectStep={onSelectStep} />}
          </Nested>
        ))}
      </ul>
    </div>
  )
}
