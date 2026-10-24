import { FileWarning } from "lucide-react"
import { Button } from "./ui/button"
import { isRequestDirty } from "../lib/requestChanges"
import { WORKSPACE_TEXT as TEXT } from "../lib/workspaceText"
import { useActiveTab, useAppStore } from "../store/appStore"

export function DiskChangeNotice() {
  const tab = useActiveTab()
  const saved = useAppStore((s) => (tab.diskChange ? s.requests.find((request) => request.id === tab.request.id) : null))
  const resolve = useAppStore((s) => s.resolveDiskChange)

  if (!tab.diskChange || saved !== tab.diskChange || !isRequestDirty(tab.request, saved)) return null

  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-warning">
      <FileWarning aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{TEXT.diskChanged}</span>
      <Button size="sm" variant="outline" onClick={() => resolve(tab.id, false)}>{TEXT.keepMine}</Button>
      <Button size="sm" variant="outline" onClick={() => resolve(tab.id, true)}>{TEXT.loadTheirs}</Button>
    </div>
  )
}
