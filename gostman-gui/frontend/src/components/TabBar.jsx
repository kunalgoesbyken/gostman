import { memo, useEffect, useMemo, useRef } from "react"
import { Plus, X } from "lucide-react"
import { IconButton } from "./ui/button"
import { MethodTag } from "./MethodTag"
import { shortcutLabel } from "../lib/platform"
import { isRequestDirty } from "../lib/requestChanges"
import { cn } from "../lib/utils"

const MIDDLE_MOUSE_BUTTON = 1

const Tab = memo(function Tab({ tab, saved, isActive, onSelect, onClose }) {
  const tabRef = useRef(null)
  const { request } = tab
  const isDirty = useMemo(() => isRequestDirty(request, saved), [request, saved])
  const title = request.name || request.url || "Untitled"

  useEffect(() => {
    if (isActive) tabRef.current.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [isActive])

  const preventAutoscroll = (event) => {
    if (event.button === MIDDLE_MOUSE_BUTTON) event.preventDefault()
  }
  const closeOnMiddleClick = (event) => {
    if (event.button === MIDDLE_MOUSE_BUTTON) onClose(tab.id)
  }

  return (
    <div
      ref={tabRef}
      title={request.url ? `${title}\n${request.url}` : title}
      onMouseDown={preventAutoscroll}
      onAuxClick={closeOnMiddleClick}
      className={cn(
        "group flex w-44 shrink-0 items-center border-b-2 border-r border-r-border pr-1.5 text-xs",
        isActive ? "border-b-primary text-foreground" : "border-b-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        onClick={() => onSelect(tab.id)}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-3 text-left"
      >
        <MethodTag method={request.method} />
        <span className="truncate">{title}</span>
        {isDirty && <span aria-label="Unsaved changes" className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />}
      </button>
      <IconButton label={`Close ${title}`} icon={X} size="icon-xs" onClick={() => onClose(tab.id)} className="hover:bg-muted" />
    </div>
  )
})

export const TabBar = memo(function TabBar({ tabs, activeTabId, requests, onTabSelect, onTabClose, onNewTab }) {
  const savedById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])

  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-border">
      <div role="tablist" aria-label="Open requests" className="flex min-w-0 items-stretch overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            saved={savedById.get(tab.request.id)}
            isActive={tab.id === activeTabId}
            onSelect={onTabSelect}
            onClose={onTabClose}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center px-1.5">
        <IconButton label={`New request (${shortcutLabel("N")})`} icon={Plus} onClick={onNewTab} />
      </div>
    </div>
  )
})
