import { memo } from "react"
import { Download, Play } from "lucide-react"
import { Button } from "../ui/button"
import { EmptyState } from "../ui/emptyState"
import { ResultRow } from "../RunnerDialog"
import { iconOf } from "./FlowNode"
import { FLOW_RUN_TEXT as TEXT } from "../../lib/flowsText"
import { EVENT_FAILED } from "../../lib/flows/engine"
import { RUN_RUNNING, runResults } from "../../lib/flows/flowRunner"
import { STEP_REQUEST } from "../../lib/flows/model"
import { isSensitiveName } from "../../lib/sensitiveNames"
import { cn } from "../../lib/utils"

const STATUS_TONES = { passed: "text-success", failed: "text-destructive", running: "text-primary", stopped: "text-muted-foreground" }

function Writes({ writes }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 pb-1.5 ps-[1.375rem] font-mono text-2xs">
      {Object.entries(writes).map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="truncate text-foreground" title={isSensitiveName(name) ? "" : value}>{isSensitiveName(name) ? TEXT.hidden : value}</dd>
        </div>
      ))}
    </dl>
  )
}

const StepEntry = memo(function StepEntry({ entry, onSelectStep }) {
  const Icon = iconOf(entry.event.kind)
  const isFailed = entry.event.status === EVENT_FAILED
  return (
    <li className="border-b border-border">
      <button type="button" onClick={() => onSelectStep(entry.step)} className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-start hover:bg-accent">
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5 shrink-0", isFailed ? "text-destructive" : "text-muted-foreground")} />
        <span className="shrink-0 text-xs text-foreground">{entry.title}</span>
        <span className={cn("min-w-0 flex-1 truncate text-2xs", isFailed ? "text-destructive" : "text-muted-foreground")} title={entry.event.summary}>{entry.event.summary}</span>
      </button>
      {entry.event.writes && <Writes writes={entry.event.writes} />}
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
      <ul aria-label={TEXT.resultsLabel} className="min-h-0 flex-1 overflow-y-auto [overflow-wrap:anywhere]">
        {run.entries.map((entry) => (entry.type === STEP_REQUEST
          ? <ResultRow key={entry.key} result={entry.result} />
          : <StepEntry key={entry.key} entry={entry} onSelectStep={onSelectStep} />))}
      </ul>
    </div>
  )
}
