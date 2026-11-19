import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { Activity, Bug, Gauge, ListChecks, Pause, Play, Radio, Server, Square } from "lucide-react"
import { cn } from "../lib/utils"
import { useCaptureStore } from "../lib/captureSession"
import { MODELESS_WINDOWS } from "../lib/dialogWindows"
import { featureById, featureToolLabel } from "../lib/featureIndex"
import { useLoadTestStore } from "../lib/loadTestSession"
import { useMockStore } from "../lib/mockServer"
import { useMonitorStore } from "../lib/monitors/monitorSession"
import { IDLE as IDLE_PHASE, RUNNING, useNegativeStore } from "../lib/negativeSession"
import { isFailure } from "../lib/runReport"
import { STATUS_BAR_TEXT as TEXT } from "../lib/statusBarText"
import { frontWindow, minimizedWindows, minimizeWindow, showWindow, subscribeToWindows, trayProps } from "../lib/windowLayers"
import { useAppStore } from "../store/appStore"
import { STATUS_ITEM_CLASS } from "./StatusItem"

const IDLE = "idle"
const ON = "on"
const WAITING = "waiting"
const FAILED = "failed"

const TONE_CLASSES = {
  [IDLE]: "",
  [ON]: "text-success",
  [WAITING]: "text-warning",
  [FAILED]: "text-destructive",
}

const PULSE_CLASS = "[&_svg]:motion-safe:animate-pulse"

const CONTROL_CLASS = "inline-flex h-full items-center px-1 transition-colors hover:bg-accent hover:text-foreground max-sm:px-2 [&_svg]:size-2.5 max-sm:[&_svg]:size-3.5"

const portOf = (address) => {
  try {
    return new URL(address).port
  } catch {
    return ""
  }
}

const fractionOf = (done, total) => (total > 0 ? Math.min(1, done / total) : null)

const stopControl = (stop) => ({ icon: Square, action: TEXT.stopTool, run: stop, stops: true })

const startControl = (start) => start && { icon: Play, action: TEXT.startTool, run: start }

const control = (isRunning, start, stop) => (isRunning ? stopControl(stop) : startControl(start))

const runTone = (hasFailed, hasRun) => (hasFailed ? FAILED : hasRun ? ON : IDLE)

function useMockItem(mock) {
  const isOpen = useAppStore((s) => s.mockDialogOpen)
  const isRunning = useMockStore((s) => s.isRunning)
  const isStarting = useMockStore((s) => s.isStarting)
  const port = useMockStore((s) => portOf(s.address))
  return {
    id: MODELESS_WINDOWS.mock.id,
    icon: Server,
    isOpen,
    tone: isRunning || isStarting ? ON : IDLE,
    isBusy: isStarting,
    detail: isRunning && port ? TEXT.port(port) : "",
    open: mock.open,
    control: !isStarting && control(isRunning, isOpen && mock.start, mock.stop),
  }
}

function useCaptureItem(capture) {
  const isOpen = useCaptureStore((s) => s.isOpen)
  const isRunning = useCaptureStore((s) => s.isRunning)
  const isStarting = useCaptureStore((s) => s.isStarting)
  const calls = useCaptureStore((s) => s.log.length)
  const held = useCaptureStore((s) => s.held.length)
  return {
    id: MODELESS_WINDOWS.capture.id,
    icon: Radio,
    isOpen,
    tone: held > 0 ? WAITING : isRunning || isStarting ? ON : IDLE,
    isBusy: isStarting,
    detail: held > 0 ? TEXT.held(held) : isRunning ? TEXT.calls(calls) : "",
    waitingNotice: (name) => TEXT.holdingNotice({ name, count: held }),
    open: capture.open,
    control: !isStarting && control(isRunning, isOpen && capture.start, capture.stop),
  }
}

const isFailing = (state, monitor) => Boolean(state.failures[monitor.id]) || state.histories[monitor.id]?.at(-1)?.passed === false

