import { useEffect } from "react"
import { X } from "lucide-react"
import { Button, IconButton } from "./ui/button"
import { useAppStore } from "../store/appStore"
import { TREE_TEXT } from "../lib/treeText"

const NOTICE_MS = 8000

export function NoticeToast() {
  const notice = useAppStore((s) => s.notice)
  const dismiss = useAppStore((s) => s.dismissNotice)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(dismiss, NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice, dismiss])

  if (!notice) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-10 z-40 flex items-center gap-2 rounded-md border border-border bg-background py-1.5 pl-3 pr-1.5 text-xs text-foreground sm:inset-x-auto sm:left-4 sm:max-w-sm"
    >
      <span className="min-w-0 flex-1 truncate" title={notice.message}>{notice.message}</span>
      {notice.undo && <Button size="sm" variant="outline" onClick={notice.undo}>{TREE_TEXT.undo}</Button>}
      <IconButton label={TREE_TEXT.dismiss} icon={X} size="icon-xs" onClick={dismiss} />
    </div>
  )
}
