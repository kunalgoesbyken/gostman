import { memo, useState } from "react"
import { FolderPlus, Plus } from "lucide-react"
import { Button } from "./ui/button"
import { CollectionTree } from "./CollectionTree"
import { HistoryList } from "./HistoryList"
import { cn } from "../lib/utils"

const VIEW_COLLECTIONS = "collections"
const VIEW_HISTORY = "history"
const TOOLBAR_BUTTON_CLASS = "h-7 w-7 text-muted-foreground hover:text-foreground"

function ViewTab({ isActive, onSelect, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onSelect}
      className={cn(
        "-mb-px border-b-2 px-1 py-2 text-xs font-medium outline-none focus-visible:text-foreground",
        isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

export const Sidebar = memo(function Sidebar({ folders, requests, requestHistory, activeRequestId, actions }) {
  const [view, setView] = useState(VIEW_COLLECTIONS)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/60 bg-background">
      <div className="flex items-center gap-3 border-b border-border/60 pl-3 pr-1" role="tablist">
        <ViewTab isActive={view === VIEW_COLLECTIONS} onSelect={() => setView(VIEW_COLLECTIONS)}>
          Collections
        </ViewTab>
        <ViewTab isActive={view === VIEW_HISTORY} onSelect={() => setView(VIEW_HISTORY)}>
          History
          {requestHistory.length > 0 && (
            <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">{requestHistory.length}</span>
          )}
        </ViewTab>

        <div className="ml-auto flex items-center">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => actions.createFolder()}
            aria-label="New folder"
            title="New folder"
            className={TOOLBAR_BUTTON_CLASS}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => actions.newRequest()}
            aria-label="New request"
            title="New request (Ctrl+N)"
            className={TOOLBAR_BUTTON_CLASS}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === VIEW_COLLECTIONS ? (
        <CollectionTree folders={folders} requests={requests} activeRequestId={activeRequestId} actions={actions} />
      ) : (
        <HistoryList entries={requestHistory} actions={actions} />
      )}
    </aside>
  )
})