function useMonitorsItem(monitors) {
  const isOpen = useMonitorStore((s) => s.isOpen)
  const active = useMonitorStore((s) => s.monitors.filter((monitor) => !monitor.paused).length)
  const paused = useMonitorStore((s) => s.monitors.filter((monitor) => monitor.paused).length)
  const failing = useMonitorStore((s) => s.monitors.filter((monitor) => !monitor.paused && isFailing(s, monitor)).length)
  const isChecking = useMonitorStore((s) => Object.keys(s.running).length > 0)
  const resume = isOpen && paused > 0 && { icon: Play, action: TEXT.resumeTool, run: monitors.resumeAll }
  return {
    id: MODELESS_WINDOWS.monitors.id,
    icon: Activity,
    isOpen,
    tone: failing > 0 ? FAILED : active > 0 ? ON : IDLE,
    isBusy: isChecking,
    detail: failing > 0 ? TEXT.failingMonitors(failing) : active > 0 ? TEXT.activeMonitors(active) : "",
    open: monitors.open,
    control: active > 0 ? { icon: Pause, action: TEXT.pauseTool, run: monitors.pauseAll } : resume,
  }
}

function useRunnerItem(stopRun) {
  const isOpen = useAppStore((s) => s.runner.isOpen)
  const isRunning = useAppStore((s) => s.runner.isRunning)
  const results = useAppStore((s) => s.runner.results)
  const planned = useAppStore((s) => s.runner.planned)
  const hasFailed = useMemo(() => results.some(isFailure), [results])
  return {
    id: MODELESS_WINDOWS.runner.id,
    icon: ListChecks,
    isOpen,
    tone: runTone(hasFailed, isRunning || results.length > 0),
    isBusy: isRunning,
    finishes: true,
    progress: isRunning ? fractionOf(results.length, planned) : null,
    detail: results.length > 0 ? TEXT.progress({ done: results.length, total: Math.max(planned, results.length) }) : "",
    control: isRunning && stopControl(stopRun),
  }
}

function useLoadTestItem(loadTest) {
  const isOpen = useLoadTestStore((s) => s.isOpen)
  const isRunning = useLoadTestStore((s) => s.isRunning)
  const sent = useLoadTestStore((s) => s.progress?.total ?? s.report?.total ?? 0)
  const failed = useLoadTestStore((s) => s.progress?.failed ?? s.report?.failed ?? 0)
  const progress = useLoadTestStore((s) => (s.isRunning && s.progress ? fractionOf(s.progress.elapsedMs, s.progress.durationMs) : null))
  const canStart = useLoadTestStore((s) => Boolean(s.request) && !s.blocked)
  return {
    id: MODELESS_WINDOWS.loadTest.id,
    icon: Gauge,
    isOpen,
    tone: runTone(failed > 0, isRunning || sent > 0),
    isBusy: isRunning,
    finishes: true,
    progress,
    detail: sent > 0 ? TEXT.requests(sent) : "",
    control: control(isRunning, canStart && loadTest.start, loadTest.stop),
  }
}

function useNegativeItem(negative) {
  const isOpen = useNegativeStore((s) => s.isOpen)
  const phase = useNegativeStore((s) => s.phase)
  const sent = useNegativeStore((s) => s.sent)
  const planned = useNegativeStore((s) => s.planned)
  const findings = useNegativeStore((s) => s.findings.length)
  const isRunning = phase === RUNNING
  return {
    id: MODELESS_WINDOWS.negative.id,
    icon: Bug,
    isOpen,
    tone: runTone(findings > 0, phase !== IDLE_PHASE),
    isBusy: isRunning,
    finishes: true,
    progress: isRunning ? fractionOf(sent, planned) : null,
    detail: findings > 0 ? TEXT.findings(findings) : sent > 0 ? TEXT.progress({ done: sent, total: Math.max(planned, sent) }) : "",
    control: isRunning && stopControl(negative.stop),
  }
}

