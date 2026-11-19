import { FileCode, Workflow } from "lucide-react"
import { MethodTag } from "./MethodTag"
import { PHASE_CONNECTING, statusLabel, useTabActivity } from "../hooks/useTabActivity"
import { shownMethod } from "../lib/methodLabel"
import { cn } from "../lib/utils"

const ICON_CLASS = "h-3.5 w-3.5 shrink-0"

function ActivityDot({ activity }) {
  const isConnecting = activity.phase === PHASE_CONNECTING
  return (
    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isConnecting ? "bg-warning motion-safe:animate-pulse" : "bg-success")}>
      <span className="sr-only">{statusLabel(activity)}</span>
    </span>
  )
}

function Mark({ tab, compact, className }) {
  if (tab.flowId) return <Workflow aria-hidden="true" className={cn(ICON_CLASS, className)} />
  if (tab.specId) return <FileCode aria-hidden="true" className={cn(ICON_CLASS, className)} />
  return <MethodTag compact={compact} method={shownMethod(tab.request)} />
}

export function TabMark({ tab, compact = false, className }) {
  const activity = useTabActivity(tab)
  return (
    <>
      {activity && <ActivityDot activity={activity} />}
      <Mark tab={tab} compact={compact} className={className} />
    </>
  )
}
