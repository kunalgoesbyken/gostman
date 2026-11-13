import { useMemo } from "react"
import { Dialog, DialogHeader, DialogTitle } from "./ui/dialog"
import { TabCount } from "./ui/tabs"
import { CallsExplorer } from "./CallsExplorer"
import { MethodTag } from "./MethodTag"
import { callsOf } from "../lib/callHistory"
import { toolWindow } from "../lib/dialogWindows"
import { HISTORY_TEXT } from "../lib/sidebarText"
import { useAppStore } from "../store/appStore"

const TEXT = HISTORY_TEXT.calls
const CALLS_WINDOW = toolWindow("calls", "wide")

function useEntry() {
  const id = useAppStore((s) => s.callHistoryId)
  return useAppStore((s) => s.requestHistory.find((entry) => entry.id === id))
}

function CallHistoryView({ entry, onClose, onExport }) {
  const calls = useMemo(() => callsOf(entry), [entry])

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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CallsExplorer calls={calls} entry={entry} onExport={onExport} />
      </div>
    </Dialog>
  )
}

export function CallHistoryDialog({ onExport }) {
  const entry = useEntry()
  const close = useAppStore((s) => s.closeCallHistory)
  if (!entry) return null
  return <CallHistoryView entry={entry} onClose={close} onExport={onExport} />
}
