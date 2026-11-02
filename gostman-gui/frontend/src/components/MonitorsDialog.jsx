import { useMemo, useState } from "react"
import { Activity, ChevronDown, ChevronRight, Pause, Pencil, Play, Plus, Timer, Trash2 } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { EmptyState } from "./ui/emptyState"
import { Notice, PanelBody, SPLIT_LIST, SPLIT_PANES, Toolbar } from "./ui/panel"
import { MonitorChart } from "./MonitorChart"
import { MonitorForm } from "./MonitorForm"
import { trendOf } from "../lib/monitors/monitorRecord"
import { nameOfTarget, useMonitorStore } from "../lib/monitors/monitorSession"
import { MONITORS_TEXT as TEXT } from "../lib/monitorsText"
import { RUNNER_TEXT } from "../lib/runnerText"
import { formatDateTime, formatPercent, formatTime } from "../lib/i18n/format"
import { cn } from "../lib/utils"
import { useAppStore } from "../store/appStore"

const WINDOW = { id: "monitors", width: 800, height: 580, minWidth: 480, minHeight: 360 }
const SHOWN_RUNS = 30

function StatusDot({ monitor, isRunning, lastPassed }) {
  const tone = monitor.paused || lastPassed === undefined ? "bg-muted-foreground/40" : lastPassed ? "bg-success" : "bg-destructive"
  return <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", tone, isRunning && "animate-pulse")} />
}

function MonitorRow({ monitor, isSelected, isRunning, history, onSelect }) {
  const last = history.at(-1)
  return (
    <li>
      <button
        type="button"
        aria-current={isSelected ? "true" : undefined}
        onClick={onSelect}
        className={cn("flex min-h-9 w-full items-center gap-2 border-b border-border px-3 py-1.5 text-start hover:bg-accent", isSelected && "bg-accent")}
      >
        <StatusDot monitor={monitor} isRunning={isRunning} lastPassed={last?.passed} />
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{monitor.name}</span>
        {monitor.paused && <span className="shrink-0 text-2xs text-muted-foreground">{TEXT.paused}</span>}
      </button>
    </li>
  )
}

