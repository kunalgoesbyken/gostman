import { FileWarning } from "lucide-react"
import { Button } from "./ui/button"
import { isRequestDirty } from "../lib/requestChanges"
import { WORKSPACE_TEXT as TEXT } from "../lib/workspaceText"
import { useActiveTab, useAppStore } from "../store/appStore"

function NoticeBar({ message, children }) {
  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-warning">
      <FileWarning aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {children}
    </div>
  )
}

export function DiskChangeNotice() {
  const tab = useActiveTab()
  const saved = useAppStore((s) => (tab.diskChange ? s.requests.find((request) => request.id === tab.request.id) : null))
  const isGone = useAppStore((s) => Boolean(tab.vanished) && !s.requests.some((request) => request.id === tab.request.id))
  const resolve = useAppStore((s) => s.resolveDiskChange)

  if (isGone) return <NoticeBar message={TEXT.vanished} />
  if (!tab.diskChange || saved !== tab.diskChange || !isRequestDirty(tab.request, saved)) return null

  return (
    <NoticeBar message={TEXT.diskChanged}>
      <Button size="sm" variant="outline" onClick={() => resolve(tab.id, false)}>{TEXT.keepMine}</Button>
      <Button size="sm" variant="outline" onClick={() => resolve(tab.id, true)}>{TEXT.loadTheirs}</Button>
    </NoticeBar>
  )
}
