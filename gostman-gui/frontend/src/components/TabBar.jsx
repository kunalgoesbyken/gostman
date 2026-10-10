import { memo, useEffect, useMemo, useRef } from "react"
import { Plus, X } from "lucide-react"
import { METHOD_COLORS } from "../lib/constants"
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
      role="tab"
      aria-selected={isActive}
      title={request.url ? `${title}\n${request.url}` : title}
      onMouseDown={preventAutoscroll}
      onAuxClick={closeOnMiddleClick}
      className={cn(
        "group flex h-8 min-w-[7rem] max-w-[13rem] shrink-0 items-center border-r border-border/60 text-xs",
        isActive ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(tab.id)}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-3 text-left outline-none focus-visible:bg-muted/40"
      >
        <span className={cn("shrink-0 font-mono text-[10px] font-semibold", METHOD_COLORS[request.method] || "text-muted-foreground")}>
          {request.method}
        </span>
        <span className="truncate">{title}</span>
      </button>
      <button
        type="button"
        onClick={() => onClose(tab.id)}
        aria-label={isDirty ? `Close ${title} (unsaved changes)` : `Close ${title}`}
        className="relative mx-1 flex h-5 w-5 shrink-0 items-center justify-center rounded outline-none hover:bg-muted-foreground/20 focus-visible:bg-muted-foreground/20"
      >
        {isDirty && (
          <span className="absolute h-1.5 w-1.5 rounded-full bg-foreground/70 group-hover:hidden group-focus-within:hidden" />
        )}
        <X className={cn("h-3 w-3", isDirty && "hidden group-hover:block group-focus-within:block")} />
      </button>
    </div>
  )
})

export const TabBar = memo(function TabBar({ tabs, activeTabId, requests, onTabSelect, onTabClose, onNewTab }) {
  const savedById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])

  return (
    <div className="flex items-stretch border-b border-border/60 bg-muted/20">
      <div role="tablist" className="flex min-w-0 overflow-x-auto scrollbar-none">
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
      <button
        type="button"
        onClick={onNewTab}
        aria-label="New tab"
        title="New request (Ctrl+N)"
        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground outline-none hover:bg-muted/40 hover:text-foreground focus-visible:bg-muted/40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
})