function RunRow({ record }) {
  const [isOpen, setIsOpen] = useState(false)
  const failures = record.requests.filter((entry) => entry.failed)
  const Chevron = isOpen ? ChevronDown : ChevronRight
  return (
    <li className="border-b border-border">
      <button type="button" aria-expanded={isOpen} disabled={failures.length === 0} onClick={() => setIsOpen(!isOpen)} className="flex min-h-9 w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1 text-start hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent">
        <span className={cn("w-12 shrink-0 text-2xs font-medium uppercase", record.passed ? "text-success" : "text-destructive")}>{record.passed ? TEXT.passed : TEXT.failed}</span>
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{formatDateTime(new Date(record.startedAt))}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{TEXT.runLine({ passed: record.summary.passed, failed: record.summary.failed })}</span>
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{RUNNER_TEXT.duration(record.durationMs)}</span>
        {failures.length > 0 && <Chevron className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:-scale-x-100" />}
      </button>
      {isOpen && (
        <ul aria-label={TEXT.failedChecks} className="flex flex-col gap-1 px-3 pb-2 ps-6">
          {failures.map((entry, index) => (
            <li key={index} className="text-xs">
              <p className="text-foreground">{entry.name}</p>
              {entry.error && <p className="whitespace-pre-line text-muted-foreground">{entry.error}</p>}
              {entry.failedChecks.map((check, position) => <p key={position} className="text-muted-foreground">{check.name}{check.message ? `: ${check.message}` : ""}</p>)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-sm text-foreground">{value}</span>
    </div>
  )
}

function MonitorDetail({ monitor, history, isRunning, nextRun, needsData, failure, actions }) {
  const trend = useMemo(() => trendOf(history), [history])
  const target = nameOfTarget(monitor, useAppStore.getState())
  const schedule = monitor.paused ? TEXT.paused : nextRun ? TEXT.nextRun(formatTime(new Date(nextRun))) : ""
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Toolbar className={cn("h-auto flex-wrap py-1.5")}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{monitor.name}</p>
          <p className="truncate text-2xs text-muted-foreground">{[target, schedule].filter(Boolean).join(" · ")}</p>
        </div>
        <Button size="sm" disabled={isRunning || needsData} onClick={() => actions.runNow(monitor.id)}>
          <Play />
          {isRunning ? TEXT.running : TEXT.runNow}
        </Button>
        <IconButton label={monitor.paused ? TEXT.resume : TEXT.pause} icon={monitor.paused ? Play : Pause} onClick={() => actions.togglePause(monitor.id)} />
        <IconButton label={TEXT.edit} icon={Pencil} onClick={() => actions.startEdit(monitor.id)} />
        <IconButton label={TEXT.delete} icon={Trash2} onClick={() => actions.confirmRemove(monitor.id)} />
      </Toolbar>
      {needsData && <Notice tone="warning">{TEXT.needsData}</Notice>}
      {failure && <Notice tone="destructive" role="alert">{failure}</Notice>}
      <PanelBody className="p-0">
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
          <Stat label={TEXT.passRate} value={trend.runs > 0 ? formatPercent(trend.passRate) : "-"} />
          <Stat label={TEXT.lastRun} value={trend.last ? (trend.last.passed ? TEXT.passed : TEXT.failed) : TEXT.neverRun} />
          <Stat label={TEXT.p95} value={trend.runs > 0 ? RUNNER_TEXT.duration(trend.p95Ms) : "-"} />
          <Stat label={TEXT.history} value={TEXT.runsCount(trend.runs)} />
        </div>
        {trend.runs > 0 && (
          <div className="border-t border-border p-3">
            <MonitorChart points={trend.points} />
          </div>
        )}
        <div className="border-t border-border">
          {trend.runs === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">{TEXT.noRuns}</p>
          ) : (
            <ul aria-label={TEXT.history}>
              {[...history].reverse().slice(0, SHOWN_RUNS).map((record) => <RunRow key={record.id} record={record} />)}
            </ul>
          )}
        </div>
      </PanelBody>
    </div>
  )
}

export function MonitorsDialog({ actions }) {
  const monitors = useMonitorStore((s) => s.monitors)
  const histories = useMonitorStore((s) => s.histories)
  const running = useMonitorStore((s) => s.running)
  const nextRuns = useMonitorStore((s) => s.nextRuns)
  const failures = useMonitorStore((s) => s.failures)
  const hasData = useMonitorStore((s) => s.hasData)
  const editing = useMonitorStore((s) => s.editing)
  const selectedId = useMonitorStore((s) => s.selectedId)
  const selected = monitors.find((monitor) => monitor.id === selectedId) || monitors[0]
  const note = actions.hasWebhooks ? TEXT.desktopNote : TEXT.webNote

  const create = (
    <Button size="sm" onClick={actions.startNew}>
      <Plus />
      {monitors.length === 0 ? TEXT.emptyAction : TEXT.newMonitor}
    </Button>
  )

  return (
    <Dialog label={TEXT.title} size="lg" floating={WINDOW} onClose={actions.close}>
      <DialogHeader onClose={actions.close}>
        <DialogTitle>{TEXT.title}</DialogTitle>
      </DialogHeader>
      <Notice tone="muted" icon={Timer}>{note}</Notice>
      {monitors.length === 0 && !editing ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState icon={Activity} title={TEXT.emptyTitle} description={TEXT.emptyDescription} action={create} />
        </div>
      ) : (
        <div className={SPLIT_PANES} style={{ "--pane-width": "15rem" }}>
          <div className={SPLIT_LIST}>
            <Toolbar className="justify-between">{create}</Toolbar>
            <ul aria-label={TEXT.list} className="min-h-0 flex-1 overflow-y-auto">
              {monitors.map((monitor) => (
                <MonitorRow
                  key={monitor.id}
                  monitor={monitor}
                  isSelected={selected?.id === monitor.id}
                  isRunning={Boolean(running[monitor.id])}
                  history={histories[monitor.id] || []}
                  onSelect={() => actions.select(monitor.id)}
                />
              ))}
            </ul>
          </div>
          {editing ? (
            <MonitorForm key={editing.id || "new"} draft={editing} hasWebhooks={actions.hasWebhooks} onSave={actions.save} onCancel={actions.cancelEdit} />
          ) : (
            selected && (
              <MonitorDetail
                key={selected.id}
                monitor={selected}
                history={histories[selected.id] || []}
                isRunning={Boolean(running[selected.id])}
                nextRun={nextRuns[selected.id]}
                needsData={Boolean(selected.dataName) && hasData[selected.id] !== true}
                failure={failures[selected.id]}
                actions={actions}
              />
            )
          )}
        </div>
      )}
    </Dialog>
  )
}