const isShown = (item) => item.isOpen || item.isBusy || item.tone !== IDLE

function reveal(item) {
  if (item.isOpen) showWindow(item.id)
  else item.open()
}

function noticeFor(before, item) {
  if (item.finishes && before.isBusy && !item.isBusy && item.isOpen) {
    return item.detail ? TEXT.toolFinished({ name: item.name, detail: item.detail }) : TEXT.toolEnded(item.name)
  }
  if (before.tone !== WAITING && item.tone === WAITING) return item.waitingNotice(item.name)
  return ""
}

function useOutOfSightNotices(items, minimized, stoppedHere) {
  const previous = useRef(new Map())
  const showNotice = useAppStore((s) => s.showNotice)

  useEffect(() => {
    items.forEach((item) => {
      const before = previous.current.get(item.id)
      const isHidden = !item.isOpen || minimized.includes(item.id)
      const message = before && isHidden && !stoppedHere.current.has(item.id) && noticeFor(before, item)
      if (message) showNotice(message, null, { label: TEXT.show, run: () => reveal(item) })
      if (!item.isBusy) stoppedHere.current.delete(item.id)
    })
    previous.current = new Map(items.map((item) => [item.id, item]))
  })
}

function ProgressLine({ fraction }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-1 bottom-0 h-0.5 overflow-hidden rounded-full bg-border">
      <span className="block h-full bg-current transition-[width] duration-500" style={{ width: `${fraction * 100}%` }} />
    </span>
  )
}

function TrayItem({ item, isFront, isMinimized, onStop }) {
  const hides = item.isOpen && isFront && !isMinimized
  const toggle = () => (hides ? minimizeWindow(item.id) : reveal(item))
  const pulses = item.tone === WAITING || (item.isBusy && item.progress == null)
  const runControl = () => {
    if (item.control.stops) onStop(item.id)
    item.control.run()
  }

  return (
    <span className={cn("relative inline-flex h-full items-center", TONE_CLASSES[item.tone], pulses && PULSE_CLASS, item.isOpen && !isMinimized && "bg-accent/60")}>
      <button type="button" title={hides ? TEXT.minimizeTool(item.name) : TEXT.showTool(item.name)} className={STATUS_ITEM_CLASS} {...trayProps(item.id)} onClick={toggle}>
        <item.icon aria-hidden="true" />
        <span className="max-lg:sr-only">{item.name}</span>
        {item.detail && <span className="tabular-nums opacity-80 max-sm:sr-only">{item.detail}</span>}
      </button>
      {item.control && (
        <button type="button" title={item.control.action(item.name)} aria-label={item.control.action(item.name)} className={CONTROL_CLASS} onClick={runControl}>
          <item.control.icon aria-hidden="true" className="fill-current" />
        </button>
      )}
      {item.progress != null && <ProgressLine fraction={item.progress} />}
    </span>
  )
}

export function ToolTray({ actions }) {
  const front = useSyncExternalStore(subscribeToWindows, frontWindow, frontWindow)
  const minimized = useSyncExternalStore(subscribeToWindows, minimizedWindows, minimizedWindows)
  const stoppedHere = useRef(new Set())
  const items = [
    useMockItem(actions.mock),
    useCaptureItem(actions.capture),
    useMonitorsItem(actions.monitors),
    useRunnerItem(actions.stopRun),
    useLoadTestItem(actions.loadTest),
    useNegativeItem(actions.negative),
  ].map((item) => ({ ...item, name: featureToolLabel(featureById(item.id)) }))
  useOutOfSightNotices(items, minimized, stoppedHere)

  const shown = items.filter(isShown)
  if (shown.length === 0) return null
  return (
    <div role="group" aria-label={TEXT.tray} className="flex h-full items-center">
      {shown.map((item) => (
        <TrayItem key={item.id} item={item} isFront={front === item.id} isMinimized={minimized.includes(item.id)} onStop={(id) => stoppedHere.current.add(id)} />
      ))}
    </div>
  )
}
